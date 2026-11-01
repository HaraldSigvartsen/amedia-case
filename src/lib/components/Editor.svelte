<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import ChatPanel from '#lib/components/ChatPanel.svelte';
	import PreviewPane from '#lib/components/PreviewPane.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import { storedUserText, type ChatAttachment } from '#lib/attachments.ts';
	import { visibleAssistantText } from '#lib/html.ts';
	import type { ChatMessage, EmbedDetail, EmbedSummary } from '#lib/types.ts';

	let {
		journalist,
		embeds,
		embed,
		missing
	}: {
		journalist: string;
		embeds: EmbedSummary[];
		embed: EmbedDetail | null;
		missing: boolean;
	} = $props();

	// The page remounts this component when the embed id changes.
	let selected = $state<EmbedDetail | null>(untrack(() => embed));
	let pending = $state(false);
	let creating = $state(false);
	let streamingText = $state('');
	let errorMessage = $state<string | null>(null);
	let tab = $state<'list' | 'chat' | 'preview'>('chat');
	let desk = $state<HTMLDivElement | null>(null);
	let previewWidth = $state(960);
	let dragging = $state(false);

	const SIDEBAR = 260;
	const MIN_CHAT = 300;
	const MIN_PREVIEW = 480;
	const HANDLE = 12;
	const PREVIEW_KEY = 'amedia-preview-width';

	function clampPreview(width: number): number {
		const total = desk?.getBoundingClientRect().width ?? width + SIDEBAR + MIN_CHAT + HANDLE;
		const max = Math.max(MIN_PREVIEW, total - SIDEBAR - MIN_CHAT - HANDLE);
		return Math.round(Math.min(Math.max(width, MIN_PREVIEW), max));
	}

	function startDrag(event: PointerEvent) {
		dragging = true;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function drag(event: PointerEvent) {
		if (!dragging || !desk) return;
		const rect = desk.getBoundingClientRect();
		previewWidth = clampPreview(rect.right - event.clientX);
	}

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		localStorage.setItem(PREVIEW_KEY, String(previewWidth));
	}

	function onSeparatorKey(event: KeyboardEvent) {
		const step = event.shiftKey ? 80 : 32;
		if (event.key === 'ArrowLeft') previewWidth = clampPreview(previewWidth + step);
		else if (event.key === 'ArrowRight') previewWidth = clampPreview(previewWidth - step);
		else if (event.key === 'Home') previewWidth = clampPreview(9999);
		else if (event.key === 'End') previewWidth = MIN_PREVIEW;
		else return;
		event.preventDefault();
		localStorage.setItem(PREVIEW_KEY, String(previewWidth));
	}

	$effect(() => {
		const node = desk;
		if (!node) return;
		const stored = Number(localStorage.getItem(PREVIEW_KEY));
		const initial =
			Number.isFinite(stored) && stored >= MIN_PREVIEW
				? stored
				: node.getBoundingClientRect().width * 0.62;
		previewWidth = clampPreview(initial);
		const onResize = () => {
			previewWidth = clampPreview(untrack(() => previewWidth));
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	async function readError(response: Response, fallback: string): Promise<string> {
		try {
			const body = (await response.json()) as { message?: string };
			return body.message || fallback;
		} catch {
			return fallback;
		}
	}

	async function createEmbed() {
		creating = true;
		errorMessage = null;
		try {
			const response = await fetch('/api/embeds', {
				method: 'POST',
				headers: { accept: 'application/json', 'content-type': 'application/json' }
			});
			if (!response.ok) {
				errorMessage = await readError(response, 'Kunne ikke opprette embeden.');
				return;
			}
			const created = (await response.json()) as EmbedDetail;
			await goto(resolve(`/?id=${created.id}`));
			tab = 'chat';
		} finally {
			creating = false;
		}
	}

	function updateSelected(patch: Partial<EmbedDetail>) {
		if (!selected) return;
		selected = { ...selected, ...patch };
	}

	async function rename(id: string, title: string) {
		const response = await fetch(`/api/embeds/${id}`, {
			method: 'PATCH',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			body: JSON.stringify({ title })
		});
		if (!response.ok) {
			errorMessage = await readError(response, 'Kunne ikke endre tittelen.');
			return;
		}
		if (selected?.id === id) updateSelected({ title });
		await refreshAll();
	}

	async function remove(id: string) {
		const response = await fetch(`/api/embeds/${id}`, { method: 'DELETE' });
		if (!response.ok && response.status !== 204) {
			errorMessage = await readError(response, 'Kunne ikke slette embeden.');
			return;
		}
		await goto(resolve('/'));
	}

	async function togglePublish() {
		if (!selected || pending) return;
		const published = !selected.published;
		const response = await fetch(`/api/embeds/${selected.id}`, {
			method: 'PATCH',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			body: JSON.stringify({ published })
		});
		if (!response.ok) {
			errorMessage = await readError(response, 'Kunne ikke endre publiseringen.');
			return;
		}
		updateSelected({ published });
		await refreshAll();
	}

	async function readSse(response: Response, onEvent: (name: string, data: string) => void) {
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Tomt svar fra serveren.');
		const decoder = new TextDecoder();
		let buffer = '';
		const flush = (block: string) => {
			if (!block.trim()) return;
			let name = 'message';
			const data: string[] = [];
			for (const line of block.split('\n')) {
				if (line.startsWith('event:')) name = line.slice(6).trim();
				else if (line.startsWith('data:')) data.push(line.slice(5).trim());
			}
			if (data.length) onEvent(name, data.join('\n'));
		};
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split('\n\n');
			buffer = parts.pop() ?? '';
			for (const part of parts) flush(part);
		}
		if (buffer.trim()) flush(buffer);
	}

	async function send(text: string, attachments: ChatAttachment[] = []) {
		if (!selected || pending) return;
		const embedId = selected.id;
		const optimistic: ChatMessage = {
			id: -Date.now(),
			role: 'user',
			content: storedUserText(text, attachments),
			createdAt: new Date().toISOString()
		};
		updateSelected({ messages: [...selected.messages, optimistic] });
		pending = true;
		streamingText = '';
		errorMessage = null;
		tab = 'chat';

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
				body: JSON.stringify({ embedId, message: text, attachments })
			});
			if (!response.ok) {
				errorMessage = await readError(response, 'Chatten svarte ikke.');
				updateSelected({
					messages: selected.messages.filter((message) => message.id !== optimistic.id)
				});
				return;
			}

			let accumulated = '';
			await readSse(response, (name, raw) => {
				const payload = JSON.parse(raw) as {
					text?: string;
					html?: string;
					title?: string;
					message?: string;
					commentary?: string;
				};
				if (name === 'delta' && payload.text) {
					accumulated += payload.text;
					streamingText = accumulated;
				} else if (name === 'html' && payload.html && selected) {
					updateSelected({ html: payload.html });
				} else if (name === 'done' && selected) {
					const commentary = payload.commentary?.trim() ?? '';
					const showed = visibleAssistantText(accumulated);
					const assistant: ChatMessage = {
						id: -Date.now() - 1,
						role: 'assistant',
						content: commentary && commentary !== showed ? commentary : accumulated,
						createdAt: new Date().toISOString()
					};
					updateSelected({
						html: payload.html ?? selected.html,
						title: payload.title ?? selected.title,
						messages: [...selected.messages, assistant]
					});
				} else if (name === 'error') {
					errorMessage = payload.message ?? 'Noe gikk galt med språkmodellen.';
				}
			});
			streamingText = '';
			await refreshAll();
		} catch {
			errorMessage = 'Mistet forbindelsen mens svaret kom.';
		} finally {
			pending = false;
		}
	}
</script>

<div class="flex h-dvh flex-col bg-paper text-ink">
	<header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3 lg:hidden">
		<p class="text-sm leading-tight">Amedias<br />lille hjelper</p>
		<div
			class="flex rounded-lg border border-line bg-panel p-1"
			role="tablist"
			aria-label="Visning"
		>
			{#each [{ id: 'list', label: 'Mine' }, { id: 'chat', label: 'Chat' }, { id: 'preview', label: 'Visning' }] as item (item.id)}
				<button
					type="button"
					role="tab"
					class="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {tab ===
					item.id
						? 'bg-ink text-white'
						: ''}"
					aria-selected={tab === item.id}
					onclick={() => (tab = item.id as 'list' | 'chat' | 'preview')}
				>
					{item.label}
				</button>
			{/each}
		</div>
	</header>

	<div bind:this={desk} class="flex min-h-0 flex-1" style:--preview-width="{previewWidth}px">
		<div
			class="{tab === 'list' ? 'flex' : 'hidden'} min-h-0 w-full lg:flex lg:w-[260px] lg:shrink-0"
		>
			<Sidebar
				{embeds}
				activeId={selected?.id ?? null}
				{journalist}
				{creating}
				onCreate={createEmbed}
				onRename={rename}
				onDelete={remove}
			/>
		</div>

		<div class="{tab === 'chat' ? 'flex' : 'hidden'} min-h-0 w-full min-w-0 flex-1 lg:flex">
			{#if missing}
				<div class="grid flex-1 place-items-center px-6">
					<p role="alert">Fant ikke denne embeden.</p>
				</div>
			{:else if selected}
				<ChatPanel
					title={selected.title}
					published={selected.published}
					messages={selected.messages}
					{streamingText}
					{pending}
					error={errorMessage}
					disabled={false}
					onSend={send}
					onTitle={(title) => rename(selected?.id ?? '', title)}
					onTogglePublish={togglePublish}
				/>
			{:else}
				<div class="grid flex-1 place-items-center px-8">
					<div class="max-w-md text-center">
						<p class="text-2xl leading-tight">Amedias lille hjelper</p>
						<p class="mt-3 leading-7 text-muted">
							Start med en ny embed. Så beskriver du hva leseren skal se.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<button
			type="button"
			role="slider"
			aria-orientation="vertical"
			aria-label="Bredde på forhåndsvisning"
			aria-valuemin={MIN_PREVIEW}
			aria-valuemax={Math.max(1600, previewWidth)}
			aria-valuenow={previewWidth}
			class="desk-resize group relative hidden w-3 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline-2 focus-visible:outline-accent lg:block"
			onpointerdown={startDrag}
			onpointermove={drag}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			onkeydown={onSeparatorKey}
		>
			<span
				class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line group-hover:bg-ink {dragging
					? 'bg-ink'
					: ''}"
			></span>
		</button>

		<div class="{tab === 'preview' ? 'flex' : 'hidden'} desk-preview min-h-0 w-full lg:flex">
			<PreviewPane
				embedId={selected?.id ?? null}
				title={selected?.title ?? 'Embed'}
				html={selected?.html ?? ''}
				published={selected?.published ?? false}
				streaming={pending}
				{streamingText}
			/>
		</div>
	</div>
</div>
