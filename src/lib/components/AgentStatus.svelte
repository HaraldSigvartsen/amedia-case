<script lang="ts">
	let { phase, label }: { phase: 'thinking' | 'writing'; label?: string } = $props();
	const text = $derived(label ?? (phase === 'writing' ? 'Skriver' : 'Tenker'));
</script>

<p class="agent-status" data-phase={phase}>
	<span class="agent-mark" aria-hidden="true"><span></span><span></span></span>
	<span>{text}</span>
</p>
