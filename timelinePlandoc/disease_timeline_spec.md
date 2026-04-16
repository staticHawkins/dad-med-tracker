# Disease Timeline — FamilyCareHub Feature Spec

> **For Claude Code.** This document defines the Disease Timeline feature end-to-end: data model, two new views (Dashboard card + Full timeline page), and all design tokens. Implement exactly as specified. Do not invent new components — extend the existing card system.

---

## Overview

Add a **Disease Timeline** feature to FamilyCareHub that surfaces a patient's clinical milestones, treatment phases, and disease progression as a scannable, navigable view — both as a compact dashboard card and a full-page timeline.

**Entry points:**
- Dashboard card (desktop + mobile) — shows most recent milestone only, links to full view
- Full timeline page at `/[patientId]/timeline` — all milestones grouped by treatment phase

---

## Design Tokens

Match existing FamilyCareHub dark theme exactly.

```ts
// colors.ts — extend existing theme
export const colors = {
  bg: {
    page:    '#0f1117',
    card:    '#1c2235',
    surface: '#161b27',
    raised:  '#232b3e',
  },
  border: {
    default: 'rgba(255,255,255,0.07)',
    hover:   'rgba(255,255,255,0.13)',
  },
  text: {
    primary:   '#e8eaf0',
    secondary: '#9ba3b8',
    muted:     '#5c6479',
  },
  phase: {
    pre:    '#6b7280',
    line1:  '#4a7fd4',   // STRIDE
    line2:  '#1a8a66',   // Cabozantinib
    line3:  '#c08030',   // Ivosidenib
    line4:  '#c04040',   // GCD (active)
  },
  event: {
    crisis:      '#e55b4d',
    progression: '#e55b4d',
    response:    '#3cbf7a',
    regimen:     '#5b8af0',
    symptom:     '#e09340',
    functional:  '#9c6bde',
    neutral:     '#9ba3b8',
  },
}
```

### Card top-border gradient (phase strip)
All timeline cards use this gradient as a 3px top border:
```css
background: linear-gradient(to right, #6b7280, #4a7fd4 20%, #1a8a66 48%, #c08030 68%, #c04040 85%);
```

---

## Data Model

```ts
// types/timeline.ts

export type EventType =
  | 'progression'
  | 'response'
  | 'regimen'
  | 'symptom'
  | 'functional'
  | 'hospitalization'

export type DotStyle = 'filled' | 'hollow' | 'green' | 'red' | 'amber'

export type PhaseKey = 'pre' | 'line1' | 'line2' | 'line3' | 'line4'

export interface TreatmentPhase {
  key:         PhaseKey
  label:       string          // e.g. "STRIDE — durvalumab + tremelimumab"
  shortLabel:  string          // e.g. "STRIDE"
  color:       string          // hex from phase color tokens
  period:      string          // e.g. "Nov 2024 – Jun 2025"
  duration:    string          // e.g. "~8 months"
  outcome:     'Active' | 'Progression' | 'Failure' | 'Stabilized'
  note:        string
  wtStart:     number          // weight lbs at phase start
  wtEnd:       number          // weight lbs at phase end
  painPeak:    number          // 0–10
  isActive:    boolean
}

export interface Milestone {
  id:        string
  date:      string            // ISO date string
  phase:     PhaseKey
  type:      EventType
  dot:       DotStyle
  tags:      { label: string; type: EventType | 'neutral' }[]
  title:     string
  summary:   string            // 1–2 sentences, shown in card preview
  detail?:   string            // expanded detail, shown on full page
  nextSteps?: string
  weight?:   number
  pain?:     number            // 0–10
}
```

---

## View 1 — Dashboard Card

### Screenshot references
- **Desktop:** `dashboard_desktop.png` — timeline card spans full width at top of 2-column grid
- **Mobile:** `dashboard_mobile.png` — single column, timeline card first
- **Mobile card close-up:** `timeline_mobile_card.png` — single milestone, phase strip, "View full timeline" link

### Desktop layout

The timeline card is **full-width** (`grid-column: 1 / -1`) and sits above the existing Medications, Appointments, Tasks, and Care Team cards.

```
┌─────────────────────────────────────────────────────────────┐
│ [gradient top border — phase colors]                        │
│                                                             │
│  ⏱ DISEASE TIMELINE                               ›        │
│                                                             │
│  [phase strip — 4px bar, proportional to duration]         │
│                                                             │
│  Mar 26  ●  STABLE  GCD ACTIVE                             │
│  2026    │  Disease stability confirmed vs Dec scan         │
│          │  No new progression. Pain-free. Weight...        │
│          │                                                  │
│  Jan 29  ●  RESPONSE  4TH LINE                             │
│  2026    │  Pain 10 → 3 in one week                        │
│          │  Fastest pain response of any regimen...         │
│          │                                                  │
│  Jan 22  ●  CRISIS  REGIMEN CHANGE                         │
│  2026    │  Pain 10/10 · Ivosidenib failure · GCD started  │
│          ...                                               │
│                                                             │
│  ● STRIDE  ● Cabo  ● Ivosid  ● GCD — active  View full ↗  │
└─────────────────────────────────────────────────────────────┘
```

**Show 5 most recent milestones on desktop.**

Desktop timeline row layout:
- Left column: `width: 90px`, `text-align: right`, date in muted text
- Center: `width: 16px`, dot + vertical connector line
- Right: flex-1, tags + title + summary

### Mobile layout

Timeline card is the **first card** in the single-column stack.

**Show 1 milestone only** (most recent).

```
┌─────────────────────────────────────┐
│ [gradient top border]               │
│                                     │
│  ⏱ DISEASE TIMELINE          ›     │
│                                     │
│  [phase strip]                      │
│                                     │
│  ●  Mar 26, 2026                    │
│     STABLE  GCD ACTIVE              │
│     Disease stability confirmed...  │
│     No new progression. Pain-free.. │
│                                     │
│  16 milestones total  View full ↗   │
└─────────────────────────────────────┘
```

Mobile timeline row layout — **no left date column**:
- Dot on far left, `margin-top: 3px`, `width: 10px`
- Date as `font-size: 10px` muted text, first line of content block
- Tags below date
- Title below tags
- Summary below title

### Component: `<DiseaseTimelineCard>`

```tsx
// components/DiseaseTimelineCard.tsx

interface Props {
  milestones: Milestone[]
  phases:     TreatmentPhase[]
  patientId:  string
}

// Desktop: renders last 5 milestones (milestones[0] = most recent)
// Mobile:  renders last 1 milestone only
// Phase strip: proportional flex widths based on phase duration (visit count)
// "View full timeline" → navigate to /[patientId]/timeline
```

#### Phase strip proportions
```ts
const PHASE_FLEX = { pre: 1, line1: 8, line2: 3, line3: 3.5, line4: 2 }
```

#### Dot styles
| Style    | Appearance                           | When to use              |
|----------|--------------------------------------|--------------------------|
| `green`  | `background: #3cbf7a`                | Response / stable        |
| `red`    | `background: #e55b4d`                | Crisis / progression     |
| `filled` | `background: #e8eaf0`                | Regimen start            |
| `hollow` | `background: page-bg; border: muted` | Minor / functional       |
| `amber`  | `background: #e09340`                | Symptom / warning        |

#### Tag styles
```css
.tag { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
       padding: 2px 6px; border-radius: 3px; }
.tag-green  { color: #3cbf7a; background: rgba(60,191,122,0.15); }
.tag-red    { color: #e55b4d; background: rgba(229,91,77,0.15); }
.tag-blue   { color: #5b8af0; background: rgba(91,138,240,0.15); }
.tag-amber  { color: #e09340; background: rgba(224,147,64,0.15); }
.tag-purple { color: #9c6bde; background: rgba(156,107,222,0.15); }
.tag-gray   { color: #9ba3b8; background: rgba(255,255,255,0.07); }
```

---

## View 2 — Full Timeline Page

**Route:** `/[patientId]/timeline`

### Screenshot reference
- `timeline_full_light.png` — reference layout (note: implement in dark theme, not light)

### Page structure

```
Nav bar (existing FamilyCareHub nav)
│
├── Patient header
│     Name, DOB, MRN, Referring, PMH
│
├── Diagnosis block (dark surface card, 4 columns)
│     Primary diagnosis | Staging | Disease onset | Notes reviewed
│
├── Treatment phases strip
│     5 phase cards side-by-side, colored bottom border per phase
│     Each card: tier label, regimen name, period, outcome status
│
├── Section label: "CLINICAL MILESTONES — MOST RECENT FIRST"
│
└── Timeline
      Milestones in reverse-chronological order
      Date left | dot+line center | content right
```

### Patient header
```tsx
<PatientHeader>
  <Name>Guangul Zekiros</Name>
  <Meta>
    DOB Aug 28, 1956 · Age 69 | MRN 1394784 |
    Referring Dr. Amar Gupta | PMH Hypertension · HCV (treated) · BPH
  </Meta>
  <Divider />
</PatientHeader>
```

### Diagnosis block
4-column grid on dark surface (`#161b27`), `border-radius: 8px`, 1px border.

| Field | Value |
|-------|-------|
| Primary diagnosis | Mixed HCC / Cholangiocarcinoma |
| Staging | T4 · Stage IIIB+ · BCLC-B/C |
| Disease onset | Ruptured HCC · Oct 12, 2024 |
| Notes reviewed | 30 notes · Oct 2024 – Mar 2026 |

Label: `10px`, `#5c6479`, uppercase, `letter-spacing: 0.08em`
Value: `13px`, `font-weight: 500`, `#e8eaf0`

### Treatment phase strip
5 cards side-by-side, separated by `rgba(255,255,255,0.07)` borders. Each card has a **3px colored bottom border** (not top) using the phase color.

```tsx
interface PhaseCardProps {
  tier:    string   // "Emergency" | "1st line" | "2nd line" | "3rd line" | "4th line"
  name:    string   // regimen name
  period:  string
  outcome: string
  color:   string   // phase color hex
  isActive: boolean
}
// isActive → outcome text color: #3cbf7a
// Failure/Progression → outcome text color: #e55b4d
```

### Full timeline rows

Desktop only — date in left column:
```
[  date  ] [dot] [tags] [title] [body]
            [  ] [connector line    ]
```

```css
.tl-left    { width: 100px; text-align: right; padding-right: 16px; }
.tl-date    { font-size: 11px; color: #5c6479; line-height: 1.5; }
.tl-mid     { width: 18px; display: flex; flex-direction: column; align-items: center; }
.tl-dot     { width: 10px; height: 10px; border-radius: 50%; margin-top: 3px; }
.tl-line    { width: 1px; flex: 1; min-height: 20px; background: rgba(255,255,255,0.08); }
.tl-content { flex: 1; padding: 0 0 28px 14px; }
.tl-title   { font-size: 13px; font-weight: 600; color: #e8eaf0; line-height: 1.4; margin-bottom: 5px; }
.tl-body    { font-size: 12px; color: #9ba3b8; line-height: 1.65; }
```

---

## Milestones Data

Seed data for Guangul Zekiros. Store in `data/milestones/[patientId].ts` or fetch from Firestore collection `milestones`.

```ts
export const GUANGUL_MILESTONES: Milestone[] = [
  {
    id: 'gcd-stable-mar26',
    date: '2026-03-26',
    phase: 'line4',
    type: 'response',
    dot: 'green',
    tags: [{ label: 'Stable', type: 'response' }, { label: 'GCD active', type: 'neutral' }],
    title: 'Disease stability confirmed vs December scan',
    summary: 'No new progression. Pain-free. Weight recovering 118 lbs. Q2W schedule active.',
    detail: 'Imaging comparison to Dec 2025 confirms no new progression. Pain-free. Weight 118 lbs — slight recovery from 117.8 nadir. Q2W dosing now standard to allow count recovery.',
    nextSteps: 'Continue GCD Q2W. Protein 2x/day. Counts before each cycle.',
    weight: 118, pain: 0,
  },
  {
    id: 'gcd-wheelchair-mar5',
    date: '2026-03-05',
    phase: 'line4',
    type: 'functional',
    dot: 'hollow',
    tags: [{ label: 'Functional decline', type: 'functional' }],
    title: 'Wheelchair use — counts too low, cycle delayed',
    summary: 'Weight at new low 117.8 lbs. CBC insufficient for Mar 12 treatment. Q2W dosing planned.',
    detail: 'Patient arrived by wheelchair. Weight 117.8 lbs — 24 lbs below peak. Counts insufficient for Mar 12. KCl discontinued. Protein goal 2x daily.',
    nextSteps: 'Q2W schedule. Protein 2x/day. Recheck counts.',
    weight: 118, pain: 0,
  },
  {
    id: 'palliative-feb24',
    date: '2026-02-24',
    phase: 'line4',
    type: 'functional',
    dot: 'hollow',
    tags: [{ label: 'Palliative care', type: 'functional' }],
    title: 'Palliative care consult — Dr. Terauchi',
    summary: 'Telehealth consult. Goals-of-care discussion. 14 active medications.',
    detail: 'Telehealth palliative consult. Fatigue, mobility, nausea addressed. Goals-of-care conversation with patient and son.',
    nextSteps: 'Ongoing palliative follow-ups. Coordinate with oncology.',
    pain: 0,
  },
  {
    id: 'gcd-response-feb12',
    date: '2026-02-12',
    phase: 'line4',
    type: 'response',
    dot: 'green',
    tags: [{ label: 'Response', type: 'response' }, { label: '4th line', type: 'neutral' }],
    title: 'Pain-free — weight recovering on GCD',
    summary: 'Pain fully resolved. Weight recovering to 129 lbs.',
    detail: 'Pain-free. Weight recovering to 129 lbs. Good response to GCD. Imaging comparison ordered.',
    nextSteps: 'Continue GCD. Compare to prior imaging.',
    weight: 129, pain: 0,
  },
  {
    id: 'gcd-fast-response-jan29',
    date: '2026-01-29',
    phase: 'line4',
    type: 'response',
    dot: 'green',
    tags: [{ label: 'Response', type: 'response' }, { label: '4th line', type: 'neutral' }],
    title: 'Pain 10 → 3 in one week — fastest response of any regimen',
    summary: 'Fastest pain response of any regimen. First GCD cycle — dramatic improvement.',
    detail: 'One week after cycle 1, pain dropped from 10 to 3/10. Most dramatic response of any regimen. Low platelets — dose monitoring required.',
    nextSteps: 'Continue GCD. Monitor CBC. Consider Q2W if counts low.',
    weight: 126, pain: 3,
  },
  {
    id: 'gcd-start-jan22',
    date: '2026-01-22',
    phase: 'line4',
    type: 'regimen',
    dot: 'red',
    tags: [{ label: 'Crisis', type: 'progression' }, { label: 'Regimen change', type: 'regimen' }],
    title: 'Pain 10/10 · Ivosidenib failure · 4th line initiated',
    summary: 'Maximum pain score. Gem+cis+durvalumab started. Palliative care referred.',
    detail: 'Pain at maximum 10/10. Ivosidenib failed after 3.5 months. GCD started for CCA component. Palliative intake placed.',
    nextSteps: 'GCD cycle 1. Aggressive pain management. Palliative intake.',
    weight: 126, pain: 10,
  },
  {
    id: 'ivosid-peak-dec30',
    date: '2025-12-30',
    phase: 'line3',
    type: 'response',
    dot: 'green',
    tags: [{ label: 'Best response', type: 'response' }, { label: '3rd line', type: 'neutral' }],
    title: 'Ivosidenib peak — pain-free, weight 124 lbs',
    summary: 'Complete pain resolution. Weight 124 lbs. Disease stable on imaging.',
    detail: 'Pain-free for first time since June. Weight recovered from 120 to 124 lbs. Disease stable on December imaging.',
    nextSteps: 'Continue ivosidenib. Scan comparison January.',
    weight: 124, pain: 0,
  },
  {
    id: 'ivosid-start-oct14',
    date: '2025-10-14',
    phase: 'line3',
    type: 'regimen',
    dot: 'filled',
    tags: [{ label: '3rd line starts', type: 'regimen' }],
    title: 'Ivosidenib 500 mg initiated — IDH1-targeted',
    summary: 'Oral IDH1 inhibitor. Mixed HCC/CCA drives selection. Weight 121 lbs, pain 5/10.',
    detail: 'Ivosidenib targeting IDH1 mutation. Appropriate for mixed HCC/CCA. Platelets improved off cabozantinib.',
    nextSteps: 'Evaluate at 4 and 8 weeks. Imaging December.',
    weight: 121, pain: 5,
  },
  {
    id: 'cabo-fail-sep9',
    date: '2025-09-09',
    phase: 'line2',
    type: 'progression',
    dot: 'red',
    tags: [{ label: 'Progression', type: 'progression' }, { label: '2nd line', type: 'neutral' }],
    title: 'Pain peaks at 7/10 — cabozantinib failing',
    summary: 'Pain 7/10. Weight 125 lbs. Platelets persistently suppressed. Discontinued after 6 weeks.',
    detail: 'Pain 7/10. Weight 125 — 16 lbs below peak. Platelets persistently low. Disease progression confirmed.',
    nextSteps: 'Discontinue cabozantinib. Start ivosidenib.',
    weight: 125, pain: 7,
  },
  {
    id: 'cabo-start-jul30',
    date: '2025-07-30',
    phase: 'line2',
    type: 'regimen',
    dot: 'filled',
    tags: [{ label: '2nd line starts', type: 'regimen' }],
    title: 'Cabozantinib 60 mg daily initiated',
    summary: 'Oral TKI started. Low platelets flagged immediately. Weight 127 lbs declining.',
    detail: 'Cabozantinib 2nd-line TKI. Low platelets from first visit. Bilirubin elevated.',
    nextSteps: 'CBC + LFTs q2 weeks. Monitor hepatotoxicity.',
    weight: 127, pain: 4,
  },
  {
    id: 'stride-fail-jun25',
    date: '2025-06-25',
    phase: 'line1',
    type: 'progression',
    dot: 'red',
    tags: [{ label: 'Progression', type: 'progression' }, { label: '1st line', type: 'neutral' }],
    title: 'STRIDE failure — disease progressing after 8 months',
    summary: 'Weight −11 lbs from peak. Pain returned 4/10. Imaging confirmed progression.',
    detail: 'Weight dropped from 141 to 130 lbs. Pain re-emerged at 4/10. Imaging confirmed progression. STRIDE discontinued.',
    nextSteps: 'Switch to cabozantinib 60 mg daily.',
    weight: 130, pain: 4,
  },
  {
    id: 'stride-peak-mar31',
    date: '2025-03-31',
    phase: 'line1',
    type: 'response',
    dot: 'green',
    tags: [{ label: 'Best response', type: 'response' }, { label: '1st line', type: 'neutral' }],
    title: 'Peak STRIDE response — pain-free, weight 141 lbs',
    summary: 'Best clinical status since diagnosis. Pain resolved. Imaging stable.',
    detail: 'Weight 141 lbs. Pain-free. Disease stable. Anxiety resolved. Entecavir managing HCV reactivation.',
    nextSteps: 'Continue STRIDE. CT CAP at 8-week interval.',
    weight: 141, pain: 0,
  },
  {
    id: 'stride-pain-dec9',
    date: '2024-12-09',
    phase: 'line1',
    type: 'symptom',
    dot: 'amber',
    tags: [{ label: 'Symptom', type: 'symptom' }, { label: '1st line', type: 'neutral' }],
    title: 'Pain flare to 6/10 — worst episode on STRIDE',
    summary: 'Mid-cycle pain flare. Weight declined to 137 lbs. Opioid adjusted.',
    detail: 'Worst pain since starting therapy. Weight dropped to 137 lbs. Inflammatory response likely treatment-related.',
    nextSteps: 'Opioid adjusted. Continue STRIDE cycle 4.',
    weight: 137, pain: 6,
  },
  {
    id: 'stride-start-nov11',
    date: '2024-11-11',
    phase: 'line1',
    type: 'regimen',
    dot: 'filled',
    tags: [{ label: '1st line starts', type: 'regimen' }],
    title: 'C1D1 STRIDE: Tremelimumab 300 mg + Durvalumab 1500 mg',
    summary: '1st-line dual immunotherapy started. Pain-free after cycle 2.',
    detail: 'STRIDE started. Patient improved after cycle 2 — no anxiety, no abdominal pain.',
    nextSteps: 'Cycle 3 D1. CBC, CMP, TFTs q4 weeks.',
    weight: 141, pain: 0,
  },
  {
    id: 'consult-oct24',
    date: '2024-10-24',
    phase: 'pre',
    type: 'regimen',
    dot: 'hollow',
    tags: [{ label: 'Initial consult', type: 'neutral' }],
    title: 'HemOnc consult · Staging & treatment plan',
    summary: 'MRI: 7.6 cm treated tumor. Staged T4 · BCLC-B/C. STRIDE planned.',
    detail: 'MRI: 7.6 cm treated tumor segment 4b, possible residual. Stage IIIB+ · BCLC-B/C. Child score 6. Positive ctDNA. Plan: STRIDE after stabilization.',
    nextSteps: 'Begin STRIDE cycle 1.',
    weight: 142, pain: 3,
  },
  {
    id: 'rupture-oct12',
    date: '2024-10-12',
    phase: 'pre',
    type: 'hospitalization',
    dot: 'red',
    tags: [{ label: 'Hospitalization', type: 'progression' }],
    title: 'Ruptured HCC · Emergency presentation',
    summary: '7.1 cm HCC ruptured with active extravasation. Emergency embolization Oct 13. Discharged Oct 18.',
    detail: 'Severe abdominal pain after lifting. Hypotension, near-syncope, Hgb 11.8. CT: 7.1 cm left hepatic lobe mass with active extravasation + hemoperitoneum. Emergency IR: left hepatic artery coil + bland embolization. Admitted through Oct 18.',
    nextSteps: 'Establish oncology. Plan systemic therapy.',
    pain: 9,
  },
]
```

---

## Treatment Phases Data

```ts
export const GUANGUL_PHASES: TreatmentPhase[] = [
  {
    key: 'pre', label: 'Pre-treatment', shortLabel: 'Pre-tx',
    color: '#6b7280', period: 'Oct – Nov 2024', duration: '~3 weeks',
    outcome: 'Stabilized', note: 'Emergency embolization → oncology consult',
    wtStart: 142, wtEnd: 141, painPeak: 3, isActive: false,
  },
  {
    key: 'line1', label: 'STRIDE — durvalumab + tremelimumab', shortLabel: 'STRIDE',
    color: '#4a7fd4', period: 'Nov 2024 – Jun 2025', duration: '~8 months',
    outcome: 'Progression', note: '1st line · best response Mar 2025',
    wtStart: 141, wtEnd: 130, painPeak: 6, isActive: false,
  },
  {
    key: 'line2', label: 'Cabozantinib — TKI 2nd line', shortLabel: 'Cabo',
    color: '#1a8a66', period: 'Jul – Oct 2025', duration: '~3 months',
    outcome: 'Failure', note: '2nd line · platelets low throughout',
    wtStart: 127, wtEnd: 121, painPeak: 7, isActive: false,
  },
  {
    key: 'line3', label: 'Ivosidenib — IDH1 inhibitor 3rd line', shortLabel: 'Ivosid',
    color: '#c08030', period: 'Oct 2025 – Jan 2026', duration: '~3.5 months',
    outcome: 'Failure', note: '3rd line · best response Dec 2025',
    wtStart: 121, wtEnd: 126, painPeak: 10, isActive: false,
  },
  {
    key: 'line4', label: 'Gem + Cis + Durvalumab — 4th line', shortLabel: 'GCD',
    color: '#c04040', period: 'Jan 2026 – present', duration: '~2 months+',
    outcome: 'Active', note: '4th line · rapid pain response · Q2W schedule',
    wtStart: 126, wtEnd: 118, painPeak: 10, isActive: true,
  },
]
```

---

## Component Tree

```
src/
├── components/
│   ├── timeline/
│   │   ├── DiseaseTimelineCard.tsx    ← dashboard card (desktop + mobile)
│   │   ├── PhaseStrip.tsx             ← proportional phase color bar
│   │   ├── MilestoneRow.tsx           ← single timeline row (dot + content)
│   │   ├── MilestoneTag.tsx           ← colored uppercase tag pill
│   │   └── TreatmentPhaseCard.tsx     ← phase summary card in full view
│   └── ...existing components
│
├── pages/ (or app/)
│   └── [patientId]/
│       └── timeline/
│           └── page.tsx               ← full timeline page
│
├── data/
│   └── milestones/
│       └── guangul-zekiros.ts         ← seed data above
│
└── types/
    └── timeline.ts                    ← types above
```

---

## Behaviour Notes

- **Milestones are always reverse-chronological** (most recent first) on both views
- **Dashboard card:** tapping the card header `›` or "View full timeline ↗" navigates to `/[patientId]/timeline`
- **Full timeline page:** back arrow returns to dashboard
- **Phase strip flex widths:** use `PHASE_FLEX` constant — do not compute from dates dynamically for now
- **No expand/collapse on dashboard card** — it is read-only; all interaction happens on the full page
- **Mobile breakpoint:** `max-width: 768px` — switch from two-column date layout to inline date layout at this breakpoint

---

## Screenshots

The following reference images are included alongside this spec:

| File | Description |
|------|-------------|
| `dashboard_desktop.png` | Full dashboard — desktop, showing timeline card at top spanning full width |
| `dashboard_mobile.png` | Full dashboard — mobile, single column, timeline card first |
| `timeline_mobile_card.png` | Close-up of mobile timeline card — single milestone, phase strip, footer |
| `timeline_full_light.png` | Full timeline page layout reference (implement in dark theme) |
