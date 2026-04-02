import { describe, it, expect } from 'vitest'
import { parseSection, deriveSpecialty, SPECIALTIES } from '../lib/noteUtils'

// ── Sample note text matching real Epic/Dragon format ─────────────────────────

const SAMPLE_NOTE = `Texas Oncology Sammons
3410 Worth Street

PATIENT: GUANGUL ZEKIROS

History of Present Illness:
68 y.o. male who presented with severe abdominal pain.

Problem List:

	Hepatoma ( ICD-10:C22.0 ;Liver cell carcinoma )
	Thrombocytopenia ( ICD-10:D69.6 )
	Fatigue ( ICD-10:R53.83 )

Impression:
68-year-old male patient with previously ruptured HCC, now status post embolization. BCLC stage B/C. Child score 6.

Plan:
Extensive counseling as above.
Plan for systemic therapy with immunotherapy.

.

Laith Abushahin MD

_ESignSection_Electronically signed by Laith Abushahin MD 10/28/2024 17:44 CDT`

// ── parseSection ──────────────────────────────────────────────────────────────

describe('parseSection', () => {
  it('extracts the Impression section', () => {
    const result = parseSection(SAMPLE_NOTE, 'Impression')
    expect(result).toContain('68-year-old male')
    expect(result).toContain('BCLC stage B/C')
  })

  it('extracts the Plan section', () => {
    const result = parseSection(SAMPLE_NOTE, 'Plan')
    expect(result).toContain('systemic therapy')
    expect(result).toContain('immunotherapy')
  })

  it('extracts the Problem List section', () => {
    const result = parseSection(SAMPLE_NOTE, 'Problem List')
    expect(result).toContain('Hepatoma')
    expect(result).toContain('Thrombocytopenia')
    expect(result).toContain('Fatigue')
  })

  it('does not bleed into the next section', () => {
    const impression = parseSection(SAMPLE_NOTE, 'Impression')
    // Impression content should not contain Plan content
    expect(impression).not.toContain('systemic therapy')
  })

  it('returns empty string for a section that does not exist', () => {
    expect(parseSection(SAMPLE_NOTE, 'Nonexistent Section')).toBe('')
  })

  it('returns empty string for empty text', () => {
    expect(parseSection('', 'Impression')).toBe('')
  })

  it('strips leading whitespace and tabs from each line', () => {
    const result = parseSection(SAMPLE_NOTE, 'Problem List')
    // Lines should not start with tabs
    result.split('\n').forEach(line => {
      expect(line).not.toMatch(/^\t/)
    })
  })

  it('does not include the e-signature block', () => {
    const result = parseSection(SAMPLE_NOTE, 'Plan')
    expect(result).not.toContain('_ESign')
    expect(result).not.toContain('Electronically signed')
  })
})

// ── deriveSpecialty ───────────────────────────────────────────────────────────

describe('deriveSpecialty', () => {
  it('detects oncology from HemOnc note names', () => {
    expect(deriveSpecialty('HemOnc Follow Up {Dragon} - Abushahin')).toBe('oncology')
    expect(deriveSpecialty('HemOnc Consult {Dragon} - Abushahin')).toBe('oncology')
    expect(deriveSpecialty('*Abushahin - DS Follow Up Note - HemOnc')).toBe('oncology')
    expect(deriveSpecialty('APP HemOnc Follow Up - Carone')).toBe('oncology')
  })

  it('detects palliative from palliative care note names', () => {
    expect(deriveSpecialty('Telehealth Palliative Care Consult - Terauchi')).toBe('palliative')
    expect(deriveSpecialty('Telehealth Palliative Care Follow Up - Terauchi')).toBe('palliative')
  })

  it('detects liver from hepatology note names', () => {
    expect(deriveSpecialty('Hepatology Follow Up')).toBe('liver')
    expect(deriveSpecialty('Liver Consult Note')).toBe('liver')
  })

  it('detects kidney from nephrology note names', () => {
    expect(deriveSpecialty('Nephrology Follow Up')).toBe('kidney')
    expect(deriveSpecialty('Kidney Check')).toBe('kidney')
  })

  it('falls back to other for unrecognized note names', () => {
    expect(deriveSpecialty('General Checkup')).toBe('other')
    expect(deriveSpecialty('')).toBe('other')
    expect(deriveSpecialty('Unknown Specialist Note')).toBe('other')
  })

  it('is case-insensitive', () => {
    expect(deriveSpecialty('hemonc follow up')).toBe('oncology')
    expect(deriveSpecialty('PALLIATIVE CARE')).toBe('palliative')
  })
})

// ── SPECIALTIES map ───────────────────────────────────────────────────────────

describe('SPECIALTIES', () => {
  it('has a display label for every specialty slug', () => {
    expect(SPECIALTIES.oncology).toBe('Oncology')
    expect(SPECIALTIES.palliative).toBe('Palliative')
    expect(SPECIALTIES.liver).toBe('Liver')
    expect(SPECIALTIES.kidney).toBe('Kidney')
    expect(SPECIALTIES.other).toBe('Other')
  })

  it('covers all slugs returned by deriveSpecialty', () => {
    const slugs = ['oncology', 'palliative', 'liver', 'kidney', 'other']
    slugs.forEach(s => expect(SPECIALTIES[s]).toBeTruthy())
  })
})
