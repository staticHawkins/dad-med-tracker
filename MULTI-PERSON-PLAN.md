# Multi-Person Expansion — Implementation Plan

## What we're building

Expand the app from Dad-only to support both **Dad** and **Mom** in a single unified ("merged") view — Option C from the design mockup.

Every section (Dashboard, Medications, Appointments, Tasks, Care Team) shows data from both people in the same list. Each item carries a small **person chip** (`Dad` rose/mauve · `Mom` teal) and a **left accent border** in the person's color. A global **All / Dad / Mom** filter narrows any view to one person.

- **Dad** keeps his full feature set: meds, apts, tasks, timeline, care team.
- **Mom** gets: meds, apts, tasks, care team. **No timeline** (not applicable).
- The sidebar nav and bottom nav are unchanged — they remain section-based.

**Design reference:** `/tmp/option-c-mockups.html` — open in a browser to see all 5 views on desktop and mobile. The dashboard section specifically matches the real app layout (SummaryBar → This Week card → Meds/Apts/Tasks cards → Timeline card).

---

## Color tokens (already in `index.css`)

```css
--dad: #A8546A;   /* existing --blue */
--dad-dim: rgba(168,84,106,.08);
--dad-border: rgba(168,84,106,.28);

--mom: #2E7D8A;   /* new — add to :root */
--mom-dim: rgba(46,125,138,.08);
--mom-border: rgba(46,125,138,.28);
```

Add the three `--mom` variables to `:root` in `client/src/index.css`. The `--dad` variables are aliases for existing values — add them too for clarity.

---

## Phase 1 — Data model (Firestore)

Every document type gets a `person: 'dad' | 'mom'` field.

### Existing data

All existing documents default to `'dad'`. No migration script needed — the app should treat any document missing `person` as `'dad'` by falling back in the hooks (see Phase 2).

### Write functions to update (`client/src/lib/firestore.js`)

Add `person: fields.person || 'dad'` to the constructed object in each of these:

| Function | Collection |
|---|---|
| `saveMed(fields, editId)` | `medications` |
| `saveApt(fields, editId)` | `appointments` |
| `saveTask(fields, editId)` | `tasks` |
| `saveDoctor(fields, editId)` | `careTeam` |

No other write functions need changes.

---

## Phase 2 — Hooks

All hooks live in `client/src/hooks/`. They currently do a bare `onSnapshot(collection(db, '...'))` with no filtering. No changes to the snapshot logic — filtering happens client-side based on the global `personFilter` state (see Phase 3).

**One change per hook:** normalize the `person` field on read so old documents without it default to `'dad'`.

```js
// example — useMeds.js
setMeds(snap.docs.map(d => {
  const data = d.data()
  return { ...data, person: data.person || 'dad' }
}))
```

Apply the same normalization pattern to:
- `useMeds.js`
- `useApts.js`
- `useTasks.js`
- `useCareTeam.js`

No new hooks needed.

---

## Phase 3 — Global person filter state

**File:** `client/src/components/MainApp.jsx`

Add one new piece of state at the top of `MainApp`:

```js
const [personFilter, setPersonFilter] = useState('all') // 'all' | 'dad' | 'mom'
```

Pass `personFilter` and `setPersonFilter` as props into every view component that needs it. The filter pills in each view call `setPersonFilter`.

### Filtering helper (put in `MainApp.jsx` or a new `lib/personUtils.js`)

```js
export function filterByPerson(items, personFilter) {
  if (personFilter === 'all') return items
  return items.filter(item => (item.person || 'dad') === personFilter)
}
```

### Person filter pill component (inline or small component)

```jsx
function PersonFilter({ value, onChange }) {
  return (
    <div className="person-filter">
      {['all', 'dad', 'mom'].map(p => (
        <button
          key={p}
          className={`pfill pfill-${p}${value === p ? ' on' : ''}`}
          onClick={() => onChange(p)}
        >
          {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  )
}
```

Add CSS for `.person-filter`, `.pfill`, `.pfill-all.on`, `.pfill-dad.on`, `.pfill-mom.on` to `index.css`.

### Where the filter lives in the topbar

In `MainApp.jsx`, the topbar currently renders date + avatar on the right. Add the `PersonFilter` component to the **left side** of the topbar (between the left edge and the date). On mobile the topbar doesn't show — put a `PersonFilter` row just below the page title in each view instead (see per-view notes below).

---

## Phase 4 — Person chip component

Add a reusable `PersonChip` component. Put it in `client/src/components/PersonChip.jsx`:

```jsx
export default function PersonChip({ person }) {
  return (
    <span className={`person-chip person-chip-${person || 'dad'}`}>
      {person === 'mom' ? 'Mom' : 'Dad'}
    </span>
  )
}
```

CSS in `index.css`:
```css
.person-chip {
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 20px; letter-spacing: .04em; flex-shrink: 0;
  font-family: var(--ffm);
}
.person-chip-dad { background: var(--dad-dim); color: var(--dad); border: 1px solid var(--dad-border); }
.person-chip-mom { background: var(--mom-dim); color: var(--mom); border: 1px solid var(--mom-border); }
```

---

## Phase 5 — View changes

### 5.1 Dashboard (`DashboardView.jsx`)

**`SummaryBar`**
- Each alert pill gets a `PersonChip` next to its label.
- The data feeding SummaryBar comes from the unfiltered `meds`/`apts`/`tasks` (always show all-person alerts).
- No filter pills on the SummaryBar itself.

**`WeekCard`**
- Each of the three sections (Apts / Tasks Due / Refills) shows the combined count as the big number.
- Add a small breakdown line below the sub-text: `D: {dadCount} · M: {momCount}` using `font-family: var(--ffm)` and the respective person colors.
- Receive unfiltered data so totals are always combined.

**`MedsCard`**
- The Total / Urgent / Soon stat boxes show combined counts.
- Each row in "All Medications" list gets a `PersonChip` prepended.
- Left accent border on each list row: `border-left: 2px solid var(--{person})`.
- The card receives filtered meds (by `personFilter`) so filter pills affect it.

**`AptsCard`**
- The hero date block gets a `PersonChip` label.
- Each row in "Coming Up" list gets a `PersonChip` and left accent.
- Receives filtered apts.

**`TasksCard`**
- Category stat boxes (Medical / House / Finances) show combined counts with a `D: N · M: N` sub-label inside each box.
- Each task list row gets a `PersonChip`.
- Receives filtered tasks.

**`DiseaseTimelineCard`**
- No changes. Stays Dad-only.
- Add a `PersonChip person="dad"` with label "Dad only" next to the card title.

**Props change to `DashboardView`:**
```jsx
// Before
<DashboardView meds={activeMeds} apts={apts} tasks={tasks} ... />

// After — pass both filtered and unfiltered
<DashboardView
  meds={activeMeds}               // unfiltered (for WeekCard, SummaryBar)
  filteredMeds={filterByPerson(activeMeds, personFilter)}
  apts={apts}                     // unfiltered
  filteredApts={filterByPerson(apts, personFilter)}
  tasks={tasks}                   // unfiltered
  filteredTasks={filterByPerson(tasks, personFilter)}
  ...
/>
```

---

### 5.2 Medications (`MedicationsView.jsx`)

**Desktop (table view):**
- Add a `PersonChip` column as the second column after the status dot.
- Left accent border on each row: `border-left: 3px solid var(--{med.person || 'dad'})`.
- KPI row (`KPIRow.jsx`) shows totals split by person: add two small sub-labels `Dad: N` / `Mom: N` below each KPI number.
- Filter pills (All / Dad / Mom) appear in the table header row alongside the existing search and filter tabs.
- `MedsTable` receives `filteredMeds` instead of all meds.

**Mobile (card view — `MedRow.jsx` or similar):**
- Card gets left accent border in person color.
- `PersonChip` shown in the card header.

**Add medication form (`MedModal.jsx`):**
- Add a `person` field (radio or select: Dad / Mom). Defaults to `'dad'`.
- Pass `fields.person` through to `saveMed`.

---

### 5.3 Appointments (`AppointmentsView.jsx`, `AptCard.jsx`, `HeroCard.jsx`)

**`HeroCard.jsx`:**
- Add `PersonChip` next to the appointment title.
- Left accent border using `apt.person`.

**`AptCard.jsx`:**
- Add `PersonChip` in the card header (top-right, as shown in mockup).
- Left accent border: `border-left: 3px solid var(--{apt.person || 'dad'})`.

**`AppointmentsView.jsx`:**
- Add filter pills row at the top.
- Pass `personFilter` down; filter the `apts` array before passing to `AgendaGroups` and `HeroCard`.

**`AptModal.jsx` (add/edit form):**
- Add `person` radio field (Dad / Mom). Default `'dad'`.

---

### 5.4 Tasks (`TasksView.jsx`, `TaskModal.jsx`)

**`TasksView.jsx`:**
- Filter pills at the top.
- Each category section header gets a `D: N · M: N` count breakdown.
- Each task row gets a `PersonChip`.
- Left accent border per task row.
- Filter the tasks array by `personFilter` before grouping into categories.

**`TaskModal.jsx`:**
- Add `person` radio field. Default `'dad'`.

---

### 5.5 Care Team (`CareTeamPanel.jsx`)

**Layout change:** Split into two sub-sections instead of one flat list.

```
Dad's Care Team     [3 doctors]
  Dr. Patel — Oncology
  Dr. Chen  — Cardiology
  Dr. Rivera — Primary Care

Mom's Care Team     [2 doctors]
  Dr. Kim  — Primary Care
  Dr. Walsh — Dentist
```

- Each sub-section header uses the person's color (`var(--dad)` / `var(--mom)`) with a circle avatar initial.
- Doctor cards get a top border accent in the person's color.
- The existing flat list `careTeam` array is split: `dadDoctors = careTeam.filter(d => (d.person||'dad')==='dad')`.
- No filter pills needed here (sections replace pills).
- **Add doctor form:** add `person` radio (Dad / Mom). Default `'dad'`.

---

## Phase 6 — Mobile filter placement

On mobile (< 768px) the topbar PersonFilter is hidden. Each view needs a filter pill row near the top. Pattern:

```jsx
// At the top of each view's page-body, inside a mobile-only wrapper
<div className="mobile-person-filter">
  <PersonFilter value={personFilter} onChange={setPersonFilter} />
</div>
```

CSS:
```css
.mobile-person-filter { display: flex; gap: 5px; margin-bottom: 12px; }
@media (min-width: 768px) { .mobile-person-filter { display: none; } }
```

The desktop topbar filter is hidden on mobile:
```css
.topbar-person-filter { ... }
@media (max-width: 767px) { .topbar-person-filter { display: none; } }
```

---

## Implementation order

Do these phases in order — each one is independently shippable and testable:

1. **CSS tokens** — add `--mom`, `--mom-dim`, `--mom-border`, `--dad`, `--dad-dim`, `--dad-border` to `:root` in `index.css`.
2. **`PersonChip` component** — build and add CSS. Verify it renders in isolation.
3. **Hook normalization** — add `person: data.person || 'dad'` to the four hooks. No visual change yet, but all data now has the field.
4. **`personFilter` state + `filterByPerson` utility** — add to `MainApp.jsx`. Wire PersonFilter into the topbar. Verify filter state changes but views are unchanged (not wired yet).
5. **Firestore write functions + form fields** — add `person` field to `saveMed`, `saveApt`, `saveTask`, `saveDoctor`. Add `person` radio to each modal. New items written with correct person.
6. **Dashboard** — update all four card components + SummaryBar. This is the most visible change.
7. **Medications view** — wire filter, add PersonChip to table rows and KPIRow, update MedModal.
8. **Appointments view** — wire filter, update AptCard/HeroCard, update AptModal.
9. **Tasks view** — wire filter, add PersonChip and D/M breakdown to category headers.
10. **Care Team** — split into two sub-sections, update add-doctor form.
11. **E2E tests** — run `npm run test:e2e` from `client/`. Update any tests that broke due to new `person` field or layout changes.

---

## Files touched (summary)

| File | Change |
|---|---|
| `src/index.css` | Add `--mom*` / `--dad*` tokens; PersonChip CSS; person filter pill CSS |
| `src/components/PersonChip.jsx` | New component |
| `src/components/MainApp.jsx` | `personFilter` state; PersonFilter in topbar; pass filtered props to views |
| `src/hooks/useMeds.js` | Normalize `person` field |
| `src/hooks/useApts.js` | Normalize `person` field |
| `src/hooks/useTasks.js` | Normalize `person` field |
| `src/hooks/useCareTeam.js` | Normalize `person` field |
| `src/lib/firestore.js` | Add `person` to `saveMed`, `saveApt`, `saveTask`, `saveDoctor` |
| `src/components/DashboardView.jsx` | PersonChip in all cards; D/M breakdown in WeekCard; accept filtered props |
| `src/components/meds/MedicationsView.jsx` | Filter pills; wire personFilter |
| `src/components/meds/MedsTable.jsx` | PersonChip column; left accent border |
| `src/components/meds/KPIRow.jsx` | Dad/Mom sub-labels on KPI numbers |
| `src/components/meds/MedRow.jsx` | PersonChip + left accent |
| `src/components/meds/MedModal.jsx` | `person` radio field |
| `src/components/apts/AppointmentsView.jsx` | Filter pills; wire personFilter |
| `src/components/apts/AptCard.jsx` | PersonChip; left accent border |
| `src/components/apts/HeroCard.jsx` | PersonChip |
| `src/components/apts/AptModal.jsx` | `person` radio field |
| `src/components/tasks/TasksView.jsx` | Filter pills; PersonChip; D/M breakdown in category headers |
| `src/components/tasks/TaskModal.jsx` | `person` radio field |
| `src/components/CareTeamPanel.jsx` | Split into Dad/Mom sub-sections |

---

## What does NOT change

- Sidebar nav items and order — unchanged.
- Bottom nav — unchanged.
- `BottomNav.jsx` — unchanged.
- Timeline feature — Dad-only. `TimelineView.jsx`, milestones hooks, phases hooks — no changes needed.
- `AskAiSheet.jsx` — receives all data (unfiltered); the AI context bundle should include both people's data. No structural changes, but the prompt context should mention both people exist.
- Firebase Auth, security rules, FCM — unchanged.
- Firestore collection names — unchanged (`medications`, `appointments`, `tasks`, `careTeam`).
- Existing CSV export in `MedicationsView` — add a `Person` column to the export.
