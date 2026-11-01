<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { embedSnippet, prepareEmbedDocument } from '#lib/embed-document.ts';
	import AgentStatus from '#lib/components/AgentStatus.svelte';
	import EmbedFrame from '#lib/components/EmbedFrame.svelte';
	import WorkFile from '#lib/components/WorkFile.svelte';
	import { workTrace } from '#lib/html.ts';

	let {
		embedId,
		title,
		html,
		published,
		streaming,
		streamingText = ''
	}: {
		embedId: string | null;
		title: string;
		html: string;
		published: boolean;
		streaming: boolean;
		streamingText?: string;
	} = $props();

	let mode = $state<'desktop' | 'mobile'>('desktop');
	let copied = $state(false);
	let stage = $state<HTMLDivElement | null>(null);
	let stageWidth = $state(0);

	const prepared = $derived(embedId && html.trim() ? prepareEmbedDocument(html, embedId) : '');
	const trace = $derived(workTrace(streamingText));
	const viewportLabel = $derived(
		mode === 'mobile' ? '375 px' : stageWidth > 0 ? `${stageWidth} px` : ''
	);

	$effect(() => {
		const node = stage;
		if (!node) return;
		const measure = () => {
			stageWidth = Math.round(node.getBoundingClientRect().width);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	});
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

<section class="flex h-full min-h-0 w-full flex-col border-line bg-paper">
	{#if streaming}
		<div class="agent-rail" aria-hidden="true"></div>
	{/if}
	<header class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
		<div>
			<div class="flex items-baseline gap-2">
				<h2 class="text-sm text-muted">Forhåndsvisning</h2>
				{#if viewportLabel}
					<p class="text-sm text-muted">{viewportLabel}</p>
				{/if}
			</div>
			{#if streaming}
				<div class="mt-2">
					<AgentStatus phase={trace.phase} label={trace.label} />
				</div>
			{/if}
		</div>
		<div class="flex rounded-lg border border-line bg-panel p-1" role="group" aria-label="Bredde">
			<button
				type="button"
				class="grid size-9 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {mode ===
				'desktop'
					? 'bg-ink text-white'
					: ''}"
				aria-pressed={mode === 'desktop'}
				aria-label="Desktop"
				title="Desktop"
				onclick={() => (mode = 'desktop')}
			>
				<svg
					viewBox="0 0 24 24"
					class="size-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"
				>
					<rect x="3" y="4" width="18" height="12" rx="2" />
					<path stroke-linecap="round" d="M8 20h8M12 16v4" />
				</svg>
			</button>
			<button
				type="button"
				class="grid size-9 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {mode ===
				'mobile'
					? 'bg-ink text-white'
					: ''}"
				aria-pressed={mode === 'mobile'}
				aria-label="Mobil"
				title="Mobil"
				onclick={() => (mode = 'mobile')}
			>
				<svg
					viewBox="0 0 24 24"
					class="size-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"
				>
					<rect x="8" y="2.5" width="8" height="19" rx="2" />
					<path stroke-linecap="round" d="M11 18.5h2" />
				</svg>
			</button>
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-auto px-5 pb-5">
		<div
			bind:this={stage}
			class={mode === 'mobile'
				? 'mx-auto w-[375px] max-w-full border border-line bg-white'
				: 'w-full'}
		>
			{#if prepared && embedId}
				<EmbedFrame id={embedId} {title} srcdoc={prepared} />
			{:else if streaming}
				<WorkFile {trace} lines={28} />
			{:else}
				<div class="grid min-h-64 place-items-center bg-panel px-6 text-center">
					<p class="max-w-xs leading-7 text-muted">
						Forhåndsvisningen vises når modellen har levert et HTML-dokument.
					</p>
				</div>
			{/if}
		</div>
	</div>

	{#if published && embedId}
		<div class="border-t border-line bg-panel px-5 py-4">
			<p class="text-sm text-ok">Publisert</p>
			<p class="mt-2 truncate text-sm">{viewUrl}</p>
			<div class="mt-3 flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-lg bg-ink px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onclick={copySnippet}
				>
					{copied ? 'Kopiert' : 'Kopier kodesnutt'}
				</button>
				<a
					class="rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					href={resolve('/artikkel/[id]', { id: embedId })}
				>
					Åpne testartikkel
				</a>
			</div>
		</div>
	{/if}
</section>
