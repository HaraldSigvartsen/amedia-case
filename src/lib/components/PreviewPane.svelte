<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { embedSnippet, prepareEmbedDocument } from '#lib/embed-document.ts';
	import EmbedFrame from '#lib/components/EmbedFrame.svelte';

	let {
		embedId,
		title,
		html,
		published,
		streaming
	}: {
		embedId: string | null;
		title: string;
		html: string;
		published: boolean;
		streaming: boolean;
	} = $props();

	let mode = $state<'desktop' | 'mobile'>('desktop');
	let copied = $state(false);

	const prepared = $derived(embedId && html.trim() ? prepareEmbedDocument(html, embedId) : '');
	const viewUrl = $derived(embedId ? `${page.url.origin}/view/${embedId}` : '');

	async function copySnippet() {
		if (!embedId) return;
		await navigator.clipboard.writeText(embedSnippet(page.url.origin, embedId, title));
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<section class="flex h-full min-h-0 w-full flex-col border-line bg-[#ebe6dc] lg:border-l">
	<header class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
		<div>
			<h2 class="text-sm tracking-[0.14em] text-[#5c574f] uppercase">Forhåndsvisning</h2>
			{#if streaming}
				<p class="mt-1 text-xs text-[#5c574f]">Oppdateres når HTML-en er komplett</p>
			{/if}
		</div>
		<div class="flex rounded-xl border border-line bg-panel p-1" role="group" aria-label="Bredde">
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {mode ===
				'desktop'
					? 'bg-ink text-white'
					: ''}"
				aria-pressed={mode === 'desktop'}
				onclick={() => (mode = 'desktop')}
			>
				Desktop
			</button>
			<button
				type="button"
				class="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {mode ===
				'mobile'
					? 'bg-ink text-white'
					: ''}"
				aria-pressed={mode === 'mobile'}
				onclick={() => (mode = 'mobile')}
			>
				Mobil
			</button>
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-auto px-5 pb-5">
		<div
			class={mode === 'mobile' ? 'mx-auto w-[375px] max-w-full border border-line bg-white' : ''}
		>
			{#if prepared && embedId}
				<EmbedFrame id={embedId} {title} srcdoc={prepared} />
			{:else}
				<div class="grid min-h-64 place-items-center bg-panel px-6 text-center">
					<p class="max-w-xs leading-7 text-[#5c574f]">
						Forhåndsvisningen vises når modellen har levert et HTML-dokument.
					</p>
				</div>
			{/if}
		</div>
	</div>

	{#if published && embedId}
		<div class="border-t border-line bg-panel px-5 py-4">
			<p class="text-xs tracking-[0.14em] text-[#5c574f] uppercase">Publisert</p>
			<p class="mt-2 truncate text-sm">{viewUrl}</p>
			<div class="mt-3 flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-xl bg-ink px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onclick={copySnippet}
				>
					{copied ? 'Kopiert' : 'Kopier kodesnutt'}
				</button>
				<a
					class="rounded-xl border border-line px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					href={resolve('/artikkel/[id]', { id: embedId })}
				>
					Åpne testartikkel
				</a>
			</div>
		</div>
	{/if}
</section>
