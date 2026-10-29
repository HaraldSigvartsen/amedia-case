<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EmbedSummary } from '#lib/types.ts';

	let {
		embeds,
		activeId,
		journalist,
		creating,
		onCreate,
		onRename,
		onDelete
	}: {
		embeds: EmbedSummary[];
		activeId: string | null;
		journalist: string;
		creating: boolean;
		onCreate: () => void;
		onRename: (id: string, title: string) => void;
		onDelete: (id: string) => void;
	} = $props();

	function relativeTime(iso: string): string {
		const delta = Date.now() - new Date(iso).getTime();
		const minutes = Math.round(delta / 60000);
		if (!Number.isFinite(minutes) || minutes < 1) return 'nå';
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours} t`;
		const days = Math.round(hours / 24);
		if (days < 7) return `${days} d`;
		return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(
			new Date(iso)
		);
	}

	function commitTitle(id: string, value: string, previous: string) {
		const title = value.trim();
		if (!title || title === previous) return;
		onRename(id, title);
	}
</script>

<aside class="flex h-full min-h-0 w-full flex-col bg-paper">
	<div class="px-5 pt-6 pb-4">
		<p class="font-serif text-2xl leading-none">Amedia</p>
		<p class="mt-2 text-xs tracking-[0.16em] text-[#5c574f] uppercase">Embed-desk</p>
		<button
			type="button"
			class="mt-5 w-full rounded-xl bg-accent px-3 py-2.5 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
			disabled={creating}
			onclick={onCreate}
		>
			{creating ? 'Oppretter…' : 'Ny embed'}
		</button>
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Mine embeds">
		{#if embeds.length === 0}
			<p class="px-2 text-sm leading-6 text-[#5c574f]">Ingen embeds ennå.</p>
		{:else}
			<ul class="flex flex-col gap-1">
				{#each embeds as embed (embed.id)}
					<li class="rounded-xl {embed.id === activeId ? 'border-l-2 border-accent bg-white' : ''}">
						{#if embed.id === activeId}
							<div class="px-3 py-3">
								<label class="sr-only" for="title-{embed.id}">Tittel</label>
								<input
									id="title-{embed.id}"
									class="w-full bg-transparent text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									value={embed.title}
									maxlength="80"
									onblur={(event) => commitTitle(embed.id, event.currentTarget.value, embed.title)}
									onkeydown={(event) => {
										if (event.key === 'Enter') event.currentTarget.blur();
									}}
								/>
								<p class="mt-1 text-xs text-[#5c574f]">
									{relativeTime(embed.updatedAt)}
									{#if embed.published}
										· Publisert
									{/if}
								</p>
								<button
									type="button"
									class="mt-2 text-xs text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									onclick={() => {
										if (confirm('Slette denne embeden?')) onDelete(embed.id);
									}}
								>
									Slett
								</button>
							</div>
						{:else}
							<a
								class="block rounded-xl px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								href={resolve(`/?id=${embed.id}`)}
							>
								<span class="block truncate text-sm">{embed.title}</span>
								<span class="mt-1 block text-xs text-[#5c574f]">
									{relativeTime(embed.updatedAt)}
									{#if embed.published}
										· Publisert
									{/if}
								</span>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<form method="POST" action="?/logout" class="border-t border-line px-5 py-4">
		<p class="truncate text-sm">{journalist}</p>
		<button
			type="submit"
			class="mt-2 text-sm text-[#5c574f] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
		>
			Logg ut
		</button>
	</form>
</aside>
