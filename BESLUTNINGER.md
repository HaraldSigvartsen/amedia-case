# Beslutninger

SvelteKit 3 og Tailwind v4 kom fra `sv create` i oktober 2026. Adapter og kompilator settes i `vite.config.ts`. Delte moduler importeres med `#lib` og filendelse. Det er rammeverkets nåværende oppsett, ikke et ekstra abstraksjonslag.

SQLite går via `node:sqlite` (`DatabaseSync`). Oppgaven tillot `better-sqlite3` eller filer. Innebygd SQLite slipper native bygg i Docker og holder avhengighetslisten tom utover rammeverket. Filen ligger i `./data` lokalt og i et Compose-volum i containeren.

LLM-et velges med `LLM_PROVIDER` og én nøkkel. OpenAI bruker chat completions, Anthropic bruker Messages, begge med SSE. Tom nøkkel stopper ikke appen. Tidligere HTML sendes én gang i systemprompten. Samtalehistorikken sendes som kommentarer, maks 20 meldinger, så ikke hele HTML-en gjentas i hvert tur. Svaret må være et komplett dokument. Klienten oppdaterer forhåndsvisningen først når `</html>` er på plass.

Brukeren er et navn i en httpOnly-cookie. Det er bevisst ikke innlogging. Alle spørringer filtrerer på eier, og upubliserte embeds returneres ikke til andre. Adapter-node antar https når ingen protokoll-header er satt. Da blir innloggingsskjemaet avvist som cross-site, og kodesnutten får feil origin. Docker-prosessen setter derfor `x-forwarded-proto: http` før rammeverket leser forespørselen.

Publisert HTML kjøres bare i `sandbox="allow-scripts"`. CSP blokkerer nettverk, skjema og nøstede rammer. Høyde-scriptet injiseres av serveren, ikke av modellen. Det måler innholdets boks, ikke `scrollHeight`: i en iframe er `scrollHeight` minst like høy som vinduet, så en kort embed som lastes inn i en 240 px høy ramme ellers blir stående på 240. Forelderen sjekker `event.source`, origin `"null"` og embed-id. Testartikkelen embedder `/view/[id]`, mens editoren bruker `srcdoc` av det samme klargjorte dokumentet.

Streaming er med og delvis gjennomført, mest ideelt ville vært å ha bygget en html fil journalistene selv kunne redigere selv og kunne tweake på av HTML og slikt. Fikk også startet smått på vedlegg og opptakk slik at journalistene ikke trengte å skrive alt, til tider så kan det være nyttig å heller kunne snakke muntlig og få det transkribert automatisk. Transkriberingen er ikke testet og ikke verifisert at den funker. 
