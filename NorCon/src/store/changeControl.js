// Change Control — state utilities and constants
export const BASELINE_FIELDS = {
  // Charter fields that trigger CCR
  charter: ['purpose', 'withinScope', 'outOfScope', 'startDate', 'endDate', 'budget'],
  // Schedule fields
  activity: ['startDate', 'targetDate'],
  milestone: ['targetDate'],
  // Deliverable fields
  deliverable: ['target', 'deadlineV1'],
};
// "No Impact" is mutually exclusive with the four substantive options —
// selecting it signals the PM has considered impact and confirmed there is none.
export const IMPACT_OPTIONS   = ['Scope', 'Time', 'Cost', 'Quality', 'No Impact'];
export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

// generateCCRId: derives next ID from the maximum existing CCR numeric suffix,
// not from array length — prevents ID collision when records are deleted.
export function generateCCRId(existingChanges) {
  const major  = (existingChanges || []).filter(c => (c.id || '').startsWith('CCR-'));
  const maxNum = major.reduce((max, c) => {
    const n = parseInt((c.id || '').replace('CCR-', ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `CCR-${String(maxNum + 1).padStart(3, '0')}`;
}

// generateMinorId: same max-based approach for minor change IDs.
export function generateMinorId(existingChanges) {
  const minor  = (existingChanges || []).filter(c => (c.id || '').startsWith('MIN-'));
  const maxNum = minor.reduce((max, c) => {
    const n = parseInt((c.id || '').replace('MIN-', ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `MIN-${String(maxNum + 1).padStart(3, '0')}`;
}

// Build a human-readable description of what changed
export function describeChange(elementType, fieldName, oldValue, newValue) {
  const labels = {
    purpose: 'Project Purpose',
    withinScope: 'Within Scope',
    outOfScope: 'Out of Scope',
    startDate: 'Project Start Date',
    endDate: 'Project End Date',
    budget: 'Project Budget',
    targetDate: 'Target Date',
    target: 'Target Value',
    deadlineV1: 'Deadline',
  };
  const label = labels[fieldName] || fieldName;
  const oldStr = Array.isArray(oldValue) ? oldValue.join(', ') : (oldValue || '(empty)');
  const newStr = Array.isArray(newValue) ? newValue.join(', ') : (newValue || '(empty)');
  return `${label} changed from "${oldStr}" to "${newStr}"`;
}
// Check if a field is a baseline field
export function isBaselineField(elementType, fieldName) {
  return (BASELINE_FIELDS[elementType] || []).includes(fieldName);
}
// Get proposed value for an element (if a CCR is pending for it)
export function getDisplayValue(element, fieldName, allChanges, currentUserCode) {
  if (!element || !allChanges) return element?.[fieldName];
  // Find pending CCR for this element+field
  const pending = allChanges.find(c =>
    c.type === 'major' &&
    c.elementId === element._id &&
    c.fieldName === fieldName &&
    c.status !== 'approved' &&
    c.status !== 'rejected'
  );
  if (!pending) return element[fieldName];
  // Show proposed value only to submitter, reviewer, approver
  const canSeeProposed = [pending.submittedBy, pending.reviewerCode, pending.approverCode].includes(currentUserCode);
  return canSeeProposed ? pending.proposedValue : element[fieldName];
}
// Determine approver for a change.
// Supports BOTH old tier-based and new rights-based approver structures.
export function getApproverForChange(impacts, approvers) {
  if (!approvers || !approvers.length) return null;
  // New system: rights array contains "approver"
  const byRights = approvers.find(a => (a.rights || []).includes('approver'));
  if (byRights) return byRights;
  // Legacy: tier-based
  const needsTier1 = (impacts || []).includes('Scope') || (impacts || []).includes('Cost');
  const tier = needsTier1 ? 'Tier 1 — Sponsor' : 'Tier 3 — Project Manager';
  return approvers.find(a => a.tier === tier) || approvers[0];
}
export function getReviewerForChange(approvers) {
  if (!approvers || !approvers.length) return null;
  // New system: rights array contains "reviewer"
  const byRights = approvers.find(a => (a.rights || []).includes('reviewer'));
  if (byRights) return byRights;
  // Legacy: Tier 3 PM
  return approvers.find(a => a.tier === 'Tier 3 — Project Manager') || approvers[0];
}