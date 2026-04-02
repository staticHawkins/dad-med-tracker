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
npm run test:run   # single run
npm run test       # watch mode
```

Tests use Vitest + React Testing Library. Config: `client/vite.config.js`.

## Build & Deploy

```bash
cd client && npm run build   # outputs to client/dist/
```

GitHub Actions (`.github/workflows/deploy.yml`) builds from `client/` and deploys `client/dist/` to GitHub Pages on every push to `main`.

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
│   ├── meds/            # MedicationsView, MedsTable, MedModal, KPIRow
│   └── apts/            # AppointmentsView, AptCard, AptModal, HeroCard, MiniCalendar, AgendaGroups
├── hooks/
│   ├── useAuth.js       # onAuthStateChanged
│   ├── useMeds.js       # Firestore medications listener
│   └── useApts.js       # Firestore appointments listener
├── lib/
│   ├── medUtils.js      # pillsNow(), getStatus(), getRefillDate()
│   └── aptUtils.js      # appointment helpers
└── test/                # Vitest test files
```

### Key Utilities (client/src/lib/)

- `pillsNow(med)` — remaining pills and days until runout from `filledDate`, `supply`, `frequency`
- `getStatus(med)` — `urgent` (≤3 days), `soon` (4–7 days), `ok` (8+ days)
- `getRefillDate(med)` — explicit `refillDate` or calculated runout date

### Firebase Config

API keys are in `client/src/firebase.js`. This is intentional for a client-side app — access is controlled by Firestore security rules in the Firebase console, not in this repo.
