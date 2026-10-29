# Arbeidslogg

## Oppsett

Prosjektet ligger i `Documents/Amedia/lag-embeds`.

SvelteKit 3 (generert med `sv create`) bruker Vite-plugin for adapter, `#lib`-importer med filendelse, og `$app/env/private` via `src/env.ts`. Tailwind CSS v4 ligger i `src/routes/layout.css`.

SQLite går gjennom Node sin innebygde `node:sqlite` (`DatabaseSync`), ikke `better-sqlite3`. Det fjerner native bygg i Docker og matcher Node 22/26.

Orkestrerer: Grok. Sub-agenter får disjunkte filer og en låst kontrakt. De committer ikke.

## Sub-agenter

Kontekst som ble gitt: SvelteKit 3-regler (`#lib` med filendelse, `$app/env/private`, `Response.json`), at nøkkelen kan mangle, at alle spørringer filtrerer på eier, og at publisert HTML bare skal kjøre i `sandbox="allow-scripts"`. Sub-agentene committer ikke. Orkestratoren leser filene og integrerer dem.

- Persistens (generell agent): `node:sqlite`, embed-API, innlogging via cookie, tester. Leverte filer som ble beholdt. Fem tester grønne.
- LLM (generell agent): norsk systemprompt, streaming mot OpenAI og Anthropic, uthenting av HTML, `POST /api/chat`. Leverte filer som ble beholdt. Seks HTML-tester grønne. Agenten påpekte at cookien ikke er innlogging, så den som når serveren kan bruke `LLM_API_KEY`.
- Sikkerhet og UI (Svelte-spesialister): fikk samme kontrakt, men skrev ingen filer. De ble stoppet. Orkestratoren skrev `prepareEmbedDocument`, viewer, testartikkel og desk-komponentene selv, og kjørte Svelte autofixer på komponentene.

## Etterpå

Første måling av testartikkelen ble stående på 240 px. Editorens `srcdoc` krympet, fordi scriptet rakk å måle før rammen hadde fått høyde. `/view/[id]` lastes inn i en ramme som allerede er 240 px, og `documentElement.scrollHeight` er da minst vindushøyden. Høydemålingen bruker derfor innholdets boks. Verifisert i nettleseren: kort embed 51 px, høy blokk 656 px, tilbake til 51 px. Sandbox forble `allow-scripts`.

`pnpm test` (16), `pnpm check` og `pnpm exec eslint src` er grønne. `pnpm build` går gjennom.

`docker compose build` lager imaget på `node:22`. `node:sqlite` finnes der og skriver en embed. Adapter-node antar https, så `node build/index.js` avviste innloggingsskjemaet (`Cross-site POST form submissions are forbidden`). `scripts/serve.mjs` setter protokollen til http. I imaget gir innlogging 200, opprettelse 201, og kodesnutten peker på http.
