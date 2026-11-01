<script lang="ts">
	import { onDestroy } from 'svelte';
	import AgentStatus from '#lib/components/AgentStatus.svelte';
	import WorkFile from '#lib/components/WorkFile.svelte';
	import { attachmentFromBytes, type ChatAttachment } from '#lib/attachments.ts';
	import { visibleAssistantText, workTrace } from '#lib/html.ts';
	import type { ChatMessage } from '#lib/types.ts';

	type SpeechAlternative = { transcript: string };
	type SpeechResult = { isFinal: boolean } & Record<number, SpeechAlternative>;
	type SpeechSession = {
		lang: string;
		continuous: boolean;
		interimResults: boolean;
		start: () => void;
		stop: () => void;
		onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
		onerror: ((event: { error: string }) => void) | null;
		onend: (() => void) | null;
	};

	let {
		title,
		published,
		messages,
		streamingText,
		pending,
		error,
		disabled,
		onSend,
		onTitle,
		onTogglePublish
	}: {
		title: string;
		published: boolean;
		messages: ChatMessage[];
		streamingText: string;
		pending: boolean;
		error: string | null;
		disabled: boolean;
		onSend: (text: string, attachments: ChatAttachment[]) => void;
		onTitle: (title: string) => void;
		onTogglePublish: () => void;
	} = $props();

	let editedTitle = $state<string | null>(null);
	let draftMessage = $state('');
	let files = $state<ChatAttachment[]>([]);
	let attachError = $state<string | null>(null);
	let listening = $state(false);
	let log = $state<HTMLDivElement | null>(null);
	let composer = $state<HTMLFormElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let recognition: SpeechSession | null = null;
	let followTail = $state(true);
	let leftTail = false;
	let movingTail = false;
	const shownTitle = $derived(editedTitle ?? title);
	const working = $derived(pending || streamingText.length > 0);
	const trace = $derived(workTrace(streamingText));

	function tailGap(node: HTMLElement): number {
		return node.scrollHeight - node.scrollTop - node.clientHeight;
	}

	function onLogWheel(event: WheelEvent) {
		if (event.deltaY < 0) {
			followTail = false;
			leftTail = true;
		}
	}

	function onLogScroll() {
		if (movingTail || !log) return;
		const nearTail = tailGap(log) < 80;
		if (leftTail) {
			if (!nearTail) return;
			leftTail = false;
		}
		followTail = nearTail;
	}

	onDestroy(() => recognition?.stop());

	$effect(() => {
		if (!followTail) return;
		const node = log;
		if (!node) return;
		// Keep the latest line in view while a reply arrives, unless the reader has moved up.
		void messages.length;
		void streamingText;
		movingTail = true;
		node.scrollTop = node.scrollHeight;
		movingTail = false;
	});

	function assistantCopy(content: string): string {
		const visible = visibleAssistantText(content);
		if (visible) return visible;
		if (content.includes('<html') || content.includes('```')) return 'Embeden er oppdatert.';
		return content.trim();
	}

	function stopSpeech() {
		recognition?.stop();
		listening = false;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = draftMessage.trim();
		if ((!text && files.length === 0) || pending || disabled) return;
		const attached = files;
		draftMessage = '';
		files = [];
		attachError = null;
		followTail = true;
		leftTail = false;
		stopSpeech();
		onSend(text, attached);
	}

	async function onFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const picked = [...(input.files ?? [])];
		input.value = '';
		attachError = null;
		for (const file of picked) {
			if (files.length >= 3) {
				attachError = 'Maks tre filer.';
				break;
			}
			const read = attachmentFromBytes(
				file.name,
				file.type,
				new Uint8Array(await file.arrayBuffer())
			);
			if (typeof read === 'string') {
				attachError = read;
				continue;
			}
			files = [...files, read];
		}
	}

	function toggleSpeech() {
		const root = window as Window & {
			SpeechRecognition?: new () => SpeechSession;
			webkitSpeechRecognition?: new () => SpeechSession;
		};
		const Ctor = root.SpeechRecognition ?? root.webkitSpeechRecognition;
		if (!Ctor) {
			attachError = 'Denne nettleseren kan ikke ta opp tale.';
			return;
		}
		if (listening) {
			stopSpeech();
			return;
		}
		const session = new Ctor();
		session.lang = 'nb-NO';
		session.continuous = true;
		session.interimResults = false;
		session.onresult = (event) => {
			let said = '';
			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				const result = event.results[index];
				if (result?.isFinal) said += result[0]?.transcript ?? '';
			}
			const next = said.trim();
			if (!next) return;
			draftMessage = draftMessage.trim() ? `${draftMessage.trim()} ${next}` : next;
		};
		session.onerror = (event) => {
			listening = false;
			if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
				attachError = 'Fikk ikke tilgang til mikrofonen.';
			} else if (event.error !== 'aborted' && event.error !== 'no-speech') {
				attachError = 'Opptaket stoppet.';
			}
		};
		session.onend = () => {
			listening = false;
		};
		recognition = session;
		attachError = null;
		try {
			session.start();
			listening = true;
		} catch {
			listening = false;
			attachError = 'Opptaket stoppet.';
		}
	}

	function onComposerKey(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			composer?.requestSubmit();
		}
	}
</script>

<section class="flex h-full min-h-0 w-full flex-col bg-panel">
	{#if working}
		<div class="agent-rail" aria-hidden="true"></div>
	{/if}
	<header class="flex items-center gap-3 border-b border-line px-5 py-4">
		<div class="min-w-0 flex-1">
			<label class="text-sm text-muted" for="embed-title">Tittel</label>
			<input
				id="embed-title"
				class="mt-1 w-full bg-transparent text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
				value={shownTitle}
				maxlength="80"
				{disabled}
				oninput={(event) => (editedTitle = event.currentTarget.value)}
				onblur={() => {
					const next = shownTitle.trim();
					editedTitle = null;
					if (next && next !== title) onTitle(next);
				}}
			/>
		</div>
		<button
			type="button"
			class="shrink-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
			disabled={disabled || pending}
			onclick={onTogglePublish}
		>
			{published ? 'Avpubliser' : 'Publiser'}
		</button>
	</header>

	<div
		bind:this={log}
		class="chat-log min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6"
		onwheel={onLogWheel}
		onscroll={onLogScroll}
	>
		{#if messages.length === 0 && !working}
			<p class="max-w-xl text-base leading-7 text-muted">
				Beskriv embeden. Jeg lager den, og du kan be meg endre den etterpå. For eksempel en teller
				med tre tall for kommunevalget.
			</p>
		{/if}

		{#each messages as message (message.id)}
			{#if message.role === 'user'}
				<div class="amedia-rise flex justify-end">
					<p class="max-w-[42rem] rounded-lg bg-ink px-4 py-3 leading-7 text-white">
						{message.content}
					</p>
				</div>
			{:else}
				<p class="amedia-rise max-w-[42rem] leading-7">{assistantCopy(message.content)}</p>
			{/if}
		{/each}

		{#if working}
			<div class="amedia-rise max-w-[42rem]">
				<div
					class="inline-flex rounded-lg bg-accent-soft px-3 py-2"
					aria-live="polite"
					aria-atomic="true"
				>
					<AgentStatus phase={trace.phase} label={trace.label} />
				</div>
				{#if trace.note}
					<p class="mt-3 leading-7">{trace.note}</p>
				{/if}
				<ol class="mt-3 space-y-1 text-sm">
					{#each trace.steps as step, index (step.id)}
						<li class={index === trace.steps.length - 1 ? '' : 'text-muted'}>{step.label}</li>
					{/each}
				</ol>
				<div class="mt-3">
					<WorkFile {trace} />
				</div>
			</div>
		{/if}
	</div>

	{#if error}
		<p class="px-5 text-sm text-accent" role="alert">{error}</p>
	{/if}
	{#if attachError}
		<p class="px-5 text-sm text-accent" role="alert">{attachError}</p>
	{/if}

	<form class="border-t border-line px-5 py-4" bind:this={composer} onsubmit={submit}>
		<label class="sr-only" for="composer">Melding</label>
		<div class="rounded-lg border border-line bg-paper p-3">
			<textarea
				id="composer"
				class="min-h-24 w-full resize-y bg-transparent leading-7 focus-visible:outline-none disabled:opacity-60"
				placeholder="Skriv hva embeden skal vise eller endres til"
				bind:value={draftMessage}
				disabled={pending || disabled}
				onkeydown={onComposerKey}></textarea>
			{#if files.length > 0}
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each files as file, index (file.name + index)}
						<li
							class="flex max-w-full items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1 text-sm"
						>
							<span class="max-w-48 truncate">{file.name}</span>
							<button
								type="button"
								class="grid size-6 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								aria-label="Fjern {file.name}"
								onclick={() => (files = files.filter((_, item) => item !== index))}
							>
								<svg
									viewBox="0 0 24 24"
									class="size-3.5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									aria-hidden="true"
								>
									<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="mt-2 flex items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<input
						bind:this={fileInput}
						class="sr-only"
						type="file"
						tabindex={-1}
						aria-hidden="true"
						accept="image/jpeg,image/png,image/gif,image/webp,.txt,.csv,.md,text/plain,text/csv,text/markdown"
						multiple
						onchange={onFiles}
					/>
					<button
						type="button"
						class="grid size-9 place-items-center rounded-lg border border-line bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
						aria-label="Last opp fil"
						title="Last opp fil"
						disabled={pending || disabled}
						onclick={() => fileInput?.click()}
					>
						<svg
							viewBox="0 0 24 24"
							class="size-5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 12.5V7.8a4 4 0 0 1 8 0v8.2a2.7 2.7 0 0 1-5.4 0V8.5"
							/>
						</svg>
					</button>
					<button
						type="button"
						class="grid size-9 place-items-center rounded-lg border bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 {listening
							? 'border-accent text-accent'
							: 'border-line'}"
						aria-label={listening ? 'Stopp opptak' : 'Ta opp tale'}
						aria-pressed={listening}
						title={listening ? 'Stopp opptak' : 'Ta opp tale'}
						disabled={pending || disabled}
						onclick={toggleSpeech}
					>
						<svg
							viewBox="0 0 24 24"
							class="size-5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							aria-hidden="true"
						>
							<rect x="9" y="3" width="6" height="11" rx="3" />
							<path stroke-linecap="round" d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21" />
						</svg>
					</button>
					<div aria-hidden="true">
						{#if working}
							<AgentStatus phase={trace.phase} label={trace.label} />
						{/if}
					</div>
				</div>
				<button
					type="submit"
					class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
					disabled={pending || disabled || (!draftMessage.trim() && files.length === 0)}
				>
					Send
				</button>
			</div>
		</div>
	</form>
</section>
