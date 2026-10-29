<script lang="ts">
	import { visibleAssistantText } from '#lib/html.ts';
	import type { ChatMessage } from '#lib/types.ts';

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
		onSend: (text: string) => void;
		onTitle: (title: string) => void;
		onTogglePublish: () => void;
	} = $props();

	let editedTitle = $state<string | null>(null);
	let draftMessage = $state('');
	let log = $state<HTMLDivElement | null>(null);
	let composer = $state<HTMLFormElement | null>(null);
	const shownTitle = $derived(editedTitle ?? title);

	$effect(() => {
		const count = messages.length;
		const text = streamingText;
		if (log && (count >= 0 || text.length >= 0)) log.scrollTo({ top: log.scrollHeight });
	});

	function assistantCopy(content: string): string {
		const visible = visibleAssistantText(content);
		if (visible) return visible;
		if (content.includes('<html') || content.includes('```')) return 'Embeden er oppdatert.';
		return content.trim();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = draftMessage.trim();
		if (!text || pending || disabled) return;
		draftMessage = '';
		onSend(text);
	}

	function onComposerKey(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			composer?.requestSubmit();
		}
	}
</script>

<section class="flex h-full min-h-0 w-full flex-col bg-paper">
	<header class="flex items-center gap-3 border-b border-line px-5 py-4">
		<div class="min-w-0 flex-1">
			<label class="text-xs tracking-[0.14em] text-[#5c574f] uppercase" for="embed-title"
				>Tittel</label
			>
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
			class="shrink-0 rounded-xl border border-line bg-panel px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
			disabled={disabled || pending}
			onclick={onTogglePublish}
		>
			{published ? 'Avpubliser' : 'Publiser'}
		</button>
	</header>

	<div
		bind:this={log}
		class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6"
		aria-live="polite"
	>
		{#if messages.length === 0 && !streamingText}
			<p class="max-w-xl text-base leading-7 text-[#5c574f]">
				Beskriv embeden du vil lage. For eksempel: en teller med tre tall for kommunevalget, store
				tall og en kort forklaring.
			</p>
		{/if}

		{#each messages as message (message.id)}
			{#if message.role === 'user'}
				<div class="flex justify-end">
					<p class="max-w-[42rem] rounded-2xl bg-ink px-4 py-3 leading-7 text-white">
						{message.content}
					</p>
				</div>
			{:else}
				<p class="max-w-[42rem] leading-7">{assistantCopy(message.content)}</p>
			{/if}
		{/each}

		{#if streamingText || pending}
			<p class="max-w-[42rem] leading-7 text-[#5c574f]">
				{visibleAssistantText(streamingText) || 'Skriver…'}
			</p>
		{/if}
	</div>

	{#if error}
		<p class="px-5 text-sm text-accent" role="alert">{error}</p>
	{/if}

	<form class="border-t border-line px-5 py-4" bind:this={composer} onsubmit={submit}>
		<label class="sr-only" for="composer">Melding</label>
		<div class="rounded-2xl border border-line bg-panel p-3">
			<textarea
				id="composer"
				class="min-h-24 w-full resize-y bg-transparent leading-7 focus-visible:outline-none disabled:opacity-60"
				placeholder="Skriv hva embeden skal vise eller endres til"
				bind:value={draftMessage}
				disabled={pending || disabled}
				onkeydown={onComposerKey}></textarea>
			<div class="mt-2 flex justify-end">
				<button
					type="submit"
					class="rounded-xl bg-accent px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
					disabled={pending || disabled || !draftMessage.trim()}
				>
					Send
				</button>
			</div>
		</div>
	</form>
</section>
