<script lang="ts">
	import { enhance } from '$app/forms';
	import Editor from '#lib/components/Editor.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const loginMessage = $derived(form && 'message' in form ? form.message : null);
</script>

{#if data.journalist}
	{#key data.embed?.id ?? 'ingen'}
		<Editor
			journalist={data.journalist}
			embeds={data.embeds}
			embed={data.embed}
			missing={data.missing}
		/>
	{/key}
{:else}
	<div class="grid min-h-dvh place-items-center bg-paper px-6 text-ink">
		<form
			class="w-full max-w-md rounded-2xl border border-line bg-panel p-8"
			method="POST"
			action="?/login"
			use:enhance
		>
			<h1 class="font-serif text-4xl leading-none">Lag embeds</h1>
			<p class="mt-4 leading-7 text-[#5c574f]">
				Skriv inn navnet ditt. Det lagres i en cookie i denne nettleseren, og embedene dine knyttes
				til det.
			</p>
			<label class="mt-8 block text-sm" for="name">Navn</label>
			<input
				id="name"
				name="name"
				autocomplete="nickname"
				required
				maxlength="40"
				class="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			/>
			{#if loginMessage}
				<p class="mt-3 text-sm text-accent" role="alert">{loginMessage}</p>
			{/if}
			<button
				type="submit"
				class="mt-6 rounded-xl bg-accent px-4 py-2.5 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				Fortsett
			</button>
		</form>
	</div>
{/if}
