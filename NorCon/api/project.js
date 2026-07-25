const redisUrl   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const headers = {
  Authorization: `Bearer ${redisToken}`,
  "Content-Type": "application/json",
};

function normaliseCode(value) {
  return String(value || "").toUpperCase().trim();
}

function readBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function projectKey(projectCode) {
  return `project:${normaliseCode(projectCode)}`;
}

async function redisGet(key) {
  const r = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([["GET", key]]),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Redis error");
  return data[0]?.result;
}

async function redisSet(key, value) {
  const r = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([["SET", key, value]]),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Redis error");
  return data[0]?.result;
}

function collectLoginMembers(state) {
  const loginCodes = Array.isArray(state?.l2?.loginCodes) ? state.l2.loginCodes : [];
  const teamMembers = Array.isArray(state?.l2?.sheets?.["02"]?.data?.teamMembers)
    ? state.l2.sheets["02"].data.teamMembers
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
  const externalUsers = Array.isArray(state?.l2?.sheets?.["02"]?.data?.externalUsers)
    ? state.l2.sheets["02"].data.externalUsers
    : [];
  const externalMembers = externalUsers
    .filter(user => user?.loginCode)
    .map(user => ({
      loginCode: user.loginCode,
      name: user.name || user.organisation || `${user.type || "External"} user`,
      role: user.type === "sponsor" ? "Project Sponsor" : user.type === "observer" ? "Observer" : "Guest",
      accessType: user.type || "guest",
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
  return !!member && (member.isPM === true || member.role === "Project Manager");
}

function hasMemberCodes(state) {
  return collectLoginMembers(state).length > 0;
}

function isLaunchedProject(state) {
  return state?.project?.status === "active" || !!state?.baseline || !!state?.currentPlan;
}

function authoriseSave(existingState, incomingState, memberCode) {
  if (!normaliseCode(memberCode)) {
    return { ok:false, status:401, error:"memberCode required to save project state" };
  }

  const incomingPm = isProjectManager(findMember(incomingState, memberCode));

  if (!existingState) {
    if (incomingPm) return { ok:true };
    return { ok:false, status:403, error:"Initial project save requires a Project Manager code" };
  }

  if (findMember(existingState, memberCode)) return { ok:true };

  if (!hasMemberCodes(existingState) && incomingPm) {
    return { ok:true };
  }

  if (!isLaunchedProject(existingState) && incomingPm) {
    return { ok:true };
  }

  return { ok:false, status:403, error:"Valid team member code required to save this project" };
}

export default async function handler(req, res) {
  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: "Redis not configured" });
  }

  try {
    if (req.method === "GET") {
      const { projectCode, memberCode } = req.query;
      if (!projectCode) return res.status(400).json({ error: "projectCode required" });
      if (!memberCode) return res.status(401).json({ error: "memberCode required" });

      const key = projectKey(projectCode);
      const raw = await redisGet(key);
      if (!raw) return res.status(404).json({ error: "Project not found" });

      const project = JSON.parse(raw);
      const member = findAuthMember(project, memberCode);
      if (!member) return res.status(401).json({ error: "Invalid member code" });
      return res.status(200).json({ project, member });
    }

    if (req.method === "POST") {
      const { projectCode, state, memberCode } = readBody(req);
      if (!projectCode || !state) {
        return res.status(400).json({ error: "projectCode and state required" });
      }

      const code = normaliseCode(projectCode);
      const stateCode = normaliseCode(state?.project?.code || code);
      if (stateCode && stateCode !== code) {
        return res.status(400).json({ error: "Project code mismatch" });
      }

      const key = projectKey(code);
      const existingRaw = await redisGet(key);
      const existingState = existingRaw ? JSON.parse(existingRaw) : null;
      const auth = authoriseSave(existingState, state, memberCode);
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

      await redisSet(key, JSON.stringify(state));
      return res.status(200).json({ ok: true, key });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Project API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
