# Lag embeds

En journalist beskriver en embed i chatten. Modellen svarer med et selvstendig HTML-dokument, forhåndsvisningen oppdateres, og en publisert embed kan limes inn i en artikkel uten å lese cookies, endre siden rundt seg eller sende leseren videre.

## Kom i gang

Krav: Docker, eller Node 22+ og pnpm.

```bash
cp .env.example .env
# lim inn nøkkelen du fikk i LLM_API_KEY
docker compose up --build
```

`.env.example` setter allerede Anthropic og `claude-sonnet-5`. Du trenger ikke velge modell.

Appen lytter på http://localhost:3000. SQLite-filen ligger i Docker-volumet `embed-data`.

Uten Docker:

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Da lagres databasen i `data/embeds.db`.

## Miljøvariabler

| Variabel        | Betydning                                                                        |
| --------------- | -------------------------------------------------------------------------------- |
| `LLM_PROVIDER`  | `anthropic` i eksempelfilen. `openai` virker også.                              |
| `LLM_API_KEY`   | Nøkkelen du fikk. Uten nøkkel kan du åpne appen, men chatten svarer med en feil. |
| `LLM_MODEL`     | `claude-sonnet-5` i eksempelfilen. Tomt felt bruker den for Anthropic.           |
| `LLM_BASE_URL`  | Valgfri OpenAI-kompatibel base-URL, uten avsluttende skråstrek.                  |
| `DATABASE_PATH` | SQLite-fil. Compose setter `/data/embeds.db`.                                    |

## Bruk

Skriv inn et navn. Det lagres i en cookie og er ikke innlogging. Embedene knyttes til navnet i denne nettleseren.

Chatten ligger i midten, «Mine embeds» til venstre og forhåndsvisning til høyre. På smal skjerm bytter du mellom Mine, Chat og Visning. Forhåndsvisningen har Desktop og Mobil (375 px).

Når embeden er publisert, kopierer du kodesnutten eller åpner testartikkelen på `/artikkel/[id]`.

## Sikkerhet for publiserte embeds

Leseren får embeden i en iframe med `sandbox="allow-scripts"`. `allow-same-origin` og `allow-top-navigation` er ikke satt, så dokumentet har opaque origin og kan ikke lese sidens cookies eller navigere vinduet. `/view/[id]` sender i tillegg en streng CSP: ingen nettverkskall, ingen skjema, ingen nøstede rammer. Høyden kommer fra `postMessage`, og foreldresiden godtar bare meldinger fra iframens `contentWindow` med origin `"null"` og riktig embed-id.

Utkast kan forhåndsvises av eieren. Testartikkelen viser bare publiserte embeds.

## Tester

```bash
pnpm test
pnpm check
```

Testene dekker eierskap i databasen, uthenting av HTML fra modellsvaret, CSP-injeksjon og validering av høyde-meldinger.

## Utvikling

Kjerneflyten er chat, lagring, forhåndsvisning og publisering. Chatten tar imot bilde, tekstfil og tale. Manuell HTML-redigering er utelatt.
