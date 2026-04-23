# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
cd client
npm install
npm run dev
# visit http://localhost:5173
```

If `~/.npm` is root-owned, prefix npm commands:

```bash
npm_config_cache=/tmp/npm-cache npm install
```

## Running Tests

```bash
cd client
npm run test:run   # unit tests, single run
npm run test       # unit tests, watch mode
npm run test:e2e   # e2e browser tests (Playwright + Chromium)
```

Unit tests use Vitest + React Testing Library. Config: `client/vite.config.js`.

E2e tests live in `client/e2e/`. Config: `client/playwright.config.js`. The dev server auto-starts if not already running (`reuseExistingServer: true`).

**After any UI change, run `npm run test:e2e` from `client/` and confirm all e2e tests pass before reporting the task as complete.** Take a screenshot via Playwright to verify the visual result when relevant.

## Build & Deploy

```bash
cd client && npm run build   # outputs to client/dist/
```

Pushing to `main` triggers an automatic production deploy via Vercel's Git integration. No GitHub Actions or Vercel CLI needed.

## Architecture

**React 19 + Vite SPA** with Firebase backend (Firestore + Auth).

```
client/src/
├── App.jsx              # root component, auth routing
├── main.jsx             # entry point
├── firebase.js          # Firebase app init
├── components/
│   ├── LoginScreen.jsx
│   ├── MainApp.jsx
│   ├── DashboardView.jsx
│   ├── CareTeamPanel.jsx
│   ├── meds/            # MedicationsView, MedsTable, MedModal, KPIRow, MedRow, MedGroupHeader, MedGroupSection, MedStockedCollapsed
│   ├── apts/            # AppointmentsView, AptCard, AptModal, AptDetailModal, HeroCard, MiniCalendar, AgendaGroups
│   ├── tasks/           # TasksView, TaskModal
│   ├── timeline/        # TimelineView, DiseaseTimelineCard, MilestoneRow, MilestoneTag, PhaseStrip
│   └── chat/            # AskAiSheet
├── hooks/
│   ├── useAuth.js       # onAuthStateChanged
│   ├── useMeds.js       # Firestore medications listener
│   ├── useApts.js       # Firestore appointments listener
│   ├── useNotes.js      # Firestore clinical notes listener
│   ├── useCareTeam.js   # Firestore care team listener
│   ├── useTasks.js      # Firestore tasks listener
│   ├── useUsers.js      # Firestore users listener
│   ├── useSpecialties.js
│   ├── useMilestones.js
│   ├── usePhases.js
│   ├── useNotifications.js
│   └── useIsMobile.js
├── lib/
│   ├── medUtils.js      # pillsNow(), getStatus(), getRefillDate()
│   ├── aptUtils.js      # appointment helpers
│   ├── firestore.js     # Firestore write operations, newId(), export/import
│   ├── notifications.js # push notification helpers
│   └── storageUtils.js  # Firebase Storage helpers
├── data/
│   ├── clinical-notes/  # enriched clinical notes JSON
│   └── milestones/      # patient milestone data
└── test/                # Vitest test files
```

### Key Utilities (client/src/lib/)

- `pillsNow(med)` — remaining pills and days until runout from `filledDate`, `supply`, `frequency`
- `getStatus(med)` — `urgent` (≤3 days), `soon` (4–7 days), `ok` (8+ days)
- `getRefillDate(med)` — explicit `refillDate` or calculated runout date

### lib/notifications.js

Push notification helpers for med supply alerts.

### Firebase Config

API keys are in `client/src/firebase.js`. This is intentional for a client-side app — access is controlled by Firestore security rules in the Firebase console, not in this repo.
