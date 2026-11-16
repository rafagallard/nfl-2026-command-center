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

To persist scores when the site is closed, publish the current
`apps-script/Code.gs` in the existing Google Apps Script project linked to the
Command Center spreadsheet. In the Apps Script editor, run
`installNFLScoreTrigger()` **once** and approve the requested permissions.
This installs a five-minute scheduled `syncSchedule2026` run. Deploy the new
Apps Script web-app version (maintaining the existing /exec URL) so that the
frontend can read the updated results. Run `syncSchedule2026()` manually once
to backfill recent games and inspect its logged counts.

The server writes scores to existing Games rows and grades Predictions rows
only when ESPN marks a game final. Historical game IDs are not replaced.
The live page remains useful independently of Apps Script scheduling, but
historical persistence and background grading require the published backend
and trigger.