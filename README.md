# Study App

Korte, effektive studieøkter på mobilen – i stedet for å scrolle. Første emne er **BØK 3430 Innføring i bedriftsøkonomi og finans** (BI), med pensum fra Terje Berg, «Grunnleggende økonomistyring».

Appen er en PWA: den kan legges på hjemskjermen, virker uten nett og lagrer all fremgang lokalt på telefonen. Ingen innlogging, ingen server.

> **Alt innhold er generert og ikke kontrollert mot pensum.** Bruk «Meld feil» i appen når noe ser galt ut. Notatene finner du under Innstillinger.

## Kom i gang

Krever Node.js 20 eller nyere.

```bash
npm install
npm run dev        # utviklingsserver på http://localhost:5173
npm test           # alle tester
npm run build      # bygger til dist/
```

Ikonene lages med `node scripts/make-icons.mjs`.

## Status

**Fase 1 (MVP) er ferdig:** øktflyt, tre temaer (balanseligningen og transaksjoner, nullpunktsanalyse, nåverdi), regneoppgaver med tilfeldige tall, flervalg, sant/usant, flashcards, FSRS-repetisjon, streak/XP/daglig mål, «Meld feil», mørk modus og PWA.

Fase 2 og 3 er beskrevet i [PLAN.md](PLAN.md).

## Læringsprinsippene i koden

| Prinsipp | Slik er det gjort |
|---|---|
| **Gjenhenting (testing)** | Nesten alt er oppgaver. Forklaringer kommer som korte introkort før nytt stoff og i tilbakemeldingen etter hvert svar. |
| **Spredt repetisjon** | FSRS (`ts-fsrs`) med 90 % ønsket hukommelse, i [scheduler.ts](src/lib/scheduler.ts). Hver økt starter med forfalte kort ([session.ts](src/lib/session.ts)). |
| **Blanding (interleaving)** | Repetisjoner fra alle åpne temaer blandes i hver økt. Full blanding av nytt stoff kommer i fase 2. |
| **Gjennomgått eksempel → egen løsning** | Hver regneoppgave har løsningssteg. «Vis løsning» gir et gjennomgått eksempel, og samme oppgave kommer tilbake med nye tall. Fadede steg kommer i fase 2. |
| **Forklarende tilbakemelding** | Alle feilalternativ har egen forklaring. Regneoppgaver kjenner igjen typiske feil (f.eks. diskontere år 0, glemme varekostnaden) og forklarer akkurat den feilen. |
| **Mestringslæring** | Et kort er *mestret* når det huskes i minst ~10 dager og siste svar var riktig. Temaer med forkunnskaper åpnes når forkunnskapen er godt i gang, men du kan alltid velge et tema selv. |
| **Generering og utdyping** | «Hva skjer hvis …»- og «hvorfor»-spørsmål (f.eks. pris opp → nullpunkt?). |
| **Konkrete eksempler** | Kafé Bønna, sykkelbutikken Tråkk AS, Lillevik Mekaniske og Solkraft AS, med beløp i NOK. |
| **Kognitiv belastning** | Én idé per kort, korte tekster, formler i egne bokser, maks 4–6 nye kort per økt og 20 per dag. |
| **Dobbel koding** | Figurer for balansen (to kolonner), kontantstrøm (tidslinje) og nullpunkt (kostnad-volum-resultat). |
| **Ønsket vanskelighet** | Feil svar kommer tilbake senere i samme økt med nye tall. FSRS holder treffsikkerheten rundt 90 %. Mer finjustering kommer i fase 2. |
| **Metakognisjon** | Flashcards vurderes selv (Glemt/Vanskelig/Bra/Lett). Konfidensvurdering før svar kommer i fase 2. |
| **Sunn spillmekanikk** | Streak med frys (én per 7 dager, maks 2), XP, nivåer, daglig mål. Skjermen «Ferdig for nå» etter hver økt. Ingen varsler, ingen uendelig feed. |

## Innholdet

Alt fagstoff ligger i `content/courses/<emne>/` som YAML-filer. Appen leser alle emnemappene automatisk.

```
content/courses/bok3430/
  course.yaml                       # emnet og delemnene, i rekkefølge
  d1-regnskap/balanseligningen.yaml # ett tema per fil
  d2-kostnad/nullpunkt.yaml
  d3-finans/naverdi.yaml
```

`npm test` sjekker alle filene. Den finner skrivefeil, ukjente variabler og ugyldige referanser. Hver regnemal kjøres med 1000 tilfeldige tallsett, og svaret må stemme med løsningsstegene.

### Se én oppgave

Åpne `http://localhost:5173/#/okt?oppgave=<id>`, f.eks. `#/okt?oppgave=nv-num-nnv3`. Forhåndsvisning lagrer ingenting.

### Oppgavetyper

```yaml
- id: np-fc-db                 # unik i emnet: små bokstaver, tall, bindestrek
  type: flashcard
  front: Dekningsbidrag per enhet
  back: DB = P − VEK

- id: np-mcq-pris-opp
  type: mcq
  skillLevel: 2                # 1 = bruk verktøyet, 2 = velg verktøyet, 3 = rotete case
  prompt: Hva skjer med nullpunktsmengden hvis prisen øker?
  options:
    - text: Den synker
      correct: true
      feedback: Høyere pris gir høyere DB per enhet.
    - text: Den øker
      feedback: Forklaring av feilen …

- id: nv-tf-nnv0
  type: truefalse
  statement: NNV = 0 betyr at prosjektet gir akkurat avkastningskravet.
  answer: true
  explanation: Ved NNV = 0 er kravet lik internrenten.
```

### Regneoppgaver med tilfeldige tall

En regneoppgave er en `numeric` med variabler. Tallene trekkes på nytt hver gang, og svar og løsning regnes ut av formlene:

```yaml
- id: np-num-mengde
  type: numeric
  vars:
    P: { min: 400, max: 900, step: 25 }       # eller { choices: [20, 25, 30] }
    VEK: { min: 150, max: 500, step: 25 }
    FK: { min: 200000, max: 900000, step: 10000 }
  derived:                                     # regnes ut i rekkefølge
    DB: P - VEK
    X0: FK / DB
  constraints: ["DB >= 100"]                   # nye tall trekkes til alle krav holder
  prompt: Prisen er {{P}} kr … Hvor mange må selges for å gå i null?
  answer: { expr: X0, unit: stk, decimals: 0 }
  tolerance: { abs: 1, rel: 0 }                # standard: ±1 i siste desimal eller ±0,5 %
  steps:
    - "DB = {{P}} − {{VEK}} = {{DB}} kr"
    - "Nullpunkt = {{FK}} / {{DB}} = {{X0:1}}" # :1 = én desimal
  misconceptions:                              # typiske feil gir målrettet forklaring
    - expr: FK / P
      feedback: Du delte på prisen. Bruk dekningsbidraget.
```

- `{{X}}` setter inn et tall i norsk format. `{{X:4}}` gir fire desimaler, og du kan regne direkte: `{{P - VEK}}`.
- Formlene støtter `+ − * / ^`, parenteser, lister `[a, b]`, sammenligninger og funksjonene `df(r, n)`, `pv(K, r, n)`, `fv(K, r, n)`, `af(r, n)` (annuitetsfaktor), `npv(r, [K0, K1, …])`, `irr([…])`, `effRate(r, m)`, `round(x, d)`, `ceil`, `floor`, `abs`, `min`, `max`, `sum`.
- Renter skrives som prosent i teksten og regnes som desimaltall: `R: {min: 4, max: 10, step: 1}` og `r: R / 100`.
- Flervalg kan også bruke variabler. Da kan `correct` være en formel, f.eks. `correct: NNV > 0`.
- Svar i prosent oppgis med `unit: "%"` og formelen gir prosenttallet (12,5, ikke 0,125).

### Figurer

Legg til `figure:` på en oppgave (vises i tilbakemeldingen, eller med oppgaven med `figureShow: prompt`) eller på et introkort:

```yaml
figure: { kind: timeline, flows: "[-I, K1, K2, K3]", rate: r }
figure: { kind: cvp, price: P, vc: VEK, fc: FK, volume: X }
figure:
  kind: balance
  assets: [{ label: Bank, value: BANK }]
  claims: [{ label: Egenkapital, value: EK, type: ek }, { label: Banklån, value: BL, type: gjeld }]
```

### Introkort og tekstformat

Introkort (`intro:`) vises rett før oppgaven i `before:`, første gang den dukker opp. I alle tekster gir `**fet**` fet skrift, linjer som starter med `- ` blir punktliste og linjer som starter med `$ ` blir en formelboks.

Når et innhold er sjekket mot pensum, setter du `verified: true` på oppgaven.

### Nytt emne

1. Lag mappen `content/courses/<emne-id>/` med en `course.yaml` (se BØK 3430).
2. Legg temafilene i undermapper og før dem opp under riktig delemne.
3. Kjør `npm test`.

Emnevelger i appen kommer i fase 3. Fram til da brukes det første emnet.

## Publisering (gratis)

### GitHub Pages (anbefalt)

`.github/workflows/deploy.yml` bygger, tester og publiserer automatisk ved hver `git push` til `main`.

1. Lag et nytt repository på GitHub og push koden dit.
2. På GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Etter et par minutter ligger appen på `https://<brukernavn>.github.io/<repo-navn>/`.

### Netlify (alternativ)

Kjør `npm run build` og dra mappen `dist/` inn på [app.netlify.com/drop](https://app.netlify.com/drop).

### På telefonen

Åpne adressen i Safari (iPhone) eller Chrome (Android) og velg **Del → Legg til på Hjem-skjerm**. Appen virker da også uten nett. Fremgangen ligger lagret på telefonen, så bruk samme telefon og nettleser.

## Teknisk oversikt

React 18 + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), ts-fsrs, zod og vite-plugin-pwa.

```
src/
  lib/        formelmotor, finansformler, tallformat, FSRS, økter, streak (alt testet)
  content/    skjema, innlasting og oppgavegenerator for innholdsfilene
  db/         lokal lagring
  components/ oppgavevisning, figurer, tekstformat
  pages/      Hjem, Økt, Temaer, Innstillinger
```
