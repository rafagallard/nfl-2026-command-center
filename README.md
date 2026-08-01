# NFL 2026 Command Center

Bilingual, responsive NFL season tracker based on the approved Figma direction. It includes standings, weekly winner predictions, participant history, dashboards, playoff clusters, a film-room foundation, and a position glossary.

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
