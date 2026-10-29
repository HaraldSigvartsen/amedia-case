# Arbeidslogg

## Oppsett

Prosjektet ligger i `Documents/Amedia/lag-embeds`.

SvelteKit 3 (generert med `sv create`) bruker Vite-plugin for adapter, `#lib`-importer med filendelse, og `$app/env/private` via `src/env.ts`. Tailwind CSS v4 ligger i `src/routes/layout.css`.

SQLite går gjennom Node sin innebygde `node:sqlite` (`DatabaseSync`), ikke `better-sqlite3`. Det fjerner native bygg i Docker og matcher Node 22/26.

Orkestrerer: Grok. Sub-agenter får disjunkte filer og en låst kontrakt. De committer ikke.

## Sub-agenter

Kontekst som gis til alle: SvelteKit 3-regler, stier, eierskap, at nøkkelen kan mangle, og at publiserte embeds skal i sandkasse uten same-origin.

- Persistens: database, session-cookie, embed-API, `+page.server.ts`, tester.
- LLM: prompt, streaming, HTML-uthenting, `POST /api/chat`, tester.
- Sikkerhet: `prepareEmbedDocument`, sandboxed iframe, `/view/[id]`, testartikkel, tester.
- UI: sidebar, chat, forhåndsvisning, mobil/desktop, publiseringsfelt.
