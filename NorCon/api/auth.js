// /api/auth - validate login code and return project state + user rights
// POST { projectCode, memberCode }

const UPSTASH_URL   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function normaliseCode(value) {
  return String(value || '').toUpperCase().trim();
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) throw new Error('Redis not configured');
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['GET', key]]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redis error');
  return data[0]?.result;
}

function collectAuthMembers(state) {
  const loginCodes = Array.isArray(state?.l2?.loginCodes) ? state.l2.loginCodes : [];
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
  [...loginCodes, ...externalMembers].forEach((member) => {
    const code = normaliseCode(member?.loginCode);
    if (!code) return;
    byCode.set(code, { ...(byCode.get(code) || {}), ...member, loginCode: code });
  });
  return [...byCode.values()];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { projectCode, memberCode } = readBody(req);
    if (!projectCode || !memberCode) {
      return res.status(400).json({ error: 'projectCode and memberCode required' });
    }

    const code = normaliseCode(projectCode);
    const mCode = normaliseCode(memberCode);

    const raw = await redisGet(`project:${code}`);
    if (!raw) {
      return res.status(404).json({ error: 'Project not found. Check your project code.' });
    }

    const state = JSON.parse(raw);
    const member = collectAuthMembers(state).find(lc => normaliseCode(lc.loginCode) === mCode);

    if (!member) {
      return res.status(401).json({ error: 'Invalid team member code. Check your login code.' });
    }

    const isExternal = member.isExternal === true;
    const isPM = !isExternal && (member.isPM === true || member.role === 'Project Manager');
    const isSponsor = !isExternal && (member.role === 'Project Sponsor' || member.role === 'Project Director');
    const canApprove = !isExternal && (isPM || isSponsor);
    const rights = {
      isPM,
      isSponsor,
      canApprove,
      role: member.role,
      name: member.name,
      loginCode: member.loginCode,
      isExternal,
      accessType: member.accessType || null,
      raciRights: buildRaciRights(member.loginCode, state),
    };

    return res.status(200).json({ ok: true, member: rights, state });
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function buildRaciRights(loginCode, state) {
  const raciData = state.l2?.sheets?.['04']?.data || {};
  const raciRows = [...(raciData.raciRows || []), ...(raciData.customRows || [])];
  const rights = {};
  raciRows.forEach(row => {
    const assignment = row.assignments?.[loginCode];
    if (assignment) rights[row.taskId] = assignment;
  });
  return rights;
}
