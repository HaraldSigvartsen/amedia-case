<script lang="ts">
	import type { WorkTrace } from '#lib/html.ts';

	let { trace, lines = 14 }: { trace: WorkTrace; lines?: number } = $props();

	const shown = $derived(trace.tail.slice(-lines));
	const start = $derived(Math.max(trace.lineCount - shown.length, 0));
</script>

<div
	class="work-file overflow-hidden rounded-lg border border-line bg-panel"
	data-status={trace.status}
>
	<div class="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm">
		<p>{trace.fileName}</p>
		<p class="text-muted">
			{#if trace.status === 'venter'}
				venter
			{:else}
				{trace.lineCount} {trace.lineCount === 1 ? 'linje' : 'linjer'}
			{/if}
		</p>
	</div>
	{#if shown.length > 0}
		<pre
			class="work-caret max-h-80 overflow-hidden px-3 py-3 text-xs leading-5"
			aria-hidden="true">{shown
				.map((line, index) => `${start + index + 1}  ${line}`)
				.join('\n')}</pre>
	{:else}
		<p class="px-3 py-4 text-sm text-muted">Ingen linjer ennå.</p>
	{/if}
</div>
