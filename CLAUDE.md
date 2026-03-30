# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step or package manager. Open `index.html` directly or serve with any static HTTP server:

```bash
python -m http.server 8000
# visit http://localhost:8000
```

No tests are configured.

## Architecture

**Vanilla JS SPA** with Firebase backend. Three files:

- `index.html` — HTML structure and layout
- `styles.css` — dark-themed responsive UI (desktop table, mobile cards below 700px)
- `app.js` — all business logic, Firebase integration, state management

Firebase SDK is loaded from CDN (v10.14.1). No npm, no bundler, no framework.

### Data Flow

1. `onAuthStateChanged` → shows login screen or app
2. `startMedsListener()` → Firestore `onSnapshot` on the `medications` collection
3. Any change triggers `render()` → filters/searches/sorts meds, recomputes pill counts, updates DOM

### Key Functions in app.js

- `pillsNow(med)` — calculates remaining pills and days until runout from `filledDate`, `supply`, `frequency`
- `st(med)` — returns status: `urgent` (≤3 days), `soon` (4-7 days), `ok` (8+ days)
- `getRefillDate(med)` — uses explicit `refillDate` or falls back to calculated runout date
- `saveMed()` — creates or updates a medication via `setDoc()` (distinguished by `editId`)
- `render()` — full DOM re-render of the table/cards and KPI dashboard row

### State

Module-scoped variables only: `meds` (array), `filter` (string), `editId` (string|null), `unsubMeds` (Firestore unsubscribe fn).

### Firebase Config

Firebase API keys are embedded in `app.js` (lines ~8-15). This is intentional for a client-side app — access is controlled by Firestore security rules in the Firebase console, not in this repo.
