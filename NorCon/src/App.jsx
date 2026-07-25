import { useState, useCallback, useEffect, useRef } from "react";
import ProjectSetup   from "./layers/ProjectSetup.jsx";
import OperatingLayer from "./layers/OperatingLayer.jsx";
import LandingScreen  from "./layers/LandingScreen.jsx";
import { INITIAL_STATE }         from "./store/appStore.js";
import { buildSnapshot }         from "./store/baselineUtils.js";
import { useProjectPersistence } from "./store/useProjectPersistence.js";

const C = { bg:"#0D2B1B", surface:"#122E1E", border:"#1F4D34", accent:"#2E7D52", accentL:"#3a9962", sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66", risk:"#e05c5c" };

const SESSION_KEY    = "norcon_session_v1";
const LAST_LOGIN_KEY = "norcon_last_login";

function createInitialState() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

function getSaveMemberCode(state, member) {
  if (member?.loginCode) return member.loginCode;
  const pm = state.l2?.loginCodes?.find(m => m.isPM || m.role === "Project Manager");
  return pm?.loginCode || "";
}

function isProjectManagerEntry(member) {
  return !!member && (member.isPM === true || member.role === "Project Manager");
}

function getProjectManagerCode(state, member) {
  if (isProjectManagerEntry(member) && member?.loginCode) return member.loginCode;
  const teamMembers = state.l2?.sheets?.["02"]?.data?.teamMembers || [];
  const pm = [...(state.l2?.loginCodes || []), ...teamMembers].find(isProjectManagerEntry);
  return pm?.loginCode || "";
}

function hasProjectManagerCode(state) {
  return !!getProjectManagerCode(state, null);
}

function isReadOnlyMember(member) {
  return member?.isExternal === true && !member?.isPM && !member?.canApprove;
}

function migrateActivityReferences(state, idMap = {}, removedIds = []) {
  const mappings = Object.fromEntries(
    Object.entries(idMap || {}).filter(([from, to]) => from && to && from !== to)
  );
  const removed = new Set((removedIds || []).filter(Boolean));
  if (Object.keys(mappings).length === 0 && removed.size === 0) return state;

  const replaceId = (id) => mappings[id] || id;
  const isRemoved = (id) => removed.has(id);
  const migrateRows = (rows = []) => rows
    .filter(row => !isRemoved(row.taskId))
    .map(row => ({ ...row, taskId: replaceId(row.taskId) }));
  const migrateChanges = (changes = []) => changes
    .filter(change => !["elementId", "linkedId", "targetId", "sourceId"].some(key => isRemoved(change?.[key])))
    .map(change => {
      const next = { ...change };
      ["elementId", "linkedId", "targetId", "sourceId"].forEach(key => {
        if (next[key]) next[key] = replaceId(next[key]);
      });
      return next;
    });
  const migrateActLinks = (actLinks = {}) => {
    if (!actLinks || typeof actLinks !== "object" || Array.isArray(actLinks)) return actLinks;
    return Object.entries(actLinks).reduce((acc, [key, value]) => {
      if (isRemoved(key)) return acc;
      const nextKey = replaceId(key);
      if (typeof value === "string") {
        acc[nextKey] = isRemoved(value) ? "" : replaceId(value);
      } else if (Array.isArray(value)) {
        acc[nextKey] = value.filter(v => !isRemoved(v)).map(v => typeof v === "string" ? replaceId(v) : v);
      } else {
        acc[nextKey] = value;
      }
      return acc;
    }, {});
  };

  const sheets = state.l2?.sheets || {};
  const d04 = sheets["04"]?.data || {};
  const d06 = sheets["06"]?.data || {};
  const d10 = sheets["10"]?.data || {};

  return {
    ...state,
    sustainData: state.sustainData ? {
      ...state.sustainData,
      evidence: (state.sustainData.evidence || [])
        .filter(e => !isRemoved(e.activityId))
        .map(e => ({ ...e, activityId: replaceId(e.activityId) })),
    } : state.sustainData,
    l2: {
      ...state.l2,
      sheets: {
        ...sheets,
        "04": {
          ...sheets["04"],
          data: {
            ...d04,
            raciRows: migrateRows(d04.raciRows || []),
            customRows: migrateRows(d04.customRows || []),
          },
        },
        "06": {
          ...sheets["06"],
          data: {
            ...d06,
            changes: migrateChanges(d06.changes || []),
          },
        },
        "10": {
          ...sheets["10"],
          data: {
            ...d10,
            actLinks: migrateActLinks(d10.actLinks || {}),
          },
        },
      },
    },
  };
}

function buildLaunchedState(state, loginCode) {
  const lastActiveTab = state.project?.lastActiveTab || "dashboard";
  const alreadyActive = state.project?.status === "active";
  if (alreadyActive && state.baseline && state.currentPlan) {
    return { ...state, activeLayer:"L3", project: { ...state.project, lastActiveTab } };
  }

  const snapshot = state.baseline?.snapshot || buildSnapshot(state.l2.sheets);
  const today = new Date().toISOString().slice(0,10);
  return {
    ...state,
    activeLayer:"L3",
    project: { ...state.project, status:"active", lastActiveTab },
    baseline: state.baseline || {
      version: 1,
      confirmedDate: today,
      confirmedBy: loginCode,
      snapshot,
    },
    currentPlan: state.currentPlan || {
      version: 1,
      lastUpdated: today,
      lastCCR: null,
      snapshot,
    },
  };
}

export default function App() {
  const [screen,     setScreen]     = useState("landing");
  const [state,      setState]      = useState(createInitialState);
  const [member,     setMember]     = useState(null);
  const [restoring,  setRestoring]  = useState(true);
  const [lastLogin,  setLastLogin]  = useState(null); // { projectCode, memberCode, memberName, lastUsed }
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "error"
  const [saveError,  setSaveError]  = useState("");
  const { saveState, authenticate } = useProjectPersistence();
  const saveTimer      = useRef(null);
  const saveStatusTimer = useRef(null);

  // ── Restore session + read last login ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_LOGIN_KEY);
      if (raw) setLastLogin(JSON.parse(raw));
    } catch(e) { /* ignore */ }
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { savedState, savedMember, savedScreen } = JSON.parse(raw);
        if (savedState && savedScreen === "app") {
          setState(savedState);
          setMember(savedMember || null);
          setScreen("app");
        }
      }
    } catch(e) { /* ignore */ }
    setRestoring(false);
  }, []);

  // ── Persist session to sessionStorage ────────────────────────────────────
  useEffect(() => {
    if (screen !== "app") return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ savedState:state, savedMember:member, savedScreen:screen }));
    } catch(e) { /* ignore */ }
  }, [state, member, screen]);

  // ── Auto-save to Redis (debounced 2s) with status feedback ────────────────
  useEffect(() => {
    const code = state.project?.code;
    if (!code || screen !== "app") return;
    if (isReadOnlyMember(member)) return;
    const memberCode = getSaveMemberCode(state, member);
    if (!memberCode) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveState(code, state, memberCode);
        setSaveStatus("saved");
        setSaveError("");
      } catch(e) {
        console.warn("Project autosave failed:", e?.message || e);
        setSaveError(e?.message || "Save failed");
        setSaveStatus("error");
      }
      // Clear badge after 3 seconds
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus(null), 3000);
    }, 2000);
  }, [state, member, screen, saveState]);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleCreateNew = useCallback(() => {
    setState(createInitialState());
    setMember(null);
    setScreen("app");
  }, []);

  const handleLogin = useCallback(async (projectCode, memberCode) => {
    const result = await authenticate(projectCode, memberCode);
    setState({ ...result.state, activeLayer:"L3" });
    setMember(result.member);
    setScreen("app");
    try {
      const entry = {
        projectCode,
        memberCode,
        memberName: result.member?.name || "",
        lastUsed:   new Date().toISOString(),
      };
      localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(entry));
      setLastLogin(entry);
    } catch(e) { /* ignore */ }
  }, [authenticate]);

  // ── Sheet handlers (passed into ProjectSetup) ──────────────────────────────
  const handleSheetUpdate = useCallback((sheetId, data, status, tierOverride, options) => {

    // ── Special keys ─────────────────────────────────────────────────────────

    if (sheetId === "__tier__") {
      setState(prev => ({ ...prev, projectTier: tierOverride ?? null }));
      return;
    }

    if (sheetId === "__projectMeta__") {
      const { projectName, projectCode } = tierOverride;
      setState(prev => ({
        ...prev,
        project: { ...prev.project, name: projectName, code: projectCode },
      }));
      try {
        const existing = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) || "{}");
        localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({
          ...existing, projectCode, lastUsed: new Date().toISOString(),
        }));
      } catch(e) { /* ignore */ }
      return;
    }

    if (sheetId === "__loginCode__") {
      const entry = tierOverride;
      setState(prev => {
        const existing = prev.l2.loginCodes || [];
        if (existing.some(m => m.loginCode === entry.loginCode)) return prev;
        return { ...prev, l2: { ...prev.l2, loginCodes: [...existing, entry] } };
      });
      try {
        if (entry.isPM) {
          const existing = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) || "{}");
          localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({
            ...existing, memberCode: entry.loginCode, memberName: entry.name,
            lastUsed: new Date().toISOString(),
          }));
        }
      } catch(e) { /* ignore */ }
      return;
    }

    if (sheetId === "__removeLoginCode__") {
      const codeToRemove = tierOverride;
      setState(prev => ({
        ...prev,
        l2: { ...prev.l2, loginCodes: (prev.l2.loginCodes||[]).filter(m => m.loginCode !== codeToRemove) },
      }));
      return;
    }

    if (sheetId === "__updateLoginCodeName__") {
      const { loginCode, name } = tierOverride;
      setState(prev => ({
        ...prev,
        l2: {
          ...prev.l2,
          loginCodes: (prev.l2.loginCodes||[]).map(m =>
            m.loginCode === loginCode ? { ...m, name } : m
          ),
        },
      }));
      return;
    }

    // Special key "__intermediateDoc__" — persists the Stage 1 synthesised
    // project document so it survives remounts and is saved to Redis.
    if (sheetId === "__intermediateDoc__") {
      setState(prev => ({
        ...prev,
        l2: { ...prev.l2, intermediateDoc: tierOverride || "" },
      }));
      return;
    }

    // ── Normal sheet update ───────────────────────────────────────────────────
    setState(prev => {
      const prevSheet = prev.l2.sheets[sheetId] || { data:{}, locked:false, status:"empty" };
      const incomingData = data || {};
      const { __idMap, __removedIds, ...cleanData } = incomingData;
      // Normally we merge changes in, but Discard needs a full reset back to the saved copy.
      const nextData  = options?.replace === true ? cleanData : { ...prevSheet.data, ...cleanData };
      let nextCodes   = prev.l2.loginCodes || [];

      // ── Team sync (H1 fix) ────────────────────────────────────────────────
      // When Sheet02 writes teamMembers, upsert named+coded members into loginCodes
      // AND remove loginCode entries for members no longer in the teamMembers list.
      if (sheetId === "02" && Array.isArray(cleanData.teamMembers)) {
        const teamCodes = new Set(cleanData.teamMembers.map(m => m.loginCode).filter(Boolean));
        const isExternalCode = (code) => /^(SP|GU|OB)-\d{4}$/.test(code||"");
        if (teamCodes.size > 0) {
          nextCodes = nextCodes.filter(lc =>
            isExternalCode(lc.loginCode) || teamCodes.has(lc.loginCode)
          );
        }

        // Upsert members with both name and loginCode
        cleanData.teamMembers.forEach(member => {
          if (!member.loginCode || !member.name) return;
          const existingIdx = nextCodes.findIndex(lc => lc.loginCode === member.loginCode);
          const entry = {
            loginCode:    member.loginCode,
            name:         member.name,
            role:         member.role || "",
            deliveryRole: member.deliveryRole || "",
            isPM:         member.isPM || member.role === "Project Manager",
          };
          if (existingIdx === -1) {
            nextCodes = [...nextCodes, entry];
          } else {
            nextCodes = nextCodes.map((lc, i) => i === existingIdx ? { ...lc, ...entry } : lc);
          }
        });
      }

      const nextState = {
        ...prev,
        l2: {
          ...prev.l2,
          loginCodes: nextCodes,
          sheets: {
            ...prev.l2.sheets,
            [sheetId]: {
              ...prevSheet,
              data:   nextData,
              status: status || prevSheet.status || "in-progress",
            },
          },
        },
      };
      return sheetId === "03"
        ? migrateActivityReferences(nextState, __idMap, __removedIds)
        : nextState;
    });
  }, []);

  const handleSheetApprove = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        [sheetId]: { ...prev.l2.sheets[sheetId], locked:true, status:"approved" }
      }},
    }));
  }, []);

  const handleSheetUnlock = useCallback((sheetId) => {
    setState(prev => ({
      ...prev,
      l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
        [sheetId]: { ...prev.l2.sheets[sheetId], locked:false, status:"in-progress" }
      }},
    }));
  }, []);

  const handleSheetNav = useCallback((sheetId) => {
    setState(prev => ({ ...prev, l2: { ...prev.l2, currentSheet: sheetId } }));
  }, []);

  // ── L3 handlers ────────────────────────────────────────────────────────────
  const handleMarkComplete = useCallback((taskId, itemType, complete=true) => {
    setState(prev => {
      const sheetData = prev.l2.sheets["03"]?.data || {};
      const tryUpdate = (key) => {
        const items = sheetData[key] || [];
        const idx   = items.findIndex(a => a._id === taskId || a.taskId === taskId);
        if (idx === -1) return null;
        return items.map((a,i) => i===idx ? {...a, _complete:complete, _state: complete ? "complete" : "pending"} : a);
      };
      const updatedActivities = tryUpdate("activities");
      const updatedMilestones = tryUpdate("milestones");
      const newData = {
        ...sheetData,
        ...(updatedActivities ? { activities: updatedActivities } : {}),
        ...(updatedMilestones ? { milestones: updatedMilestones } : {}),
      };
      const prevEvidence = prev.sustainData?.evidence || [];
      const newEvidence  = complete ? prevEvidence : prevEvidence.filter(e => e.activityId !== taskId);
      return {
        ...prev,
        sustainData: { ...(prev.sustainData||{}), evidence: newEvidence },
        l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
          "03": { ...prev.l2.sheets["03"], data: newData }
        }},
      };
    });
  }, []);

  const handleGoToL2 = useCallback(() => {
    setState(prev => ({ ...prev, activeLayer:"setup" }));
  }, []);

  const handleGoToL3 = useCallback((tab) => {
    setState(prev => ({
      ...prev,
      activeLayer:"L3",
      project: { ...prev.project, lastActiveTab: tab || prev.project?.lastActiveTab || "dashboard" },
    }));
  }, []);

  const handleTabChange = useCallback((tab) => {
    setState(prev => ({
      ...prev,
      project: { ...prev.project, lastActiveTab: tab || prev.project?.lastActiveTab || "dashboard" },
    }));
  }, []);

  const handleConfirmBaseline = useCallback((loginCode) => {
    setState(prev => {
      if (prev.baseline && prev.currentPlan) {
        return { ...prev, project: { ...prev.project, status:"active" } };
      }
      const sheets   = prev.l2.sheets;
      const snapshot = buildSnapshot(sheets);
      const today    = new Date().toISOString().slice(0,10);
      return {
        ...prev,
        project: { ...prev.project, status:"active" },
        baseline:    { version:1, confirmedDate:today, confirmedBy:loginCode, snapshot },
        currentPlan: { version:1, lastUpdated:today, lastCCR:null, snapshot },
      };
    });
  }, []);

  const handleApplyCCRToPlan = useCallback((ccrId) => {
    setState(prev => {
      if (!prev.currentPlan) return prev;
      const snapshot = buildSnapshot(prev.l2.sheets);
      const today    = new Date().toISOString().slice(0,10);
      return {
        ...prev,
        currentPlan: { version:(prev.currentPlan.version||1)+1, lastUpdated:today, lastCCR:ccrId, snapshot },
      };
    });
  }, []);

  const handleLaunch = useCallback(async () => {
    const code = state.project?.code;
    const memberCode = getProjectManagerCode(state, member);
    if (!code) {
      setSaveError("Project code is required before launch");
      setSaveStatus("error");
      return;
    }
    if (!memberCode) {
      setSaveError("Project Manager code is required before launch");
      setSaveStatus("error");
      return;
    }
    const nextState = buildLaunchedState(state, memberCode);
    setState(nextState);
    try {
      await saveState(code, nextState, memberCode);
      setSaveStatus("saved");
      setSaveError("");
    } catch(e) {
      console.warn("Project launch save failed:", e?.message || e);
      setSaveError(e?.message || "Launch save failed");
      setSaveStatus("error");
    }
  }, [state, member, saveState]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    setState(createInitialState());
    setMember(null);
    setScreen("landing");
  }, []);

  // ── Restoring splash ───────────────────────────────────────────────────────
  if (restoring) {
    return (
      <div style={{ background:C.bg, color:C.sage, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:13, color:C.muted }}>Loading…</div>
      </div>
    );
  }

  if (screen === "landing") {
    return <LandingScreen onCreateNew={handleCreateNew} onLogin={handleLogin} lastLogin={lastLogin}/>;
  }

  const approvedCount = Object.values(state.l2.sheets).filter(s => s.locked).length;
  const l3Unlocked    = hasProjectManagerCode(state);
  const projectActive = state.project?.status === "active";

  return (
    <div style={{ background:C.bg, color:C.sage, height:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, overflow:"hidden" }}>

      {/* ── L3 — full screen ── */}
      {state.activeLayer === "L3" && (
        <OperatingLayer
          state={state}
          member={member || { isPM:true, role:"Project Manager", loginCode:"PM", name:"Project Manager" }}
          onGoToL2={handleGoToL2}
          onMarkComplete={handleMarkComplete}
          onStateChange={setState}
          onLogout={handleLogout}
          baseline={state.baseline}
          currentPlan={state.currentPlan}
          onConfirmBaseline={handleConfirmBaseline}
          onApplyCCRToPlan={handleApplyCCRToPlan}
          initialTab={state.project?.lastActiveTab || "dashboard"}
          onTabChange={handleTabChange}
          saveStatus={saveStatus}
          saveError={saveError}/>
      )}

      {/* ── Project Setup ── */}
      {state.activeLayer !== "L3" && (
        <>
          <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px",
            display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
            <img src="/norcon-logo.png" alt="NorCon Projects"
              style={{ width:112, height:36, objectFit:"contain", background:"#fff", borderRadius:6,
                padding:"2px 6px", flexShrink:0, boxSizing:"border-box" }}/>
            {state.project?.name && (
              <>
                <div style={{ color:C.border, fontSize:16 }}>·</div>
                <div style={{ fontSize:12, color:C.dim }}>
                  <span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{state.project.code}</span>
                  {state.project.name}
                </div>
              </>
            )}
            <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
              {/* Save status badge */}
              {saveStatus === "saved" && (
                <span style={{ fontSize:10, color:"#3ae0a2" }}>✓ Saved</span>
              )}
              {saveStatus === "error" && (
                <span style={{ fontSize:10, color:C.risk }}>⚠ Save failed — {saveError || "check connection"}</span>
              )}
              {l3Unlocked && projectActive && (
                <button onClick={() => handleGoToL3()}
                  style={{ padding:"5px 12px", fontSize:11, fontWeight:700, borderRadius:5,
                    border:"none", background:C.accent, color:"#fff", cursor:"pointer" }}>
                  Open Active Project
                </button>
              )}
              {state.projectTier && (
                <div style={{ fontSize:10, color:C.muted, padding:"3px 9px", borderRadius:5,
                  border:`1px solid ${C.border}` }}>
                  {state.projectTier === "light" ? "🌱 Light" : "🏗️ Full"}
                </div>
              )}
            </div>
          </div>

          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <ProjectSetup
              state={state}
              onSheetUpdate={handleSheetUpdate}
              onSheetApprove={handleSheetApprove}
              onSheetUnlock={handleSheetUnlock}
              onSheetNav={handleSheetNav}
              onLaunch={handleLaunch}
              onLogout={handleLogout}/>
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}
