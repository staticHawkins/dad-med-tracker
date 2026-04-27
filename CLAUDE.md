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

E2e tests live in `client/e2e/`. Config: `client/playwright.config.js`. Both the dev server and the Firebase Emulator (Firestore port 8080, Auth port 9099) auto-start when not already running (`reuseExistingServer: true`). `VITE_USE_EMULATOR=true` (set by `test:e2e`) connects the app to the local emulator instead of production Firebase. Permissive rules in `firestore.rules` allow all reads/writes in emulator mode — never deployed to production.

Tests run across three Playwright projects: **desktop** (1280×800), **tablet** (iPad gen 7), and **mobile** (iPhone 14). The app renders differently on mobile (bottom sheets instead of modals, hidden ⋯ menu on medications) — tests are written to handle both layouts.

Spec files:
- `smoke.spec.js` — app loads, auth bypass works
- `navigation.spec.js` — all view transitions from the dashboard
- `medications.spec.js` — add, search, filter, inline edit, refill workflow, deactivate/reactivate, CSV export
- `appointments.spec.js` — add, search, hero card, detail modal, inline edit, delete, mini-calendar
- `tasks.spec.js` — add, status changes, comments, assignees, delete
- `care-team.spec.js` — add/edit/delete doctors, specialty management
- `timeline.spec.js` — timeline view renders correctly
- `ask-ai.spec.js` — sheet open/close, context chips, message sending
- `task-comment-status.spec.js` — comment survives a status change (regression)
- `color-audit.spec.js` — screenshots for dark/light mode color audit
- `profile-dropdown.spec.js` — profile dropdown open/close, navigation, theme toggle
- `pwa.spec.js` — manifest fields, icons, PWA meta tags, service worker registration, mobile bottom nav

If ports are already occupied from a previous run, kill them first:
```bash
lsof -ti:8080,9099,4000,5173 | xargs kill -9
```

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
│   ├── BottomNav.jsx
│   ├── CareTeamPanel.jsx
│   ├── NotificationBanner.jsx
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
│   ├── medUtils.js      # pillsNow(), supplyStatus(), getRefillDate()
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
- `supplyStatus(med)` — `urgent` (≤7 days or out), `soon` (8–14 days), `ok` (15+ days)
- `getRefillDate(med)` — explicit `refillDate` or calculated runout date
- `todayStr()` — today's date as a `YYYY-MM-DD` string

### lib/notifications.js

Push notification helpers for med supply alerts.

### Firebase Config

API keys are in `client/src/firebase.js`. This is intentional for a client-side app — access is controlled by Firestore security rules in the Firebase console, not in this repo.
