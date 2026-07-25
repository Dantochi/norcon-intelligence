// NorCon Projects — Global App State
// Single source of truth shared across all layers

export const INITIAL_STATE = {
  // ── Active layer ─────────────────────────────────────────────────────────
  activeLayer: 'setup', // 'setup' | 'L3'

  // ── Project tier (set in TierSelect screen) ───────────────────────────────
  projectTier: null,    // 'light' | 'full' | null

  // ── Project metadata (set in PMSetup screen) ─────────────────────────────
  project: {
    name: '',
    code: '',          // e.g. "WF" → used for login code prefix
    teamSize: 0,
    status: 'draft',   // 'draft' | 'active' | 'closed'
  },

  // ── Baseline (frozen at project launch, never modified) ───────────────────
  baseline: null,
  // baseline shape when set:
  // {
  //   version:       1,
  //   confirmedDate: 'YYYY-MM-DD',
  //   confirmedBy:   'LOGIN-CODE',
  //   snapshot: {
  //     charter:      { ... },   // from sheets["01"].data.charter
  //     activities:   [ ... ],   // from sheets["03"].data.activities
  //     milestones:   [ ... ],   // from sheets["03"].data.milestones
  //     risks:        [ ... ],   // from sheets["05"].data.risks
  //     deliverables: [ ... ],   // from sheets["07"].data.deliverables
  //     benefits:     [ ... ],   // from sheets["01"].data.charter.benefits
  //     budget:       '...',     // from charter.budget
  //   }
  // }

  // ── Current Approved Plan (evolves with approved CCRs) ────────────────────
  currentPlan: null,
  // currentPlan shape mirrors baseline.snapshot

  // ── Layer 2 state ─────────────────────────────────────────────────────────
  l2: {
    currentSheet: 'setup', // 'setup' | '01' ... '10'

    // Sheet completion status
    sheets: {
      '01': { status: 'empty', locked: false, data: {} },
      '02': { status: 'empty', locked: false, data: { teamMembers: [] } },
      '03': { status: 'empty', locked: false, data: { activities: [], milestones: [] } },
      '04': { status: 'empty', locked: false, data: { raciRows: [] } },
      '05': { status: 'empty', locked: false, data: { risks: [] } },
      '06': { status: 'empty', locked: false, data: { changes: [] } },
      '07': { status: 'empty', locked: false, data: { deliverables: [] } },
      '08': { status: 'empty', locked: false, data: { stakeholders: [] } },
      '10': { status: 'empty', locked: false, data: { enabled: {}, selected: {}, actLinks: {} } },
    },

    // Team login codes — single source of truth for all team member identities.
    // Shape: [{ loginCode, name, role, isPM, deliveryRole? }]
    // All reads for team membership (RACI, Risks, Change Control, L3 auth) come from here.
    // Sheet02Team writes to data.teamMembers (for rich detail) AND this array (for identity).
    // App.jsx handleSheetUpdate("02", ...) automatically syncs teamMembers → loginCodes.
    loginCodes: [],

    // Stage 1 synthesised project document (the "container") — persisted so the
    // Review Data → Synthesised Document tab survives refreshes and L3 round-trips.
    intermediateDoc: "",
  },

  // ── Layer 3 state ─────────────────────────────────────────────────────────
  l3: {
    unlocked: false,
    activeElements: [],
  },
};

// Sheet metadata
export const SHEETS = [
  { id: '01', label: 'Charter',        icon: 'ti-file-description', enforced: false },
  { id: '02', label: 'Team',           icon: 'ti-users',            enforced: true  },
  { id: '03', label: 'Schedule',       icon: 'ti-calendar',         enforced: true  },
  { id: '04', label: 'RACI',           icon: 'ti-table',            enforced: true  },
  { id: '05', label: 'Risks',          icon: 'ti-alert-triangle',   enforced: false },
  { id: '06', label: 'Change Control', icon: 'ti-git-branch',       enforced: false },
  { id: '07', label: 'KD Tracker',     icon: 'ti-target',           enforced: false },
  { id: '08', label: 'Stakeholders',   icon: 'ti-users-group',      enforced: false },
  { id: '10', label: 'Sustainability', icon: 'ti-leaf',             enforced: false },
];

// Status config
export const STATUS_CONFIG = {
  empty:        { label: 'Empty',       color: 'var(--color-text-secondary)',  bg: 'var(--color-background-secondary)' },
  'ai-draft':   { label: 'AI Draft',    color: 'var(--color-text-info)',       bg: 'var(--color-background-info)'      },
  'in-progress':{ label: 'In Progress', color: 'var(--color-text-warning)',    bg: 'var(--color-background-warning)'   },
  approved:     { label: 'Approved',    color: 'var(--color-text-success)',    bg: 'var(--color-background-success)'   },
};

// ── Code generation — single authority for ALL codes platform-wide ──────────
// No component may generate codes inline; always import from here.
// Uniform format: <PROJECT-CODE>-<4 digits> for team members (incl. PM),
//                 <SP|GU|OB>-<4 digits> for external users.

// Generate a team member login code: PROJECTCODE-XXXX
// Uses the full project code as entered (input is capped at 6 chars).
// Deduplicates against existingCodes to guarantee uniqueness within a project.
export function generateLoginCode(projectCode, existingCodes = []) {
  const prefix = (projectCode || 'NC').toUpperCase().slice(0, 6);
  let code;
  do {
    const num = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${num}`;
  } while (existingCodes.includes(code));
  return code;
}

// Generate an external user code: SP-XXXX / GU-XXXX / OB-XXXX
// Deduplicates against existingCodes (pass ALL codes — team + external).
export function generateExternalCode(type, existingCodes = []) {
  const prefix = { sponsor:'SP', guest:'GU', observer:'OB' }[type] || 'EX';
  let code;
  do {
    const num = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${num}`;
  } while (existingCodes.includes(code));
  return code;
}

// Collect every code currently in use across the project — the one list to
// pass as existingCodes so no generator can ever collide with another.
export function collectAllCodes(state) {
  const l2 = state?.l2 || {};
  const team = l2.sheets?.['02']?.data?.teamMembers || [];
  const ext  = l2.sheets?.['02']?.data?.externalUsers || [];
  return [
    ...(l2.loginCodes || []).map(m => m.loginCode),
    ...team.map(m => m.loginCode),
    ...ext.map(u => u.loginCode),
  ].filter(Boolean);
}

// Derive sheet status from data
export function deriveSheetStatus(sheetId, sheetData) {
  if (sheetData.locked) return 'approved';
  const hasUserData = Object.values(sheetData.data || {}).some(v =>
    Array.isArray(v) ? v.length > 0 : (v !== '' && v !== null && v !== undefined)
  );
  if (hasUserData) return 'in-progress';
  return 'empty';
}

// Check if a sheet is accessible given the enforced order
// Enforced order: 02 → 03 → 04 → then free
export function isSheetAccessible(sheetId, sheets) {
  const enforced = ['02', '03', '04'];
  const idx = enforced.indexOf(sheetId);
  if (idx === -1) return true;
  if (sheetId === '02') return true;
  if (sheetId === '03') return sheets['02']?.locked;
  if (sheetId === '04') return sheets['03']?.locked;
  return true;
}
