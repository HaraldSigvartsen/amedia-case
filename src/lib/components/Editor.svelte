<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import ChatPanel from '#lib/components/ChatPanel.svelte';
	import PreviewPane from '#lib/components/PreviewPane.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
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

	async function send(text: string) {
		if (!selected || pending) return;
		const embedId = selected.id;
		const optimistic: ChatMessage = {
			id: -Date.now(),
			role: 'user',
			content: text,
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
				body: JSON.stringify({ embedId, message: text })
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
				};
				if (name === 'delta' && payload.text) {
					accumulated += payload.text;
					streamingText = accumulated;
				} else if (name === 'html' && payload.html && selected) {
					updateSelected({ html: payload.html });
				} else if (name === 'done' && selected) {
					const assistant: ChatMessage = {
						id: -Date.now() - 1,
						role: 'assistant',
						content: accumulated,
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
		<p class="font-serif text-xl">Amedia</p>
		<div
			class="flex rounded-xl border border-line bg-panel p-1"
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

	<div class="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_minmax(340px,420px)]">
		<div class="{tab === 'list' ? 'flex' : 'hidden'} min-h-0 lg:flex">
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

		<div class="{tab === 'chat' ? 'flex' : 'hidden'} min-h-0 lg:flex">
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
					<p class="max-w-md text-center leading-7 text-[#5c574f]">
						Lag en ny embed, og beskriv hva leseren skal se.
					</p>
				</div>
			{/if}
		</div>

		<div class="{tab === 'preview' ? 'flex' : 'hidden'} min-h-0 lg:flex">
			<PreviewPane
				embedId={selected?.id ?? null}
				title={selected?.title ?? 'Embed'}
				html={selected?.html ?? ''}
				published={selected?.published ?? false}
				streaming={pending}
			/>
		</div>
	</div>
</div>
