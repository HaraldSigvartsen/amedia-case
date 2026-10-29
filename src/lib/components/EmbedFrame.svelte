<script lang="ts">
	import { readEmbedHeightMessage } from '#lib/embed-document.ts';

	let {
		id,
		title,
		src,
		srcdoc,
		class: className = ''
	}: {
		id: string;
		title: string;
		src?: string;
		srcdoc?: string;
		class?: string;
	} = $props();

	let frame = $state<HTMLIFrameElement | null>(null);
	let height = $state(240);
	const doc = $derived(srcdoc?.trim() ? srcdoc : undefined);

	function onMessage(event: MessageEvent) {
		if (event.origin !== 'null') return;
		if (!frame || event.source !== frame.contentWindow) return;
		const next = readEmbedHeightMessage(event.data, id);
		if (next === null) return;
		height = next;
	}
</script>

<svelte:window onmessage={onMessage} />

{#if doc}
	<iframe
		bind:this={frame}
		{title}
		sandbox="allow-scripts"
		referrerpolicy="no-referrer"
		srcdoc={doc}
		class="block w-full border-0 {className}"
		style:height="{height}px"
	></iframe>
{:else}
	<iframe
		bind:this={frame}
		{title}
		sandbox="allow-scripts"
		referrerpolicy="no-referrer"
		{src}
		class="block w-full border-0 {className}"
		style:height="{height}px"
	></iframe>
{/if}
