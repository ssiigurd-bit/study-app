# Plan – Study App (fase 1 / MVP)

Status: **fase 1 er bygget** (1. november 2026). Se README for hvordan alt henger sammen.

Endringer underveis: Regneoppgaver med tilfeldige tall er vanlige `numeric`/`mcq` med `vars` (ikke egne `param-*`-typer). «Meld feil» er tatt med i fase 1. En forhåndsvisning av enkeltoppgaver (`#/okt?oppgave=<id>`) er lagt til.

---

## 1. Teknologi

| Del | Valg | Hvorfor |
|---|---|---|
| Rammeverk | React 18 + TypeScript + Vite | Som foreslått. Rask oppstart, god PWA-støtte. |
| Stil | Tailwind CSS | Mørk/lys modus via `class`, enkel mobil-først. |
| Lagring | IndexedDB via Dexie (+ `useLiveQuery`) | All progresjon lokalt, ingen backend. |
| Repetisjon | `ts-fsrs` (FSRS v5) | Ferdig, testet FSRS-implementasjon. Vi pakker den inn i et eget tynt lag, så algoritmen kan byttes. |
| PWA | `vite-plugin-pwa` (Workbox) | Installerbar, fungerer offline, alt innhold forhåndslastes. |
| Ruting | React Router med `HashRouter` | Fungerer på GitHub Pages uten serveroppsett. |
| Innholdsvalidering | `zod` + `yaml` | Innholdsfiler sjekkes ved bygg og i tester, så feil i en fil oppdages før appen går i stykker. |
| Tester | Vitest | Planlegger, svarsjekk, formler og alle oppgavegeneratorer. |

Ingen egen state-pakke (Redux/Zustand) i fase 1. Dexie + React state holder.

## 2. Innhold atskilt fra kode

Innhold ligger i `content/`, i **YAML** (lettere å redigere enn JSON når teksten er lang og norsk). Struktur:

```
content/
  courses/
    bok3430/
      course.yaml                # emne, delemner, rekkefølge
      d1-regnskap/
        balanseligningen.yaml    # ett tema = én fil
      d2-kostnad/
        nullpunkt.yaml
      d3-finans/
        naverdi.yaml
```

Appen finner alle emner automatisk (`import.meta.glob`). **Nytt emne = ny mappe, ingen kodeendring.**

### Parameteriserte regneoppgaver uten kode

I stedet for å skrive en egen TypeScript-generator for hver oppgavetype, beskrives oppgavene i YAML med variabler og formler. En liten, sikker formelmotor (egen, ca. 200 linjer, ingen `eval`) regner ut svar og løsningssteg:

```yaml
- id: nullpunkt-mengde-01
  type: param-numeric
  skillLevel: 1
  verified: false
  vars:
    P:   { min: 80,   max: 200,   step: 5 }      # pris per enhet
    VEK: { min: 30,   max: 120,   step: 5 }      # variabel kostnad per enhet
    FK:  { min: 100000, max: 600000, step: 10000 }
  constraints: ["P - VEK >= 20"]
  derived:
    DB: "P - VEK"
    X0: "FK / DB"
  prompt: >
    Kafé Bønna selger kaffe til {{P}} kr per kopp. Variable kostnader er {{VEK}} kr
    per kopp, og faste kostnader er {{FK}} kr per år. Hvor mange kopper må de selge
    for å gå i null?
  answer: { expr: "X0", unit: "stk", round: "up" }
  steps:
    - "Dekningsbidrag per enhet: DB = {{P}} − {{VEK}} = {{DB}} kr"
    - "Nullpunktsmengde: FK / DB = {{FK}} / {{DB}} = {{X0}}"
  misconceptions:
    - when: "FK / P"
      feedback: "Du delte på pris. Faste kostnader må dekkes av dekningsbidraget, ikke hele prisen."
```

Formelmotoren får et fast sett finansfunksjoner: `pv`, `fv`, `annuityFactor`, `npv`, `irr`, `effRate`, `round`. Feilsvar som stemmer med en kjent feil (f.eks. diskontere år 0, glemme frigjøring av arbeidskapital) får **målrettet tilbakemelding** i stedet for bare «feil».

Ulempe: nye *typer* beregninger som trenger en ny funksjon krever en kodeendring i funksjonsbiblioteket. Nye oppgaver med eksisterende formler gjør ikke det.

## 3. Datamodell

**Innhold (fra YAML, kun lesing):**
- `Course { id, code, title, delemner[] }`
- `Delemne { id, title, topics[] }`
- `Topic { id, title, prerequisites[], intro[], items[] }`
- `Item` – felles felt: `id, topicId, type, skillLevel (1–3), verified, tags`
  - `flashcard` – forside/bakside (begrep ↔ definisjon/formel)
  - `mcq` – alternativer, hvert feilalternativ har egen forklaring
  - `numeric` – fast tall, toleranse, enhet
  - `param-numeric` / `param-mcq` – mal med tilfeldige tall (se over)
  - `truefalse` – med «hvorfor»
- `IntroCard` – kort forklaring (én idé) som vises første gang et tema åpnes, valgfritt med figur

**Brukerdata (IndexedDB):**
- `cards` – én rad per item: FSRS-tilstand (`due, stability, difficulty, reps, lapses, state`)
- `reviewLogs` – hvert svar: `itemId, correct, rating, svarTid, konfidens?, tidspunkt, genererte tall`
- `profile` – `xp, level, streak, lengsteStreak, streakFrys, sisteAktiveDag, dagligMål`
- `errorReports` – «Meld feil / Jeg er uenig»: `itemId, tekst, tidspunkt` (se spørsmål 4)
- `settings` – tema, dagligMål, bevegelse

En parameterisert oppgave er **ett** kort i repetisjonen (ferdigheten), men får nye tall hver gang.

## 4. Repetisjon og økter

- **FSRS** med ønsket hukommelse 0,90. Automatisk retting gir vurdering: feil → *Again*, riktig etter hint/stegvis hjelp → *Hard*, riktig → *Good*. Flashcards vurderes av deg selv (Igjen / Vanskelig / Bra / Lett).
- **Øktbygger** (ca. 8–12 kort, 2–5 min):
  1. Forfalte repetisjoner (mest forsinket først)
  2. Nytt stoff, maks ~3–4 nye kort per økt, i små biter: intro-kort → flashcard → enkel oppgave
  3. Rekkefølgen blandes lett allerede i fase 1 når flere temaer er åpne (full interleaving kommer i fase 2)
- **Hvert svar lagres med en gang.** Lukker du appen midt i, er alt du har svart på lagret. Neste trykk på «Start» bygger ny økt.
- **«Ferdig for nå»-skjerm** etter økten: hva du lærte, XP, streak. Ingen autostart av ny økt. Du kan trykke «én runde til» hvis du vil.

## 5. Svarsjekk for tall

Godtar: `1250,50` · `1 250,50` · `1250.50` · `-1 250` · `12,5 %`.
- Mellomrom (også hardt mellomrom) = tusenskille. Komma = desimal.
- Punktum alene = desimal (`1250.50`). Flere punktum (`1.250.000`) = tusenskille.
- Toleranse per oppgave: standard ±0,5 % eller ±1 kr (det som er størst), fordi diskonteringsfaktorer avrundes for hånd.
- Prosent: hvis svaret er en prosent, godtas både `12,5` og `12,5 %` (men ikke `0,125`, så formatet trenes).

## 6. Skjermer i fase 1

1. **Hjem** – stor «Start økt»-knapp, streak, dagens mål (ring), antall forfalte kort. Klar på under ett sekund.
2. **Økt** – ett kort om gangen, fremdriftslinje, «Avslutt»-knapp alltid synlig.
3. **Tilbakemelding** (del av økt) – riktig/feil, *hvorfor*, løsningssteg, «Meld feil»-knapp.
4. **Ferdig for nå** – oppsummering.
5. **Temaer** – enkel liste over de tre temaene med fremdrift (det visuelle kurskartet kommer i fase 2).
6. **Innstillinger** – tema (lys/mørk/system), dagligMål, info om at innholdet er ubekreftet, nullstill data.

Animasjoner er korte og slås av ved «redusert bevegelse».

## 7. Innhold i fase 1

Ett tema per delemne, alt merket **ubekreftet**:

| Delemne | Tema | Innhold (ca.) |
|---|---|---|
| 1 Regnskap | Balanseligningen og transaksjoner | 4 intro-kort, 12 flashcards, 10 MCQ, 4 regnemaler (f.eks. «Kjøp av varer på kreditt – hvilke poster endres?», egenkapital som rest) |
| 2 Kostnad | Nullpunktsanalyse (inkl. faste/variable kostnader, DB, DG, sikkerhetsmargin) | 4 intro-kort, 12 flashcards, 10 MCQ, 5 regnemaler |
| 3 Finans | Nåverdi (inkl. fremtidsverdi, diskontering, annuitet, enkel NNV) | 4 intro-kort, 12 flashcards, 10 MCQ, 5 regnemaler |

Caser: kafé, sykkelbutikk, liten produsent, solcelleprosjekt. Alle beløp i NOK. Alle regneoppgaver kan løses med enkel kalkulator.

Tre enkle figurer (SVG, styrt av innholdsfilen): balansen som to kolonner, kontantstrøm-tidslinje, kostnad-volum-resultat-diagram.

## 8. Tester

- Formelmotor (parsing, presedens, ugyldig input avvises)
- Finansfunksjoner sjekket mot kjente verdier (f.eks. annuitetsfaktor 10 %, 5 år = 3,7908)
- Tallparser (norske formater, toleranse)
- FSRS-laget og øktbyggeren
- Streak og streakfrys (tidssoner, hoppede dager)
- **Alle innholdsfiler**: hver regnemal kjøres med 1000 tilfeldige tallsett. Svaret må være endelig, oppfylle kravene og stemme med løsningsstegene.

## 9. Spillmekanikk i fase 1

- XP per riktig svar (mer for høyere ferdighetsnivå), nivåer.
- Daglig mål (standard: én økt). Streak teller dager målet er nådd.
- Én streakfrys tjenes per 7 dager, maks 2 lagret. Brukes automatisk.
- Ingen varsler i fase 1.

## 10. Rekkefølge for byggingen

1. Prosjektoppsett (Vite, TS, Tailwind, PWA, Vitest), mappestruktur
2. Formelmotor + finansfunksjoner + tallparser, med tester
3. Innholdsskjema (zod), laster og valideringstester
4. Dexie-lagring, FSRS-lag, øktbygger, med tester
5. Skjermene: Hjem → Økt → Tilbakemelding → Ferdig → Temaer → Innstillinger
6. Innhold for de tre temaene
7. Streak/XP, mørk modus, animasjoner
8. PWA-ikon og manifest, README (læringsprinsipper, nytt emne, deploy)
9. Test på mobilstørrelse i nettleseren

## 11. Hva som bevisst venter til fase 2/3

Kurskart, fadede eksempler, full interleaving, konfidensvurdering, relevant/irrelevant-oppgaver, statistikk, prøveeksamen, kalkulator, formelsamling, egne kort, semesterplan, eksport/import.
