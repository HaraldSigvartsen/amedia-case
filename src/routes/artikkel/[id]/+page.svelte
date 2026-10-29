<script lang="ts">
	import { resolve } from '$app/paths';
	import EmbedFrame from '#lib/components/EmbedFrame.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<article class="mx-auto min-h-dvh max-w-2xl px-6 py-16">
	<p class="text-sm tracking-[0.14em] text-[#5c574f] uppercase">Testartikkel</p>
	<h1 class="mt-3 font-serif text-4xl leading-tight text-balance">
		Slik ser en publisert embed ut i saken
	</h1>
	<p class="mt-6 text-lg leading-8">
		Dette er en vanlig artikkelside. Embeden under ligger i en egen ramme, og rammen er det eneste
		stedet den kan kjøre.
	</p>
	<p class="mt-4 leading-7 text-[#5c574f]">
		Siden rundt embeden skal bli stående. Embeden skal ikke kunne lese cookies, endre denne teksten
		eller sende leseren videre.
	</p>

	<div class="my-10">
		<EmbedFrame id={data.embed.id} title={data.embed.title} src="/view/{data.embed.id}" />
	</div>

	<p class="leading-7">
		Høyden på rammen kommer fra embeden selv. Når innholdet blir høyere, vokser rammen, uten at
		artikkelen gir fra seg tilgang til sitt eget dokument.
	</p>
	<p class="mt-4 leading-7 text-[#5c574f]">
		Denne siden viser bare embeds som er publisert. Utkast forblir hos journalisten som lager dem.
	</p>
	<p class="mt-10">
		<a
			class="text-accent underline decoration-line underline-offset-4"
			href={resolve(`/?id=${data.embed.id}`)}
		>
			Tilbake til desk
		</a>
	</p>
</article>
