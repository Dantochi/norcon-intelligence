// /api/state - save and load project state via Upstash Redis
// GET  ?code=WF&memberCode=WF-1234 -> load project state
// POST { code, state, memberCode } -> save project state

const UPSTASH_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('Upstash Redis not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to environment variables.');
  }
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis error');
  return data[0]?.result;
}

function normaliseCode(value) {
  return String(value || '').toUpperCase().trim();
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function collectLoginMembers(state) {
  const loginCodes = Array.isArray(state?.l2?.loginCodes) ? state.l2.loginCodes : [];
  const teamMembers = Array.isArray(state?.l2?.sheets?.['02']?.data?.teamMembers)
    ? state.l2.sheets['02'].data.teamMembers
    : [];

  const byCode = new Map();
  [...loginCodes, ...teamMembers].forEach((member) => {
    const code = normaliseCode(member?.loginCode);
    if (!code) return;
    byCode.set(code, { ...(byCode.get(code) || {}), ...member, loginCode: code });
  });
  return [...byCode.values()];
}

function collectAuthMembers(state) {
  const externalUsers = Array.isArray(state?.l2?.sheets?.['02']?.data?.externalUsers)
    ? state.l2.sheets['02'].data.externalUsers
    : [];
  const externalMembers = externalUsers
    .filter(user => user?.loginCode)
    .map(user => ({
      loginCode: user.loginCode,
      name: user.name || user.organisation || `${user.type || 'External'} user`,
      role: user.type === 'sponsor' ? 'Project Sponsor' : user.type === 'observer' ? 'Observer' : 'Guest',
      accessType: user.type || 'guest',
      isExternal: true,
    }));

  const byCode = new Map();
  [...collectLoginMembers(state), ...externalMembers].forEach((member) => {
    const code = normaliseCode(member?.loginCode);
    if (!code) return;
    byCode.set(code, { ...(byCode.get(code) || {}), ...member, loginCode: code });
  });
  return [...byCode.values()];
}

function findMember(state, memberCode) {
  const code = normaliseCode(memberCode);
  if (!code) return null;
  return collectLoginMembers(state).find(member => normaliseCode(member.loginCode) === code) || null;
}

function findAuthMember(state, memberCode) {
  const code = normaliseCode(memberCode);
  if (!code) return null;
  return collectAuthMembers(state).find(member => normaliseCode(member.loginCode) === code) || null;
}

function isProjectManager(member) {
  return !!member && (member.isPM === true || member.role === 'Project Manager');
}

function hasMemberCodes(state) {
  return collectLoginMembers(state).length > 0;
}

function isLaunchedProject(state) {
  return state?.project?.status === 'active' || !!state?.baseline || !!state?.currentPlan;
}

function authoriseSave(existingState, incomingState, memberCode) {
  if (!normaliseCode(memberCode)) {
    return { ok:false, status:401, error:'memberCode required to save project state' };
  }

  const incomingPm = isProjectManager(findMember(incomingState, memberCode));

  if (!existingState) {
    if (incomingPm) return { ok:true };
    return { ok:false, status:403, error:'Initial project save requires a Project Manager code' };
  }

  if (findMember(existingState, memberCode)) return { ok:true };

  // Legacy recovery path for old saved states that predate login-code persistence.
  if (!hasMemberCodes(existingState) && incomingPm) {
    return { ok:true };
  }

  // Draft recovery path: a setup/draft project can be reclaimed by the PM in
  // the incoming state. Active/baselined projects remain protected by saved codes.
  if (!isLaunchedProject(existingState) && incomingPm) {
    return { ok:true };
  }

  return { ok:false, status:403, error:'Valid team member code required to save this project' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const code = normaliseCode(req.query.code);
      const memberCode = normaliseCode(req.query.memberCode);
      if (!code) return res.status(400).json({ error: 'Project code required' });
      if (!memberCode) return res.status(401).json({ error: 'memberCode required to load project state' });

      const raw = await redis(['GET', `project:${code}`]);
      if (!raw) return res.status(404).json({ error: 'Project not found' });

      const state = JSON.parse(raw);
      if (!findAuthMember(state, memberCode)) {
        return res.status(401).json({ error: 'Invalid member code' });
      }

      return res.status(200).json({ state });
    }

    if (req.method === 'POST') {
      const { code, state, memberCode } = readBody(req);
      if (!code || !state) return res.status(400).json({ error: 'code and state required' });

      const projectCode = normaliseCode(code);
      const stateCode = normaliseCode(state?.project?.code || projectCode);
      if (stateCode && stateCode !== projectCode) {
        return res.status(400).json({ error: 'Project code mismatch' });
      }

      const key = `project:${projectCode}`;
      const existingRaw = await redis(['GET', key]);
      const existingState = existingRaw ? JSON.parse(existingRaw) : null;
      const auth = authoriseSave(existingState, state, memberCode);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

      await redis(['SET', key, JSON.stringify(state)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('State API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
