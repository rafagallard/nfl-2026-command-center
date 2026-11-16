# NFL 2026 Command Center

Bilingual, responsive NFL season tracker based on the approved Figma direction. It includes standings, weekly winner predictions, participant history, dashboards, a week-by-week recap archive, playoff clusters, a film-room foundation, and a position glossary.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite base is relative so the generated `dist/` directory can be served from GitHub Pages.

## Prediction backend

`apps-script/Code.gs` contains the Google Apps Script endpoint. It validates kickoff locking and duplicate names on the server using a compound `game_id + participant_name_key` rule.

## Data sources

- NFL official schedule is the primary schedule reference.
- ESPN scoreboard data is consumed through an isolated adapter.
- Google Sheets is the historical store and operational fallback.

This is a personal-use project and is not affiliated with the NFL.


## Weekly recap archive

The **Weekly recap / Resumen semanal** view is generated from the permanent `Games` and `Predictions` records. Each regular-season week remains addressable in the archive and includes confirmed final scores, prediction performance, weekly points, highlights, and a clearly labeled preview of the following week.

## Live scores and historical synchronization

The **Live scores / Resultados en vivo** tab polls ESPN every 30 seconds while the
site is open. The frontend merges the fresh scoreboard with the existing
Google Sheets records by game ID (or the same matchup and kickoff), retaining
canonical game IDs so prediction history stays connected. Only games marked
final affect standings, dashboard pick grading, and weekly recap.

## Existing production synchronization — do not overwrite

The Google Sheets **Sync_Log** tab shows an existing ESPN synchronization
running hourly, updating scores, plays and predictions. The latest inspected
records (November 15, 2026) report success. The checked-in
`apps-script/Code.gs` is **not verified to be the same version** as the
deployed Apps Script project. **Do not replace or redeploy the working script
with this repository copy** without first exporting and comparing the
production source: doing so may remove existing play-by-play processing.

The live page polls ESPN every 30 seconds in the browser, and its final scores
feed the React views immediately. Persistent historical score and prediction
updates continue to be handled by the *existing* production Apps Script
synchronization. To increase its frequency, inspect the deployed Apps Script
project and its triggers before changing any scheduling.
