import { useState, useCallback, useRef } from "react";
import L3Home               from "./l3/L3Home.jsx";
import L3Dashboard          from "./l3/L3Dashboard.jsx";
import L3IntegratedBaseline from "./l3/L3IntegratedBaseline.jsx";
import L3RACI               from "./l3/L3RACI.jsx";
import L3Report             from "./l3/L3Report.jsx";
import CCRPopup             from "./l3/CCRPopup.jsx";
import L3Sustainability      from "./l3/L3Sustainability.jsx";
import L3Benefits            from "./l3/L3Benefits.jsx";
import L3Risks              from "./l3/L3Risks.jsx";
import L3Stakeholders       from "./l3/L3Stakeholders.jsx";
import { isBaselineReady, deriveCurrentPhase } from "../store/baselineUtils.js";
import SustainabilityPrompt  from "./l3/SustainabilityPrompt.jsx";
import {
  isBaselineField, describeChange, generateCCRId, generateMinorId,
  getApproverForChange, getReviewerForChange,
} from "../store/changeControl.js";

const C = {
  bg:"#0D2B1B", surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", sageDim:"#b8d4c0", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const ALL_TABS = [
  { id:"home",         label:"Home",               icon:"🏠" },
  { id:"dashboard",    label:"Dashboard",           icon:"📊" },
  { id:"baseline",     label:"Integrated Baseline", icon:"📅" },
  { id:"raci",         label:"RACI",                icon:"📋" },
  { id:"benefits",     label:"Benefits & Value",    icon:"🎯" },
  { id:"risks",        label:"Risks & Issues",      icon:"⚠️" },
  { id:"stakeholders", label:"Stakeholders",        icon:"👥" },
  { id:"sustain",      label:"Sustainability",      icon:"🌿" },
  { id:"report",       label:"Report",              icon:"📄" },
];

const TIER_TABS = {
  light: ["home","dashboard","baseline","raci","risks","sustain","report"],
  full:  ["home","dashboard","baseline","raci","benefits","risks","stakeholders","sustain","report"],
};

// ── Leave-page save popup ────────────────────────────────────────────
function LeavePopup({ onLogCCR, onMinor, onDiscard, onCancel, tabLabel }) {
  return (
    <div onClick={onCancel} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:24, maxWidth:420, width:"90%", boxShadow:"0 8px 32px #0008" }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.sage, marginBottom:6 }}>Unsaved changes</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
          You've made changes on <strong style={{ color:C.dim }}>{tabLabel}</strong> that haven't been logged. What would you like to do?
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={onLogCCR} style={{ padding:"10px 14px", background:C.accent, border:"none", borderRadius:6, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", textAlign:"left" }}>
            📋 Log as Change Request (CCR) — major change requiring review & approval
          </button>
          <button onClick={onMinor} style={{ padding:"10px 14px", background:C.surface2, border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, fontSize:12, cursor:"pointer", textAlign:"left" }}>
            💾 Save as minor change — record without formal approval
          </button>
          <button onClick={onDiscard} style={{ padding:"10px 14px", background:"none", border:`1px solid ${C.risk}22`, borderRadius:6, color:C.muted, fontSize:12, cursor:"pointer", textAlign:"left" }}>
            🗑 Discard changes
          </button>
          <button onClick={onCancel} style={{ padding:"8px 14px", background:"none", border:"none", borderRadius:6, color:C.muted, fontSize:11, cursor:"pointer" }}>
            ← Stay on this page
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperatingLayer({ state, member, onGoToL2, onMarkComplete, onStateChange, onLogout, baseline, currentPlan, onConfirmBaseline, onApplyCCRToPlan, initialTab, onTabChange }) {
  const [activeTab,    setActiveTab]    = useState(initialTab || "home");
  const [ccrPending,   setCcrPending]   = useState(null);
  const [notification,  setNotification]  = useState(null);
  const [sustainPrompt, setSustainPrompt] = useState(null);
  // Leave-page detection
  const [leavePopup,   setLeavePopup]   = useState(null); // { toTab, dirtyDesc }
  const dirtyRef = useRef(false); // tracks whether current tab has unsaved non-click changes
  const dirtyDescRef = useRef([]); // accumulated list of human-readable change descriptions

  const { l2, project } = state;
  const sheets     = l2?.sheets || {};
  const isPM       = member?.isPM;
  const isSponsor  = member?.isSponsor  || false;
  const canApprove = member?.canApprove || isPM;

  // Derive active tabs from project tier — default to full if no tier set
  const tier     = state.projectTier || "full";
  const tabIds   = TIER_TABS[tier] || TIER_TABS.full;
  const TABS     = ALL_TABS.filter(t => tabIds.includes(t.id));
  const loginCode  = member?.loginCode;

  const activities   = sheets["03"]?.data?.activities   || [];
  const milestones   = sheets["03"]?.data?.milestones   || [];
  const risks        = sheets["05"]?.data?.risks        || [];
  const issues       = sheets["05"]?.data?.issues       || [];
  const deliverables = sheets["07"]?.data?.deliverables || [];
  const stakeholders = sheets["08"]?.data?.stakeholders || [];
  const teamMembers  = l2?.loginCodes                   || [];
  const raciData     = sheets["04"]?.data               || {};
  const charter      = sheets["01"]?.data?.charter      || state.l1?.charter || {};
  const baselineReady   = isBaselineReady(sheets);
  const baselineActive  = !!baseline;
  const currentPhase    = deriveCurrentPhase(activities, milestones);
  const approvers    = sheets["06"]?.data?.approvers    || [];
  const sustainConfig = sheets["10"]?.data              || {};
  const sustainData   = state.sustainData               || { evidence: [] };
  const changes      = sheets["06"]?.data?.changes      || [];

  const autoRaci = (() => {
    if ((raciData.raciRows||[]).length > 0) return raciData;
    const members = teamMembers.filter(m=>m.name&&m.role);
    const rows = [
      ...(activities||[]).map(a=>({ taskId:a._id, label:a.name||a._id, phase:a.phase, type:"activity", suggestedResponsible:a.responsible })),
      ...(milestones||[]).map(m=>({ taskId:m._id, label:m.name||m._id, phase:m.phase, type:"milestone", suggestedResponsible:"Project Manager" })),
    ].map(task => {
      const assignments = {};
      members.forEach(m => {
        if (m.role==="Project Manager") assignments[m.loginCode] = task.type==="milestone"?"A":"C";
        else if (task.suggestedResponsible && (m.role===task.suggestedResponsible||m.deliveryRole===task.suggestedResponsible)) assignments[m.loginCode]="R";
        else assignments[m.loginCode]="I";
      });
      return { ...task, assignments };
    });
    return { raciRows: rows, customRows: [] };
  })();

  const pendingForMe = changes.filter(c => {
    if (c.type !== "major") return false;
    if (c.status === "pending"  && c.reviewerCode === loginCode) return true;
    if (c.status === "reviewed" && c.approverCode === loginCode) return true;
    return false;
  }).length;

  const saveChanges = useCallback((newChanges) => {
    onStateChange(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "06": {
            ...prev.l2.sheets["06"],
            data: { ...(prev.l2.sheets["06"]?.data||{}), changes: newChanges },
          },
        },
      },
    }));
  }, [onStateChange]);

  const handleBaselineBlur = useCallback((elementType, elementId, fieldName, oldValue, newValue, elementName) => {
    if (String(oldValue) === String(newValue)) return;
    if (!isBaselineField(elementType, fieldName)) {
      const newChanges = [...changes, {
        id: generateMinorId(changes),
        type: "minor",
        date: new Date().toLocaleDateString("en-GB"),
        requestedBy: member?.name || loginCode,
        description: describeChange(elementType, fieldName, oldValue, newValue),
        elementId, fieldName, oldValue, newValue,
      }];
      saveChanges(newChanges);
      return;
    }
    setCcrPending({
      elementType, elementId, fieldName, oldValue, newValue,
      elementName,
      description: describeChange(elementType, fieldName, oldValue, newValue),
      date: new Date().toLocaleDateString("en-GB"),
      requestedBy: member?.name || loginCode,
    });
  }, [changes, member, loginCode, saveChanges]);

  const handleCCRSubmit = useCallback(({ justification, priority, impacts, benefitImpacts }) => {
    if (!ccrPending) return;
    const reviewer = getReviewerForChange(approvers);
    const approver = getApproverForChange(impacts, approvers);
    const newCCR = {
      ...ccrPending,
      id: generateCCRId(changes),
      type: "major",
      justification,
      priority,
      impacts,
      benefitImpacts: benefitImpacts || [],
      status: "pending",
      reviewerCode: reviewer?.loginCode || "",
      reviewerName: reviewer?.name      || reviewer?.role || "",
      approverCode: approver?.loginCode || "",
      approverName: approver?.name      || approver?.role || "",
      proposedValue: ccrPending.newValue,
    };
    saveChanges([...changes, newCCR]);
    dirtyRollbackRef.current = []; // change submitted — rollbacks consumed
    setCcrPending(null);
    setActiveTab("report");
    onTabChange?.("report");
  }, [ccrPending, changes, approvers, saveChanges, onTabChange]);

  const handleCCRMinor = useCallback(() => {
    if (!ccrPending) return;
    const newChanges = [...changes, {
      id: generateMinorId(changes),
      type: "minor",
      date: ccrPending.date,
      requestedBy: ccrPending.requestedBy,
      description: ccrPending.description,
      elementId: ccrPending.elementId,
      fieldName: ccrPending.fieldName,
      oldValue: ccrPending.oldValue,
      newValue: ccrPending.newValue,
    }];
    saveChanges(newChanges);
    dirtyRollbackRef.current = []; // change kept as minor — rollbacks consumed
    setCcrPending(null);
  }, [ccrPending, changes, saveChanges]);

  const handleAddToExistingCCR = useCallback((targetCCRId, changeDetails) => {
    if (!ccrPending) return;
    const newChanges = changes.map(c => {
      if (c.id !== targetCCRId) return c;
      const linked = c.linkedChanges || [];
      return {
        ...c,
        linkedChanges: [...linked, {
          description: changeDetails.description || ccrPending.description,
          fieldName:   changeDetails.fieldName   || ccrPending.fieldName,
          oldValue:    changeDetails.oldValue     ?? ccrPending.oldValue,
          newValue:    changeDetails.newValue     ?? ccrPending.newValue,
          date:        ccrPending.date,
          requestedBy: ccrPending.requestedBy,
        }],
      };
    });
    saveChanges(newChanges);
    dirtyRollbackRef.current = []; // linked to existing CCR — rollbacks consumed
    setCcrPending(null);
  }, [ccrPending, changes, saveChanges]);

  const handleApproveAction = useCallback((ccrId, newStatus, rejectionReason) => {
    const newChanges = changes.map(c => {
      if (c.id !== ccrId) return c;
      const updated = { ...c, status: newStatus };
      if (rejectionReason) updated.rejectionReason = rejectionReason;
      return updated;
    });
    saveChanges(newChanges);
    if (newStatus === "approved") {
      setNotification(`✓ Change ${ccrId} approved — ${changes.find(c=>c.id===ccrId)?.description||""}`);
      setTimeout(() => setNotification(null), 8000);
    } else if (newStatus === "rejected") {
      setNotification(`✕ Change ${ccrId} rejected — ${rejectionReason||""}`);
      setTimeout(() => setNotification(null), 6000);
    }
  }, [changes, saveChanges]);

  const handleConfirmBaseline = useCallback(() => {
    onStateChange(prev => ({
      ...prev,
      riskBaseline: {
        snapshotDate: new Date().toLocaleDateString("en-GB"),
        risks:  prev.l2.sheets["05"]?.data?.risks  || [],
        issues: prev.l2.sheets["05"]?.data?.issues || [],
      },
    }));
    onConfirmBaseline?.(loginCode);
  }, [loginCode, onConfirmBaseline, onStateChange]);

  const handleSustainRecord = useCallback((records) => {
    const arr   = Array.isArray(records) ? records : [records];
    const dated = arr.map(r => ({ ...r, date: new Date().toLocaleDateString("en-GB") }));
    onStateChange(prev => ({
      ...prev,
      sustainData: {
        ...(prev.sustainData||{}),
        evidence: [...((prev.sustainData||{}).evidence||[]), ...dated],
      },
    }));
  }, [onStateChange]);

  // ── Tab navigation with leave-page check ────────────────────────────
  const TABS_WITH_FORMS = ["baseline", "home", "benefits"];
  const requestTabChange = (toTab) => {
    if (toTab === activeTab) return;
    if (dirtyRef.current && TABS_WITH_FORMS.includes(activeTab)) {
      setLeavePopup({ toTab, dirtyDesc: dirtyDescRef.current || "unsaved edits" });
    } else {
      commitTabChange(toTab);
    }
  };

  const commitTabChange = (toTab) => {
    dirtyRef.current = false;
    dirtyDescRef.current = [];
    setLeavePopup(null);
    if (onTabChange) onTabChange(toTab);
    setActiveTab(toTab);
    onTabChange?.(toTab);
  };

  const handleLeaveLogCCR = () => {
    const toTab        = leavePopup?.toTab;
    const tabLabel     = TABS.find(t=>t.id===activeTab)?.label || activeTab;
    const dirtyChanges = dirtyDescRef.current;
    const desc = dirtyChanges.length > 0
      ? dirtyChanges.join(" | ")
      : `Changes on ${tabLabel}`;
    setLeavePopup(null);
    setCcrPending({
      elementType: "general",
      elementId:   "batch",
      fieldName:   "multiple",
      oldValue:    "",
      newValue:    "",
      elementName: tabLabel,
      description: desc,
      changeList:  dirtyChanges,
      date:        new Date().toLocaleDateString("en-GB"),
      requestedBy: member?.name || loginCode,
    });
    dirtyRef.current = false;
    dirtyDescRef.current = [];
    dirtyRollbackRef.current = [];
    if (toTab) {
      setActiveTab(toTab);
      onTabChange?.(toTab);
    }
  };

  const handleLeaveMinor = () => {
    const toTab = leavePopup?.toTab;
    const desc  = dirtyDescRef.current.length > 0
      ? dirtyDescRef.current.join(" | ")
      : `Changes on ${TABS.find(t=>t.id===activeTab)?.label || activeTab}`;
    const newChanges = [...changes, {
      id: generateMinorId(changes),
      type: "minor",
      date: new Date().toLocaleDateString("en-GB"),
      requestedBy: member?.name || loginCode,
      description: desc,
    }];
    saveChanges(newChanges);
    dirtyRef.current = false;
    dirtyDescRef.current = [];
    dirtyRollbackRef.current = []; // changes kept + logged — rollbacks no longer valid
    setLeavePopup(null);
    if (toTab) {
      setActiveTab(toTab);
      onTabChange?.(toTab);
    }
  };

  const handleLeaveDiscard = () => {
    // Discard = revert the actual field changes, not just skip logging them
    dirtyRollbackRef.current.forEach(({ taskId, itemType, field, oldVal }) => {
      onStateChange(prev => {
        const key = itemType === "milestone" ? "milestones" : "activities";
        const d03 = prev.l2.sheets["03"]?.data || {};
        const next = (d03[key] || []).map(i =>
          i._id === taskId ? { ...i, [field]: oldVal, _autoDate: false } : i
        );
        return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
          "03": { ...prev.l2.sheets["03"], data: { ...d03, [key]: next } }
        }}};
      });
    });
    dirtyRollbackRef.current = [];
    dirtyRef.current = false;
    dirtyDescRef.current = [];
    const toTab = leavePopup?.toTab;
    setLeavePopup(null);
    if (toTab) {
      setActiveTab(toTab);
      onTabChange?.(toTab);
    }
  };

  const dirtyRollbackRef = useRef([]);
  const setDirty = useCallback((desc) => {
    if (!desc) return;
    if (desc.startsWith("__ROLLBACK__")) {
      try {
        const payload = JSON.parse(desc.slice("__ROLLBACK__".length));
        dirtyRollbackRef.current = [...dirtyRollbackRef.current, payload];
      } catch { /* ignore malformed rollback */ }
      return;
    }
    dirtyRef.current = true;
    if (!dirtyDescRef.current.includes(desc)) {
      dirtyDescRef.current = [...dirtyDescRef.current, desc];
    }
  }, []);

  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
    dirtyDescRef.current = [];
    dirtyRollbackRef.current = [];
  }, []);

  const sharedProps = {
    state, member, project, sheets, charter,
    activities, milestones, risks, issues, deliverables, stakeholders,
    teamMembers, raciData: autoRaci, isPM, loginCodes: teamMembers,
    onMarkComplete, onGoToL2, onStateChange,
    onBaselineBlur: handleBaselineBlur,
    sustainConfig, onSustainRecord: handleSustainRecord,
    baseline, currentPlan, baselineReady, baselineActive, currentPhase,
    isSponsor, canApprove,
    onConfirmBaseline: handleConfirmBaseline, onApplyCCRToPlan,
    sustainPrompt, setSustainPrompt,
    onSetDirty: setDirty, onClearDirty: clearDirty,
    onTriggerCCR: setCcrPending,
  };

  const TabComponent = {
    home:         L3Home,
    dashboard:    L3Dashboard,
    baseline:     L3IntegratedBaseline,
    raci:         L3RACI,
    report:       L3Report,
    risks:        L3Risks,
    benefits:     L3Benefits,
    stakeholders: L3Stakeholders,
  }[activeTab];

  const totalTasks = [...activities, ...milestones].length;
  const doneTasks  = [...activities, ...milestones].filter(a=>a._complete).length;
  const pct        = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*100) : 0;

  return (
    <div style={{ background:C.bg, color:C.sage, height:"100vh", display:"flex", flexDirection:"column",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize:13, overflow:"hidden" }}>

      {/* Top bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 20px",
        display:"flex", alignItems:"center", gap:12, height:48, flexShrink:0 }}>
        <div style={{ width:28, height:28, background:C.accent, borderRadius:6,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🏗️</div>
        <div style={{ fontSize:14, fontWeight:700, color:C.sage }}>NorCon Projects</div>
        {project?.name && (
          <>
            <div style={{ color:C.border, fontSize:16 }}>·</div>
            <div style={{ fontSize:12, color:C.dim }}>
              <span style={{ color:C.accentL, fontFamily:"monospace", marginRight:6 }}>{project.code}</span>
              {project.name}
            </div>
          </>
        )}
        {totalTasks > 0 && (
          <div style={{ background:"rgba(46,125,82,0.15)", border:`1px solid ${C.border}`, borderRadius:20,
            padding:"3px 10px", fontSize:11, color:C.accentL }}>
            {pct}% complete
          </div>
        )}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.accentL, background:"rgba(46,125,82,0.15)",
            padding:"3px 9px", borderRadius:5, border:`1px solid ${C.border}` }}>
            {member?.loginCode}
          </div>
          <div style={{ fontSize:11, color:C.muted }}>{member?.role}</div>
          {isPM && (
            <div style={{ display:"flex", gap:3, marginLeft:8 }}>
              {["L1","L2","L3"].map(l=>(
                <button key={l} onClick={()=>l==="L2"&&onGoToL2()}
                  style={{ padding:"3px 9px", fontSize:10, fontWeight:700, borderRadius:4,
                    border:`1px solid ${l==="L3"?C.accent:C.border}`,
                    background:l==="L3"?C.accent:"none",
                    color:l==="L3"?"#fff":C.muted,
                    cursor:l==="L2"?"pointer":"default" }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {onLogout && (
            <button onClick={onLogout}
              style={{ marginLeft:4, padding:"3px 10px", fontSize:10, fontWeight:600, borderRadius:4,
                border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer" }}>
              Log out
            </button>
          )}
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div style={{ padding:"8px 20px", background:"rgba(46,125,82,0.12)", borderBottom:`1px solid ${C.accent}`,
          fontSize:12, color:C.accentL, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          {notification}
          <button onClick={()=>setNotification(null)}
            style={{ marginLeft:"auto", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
        </div>
      )}

      {/* Nav tabs */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex",
        padding:"0 20px", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={()=>requestTabChange(tab.id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"0 12px", height:40,
              fontSize:11, fontWeight:600, background:"none", border:"none",
              borderBottom:`2px solid ${activeTab===tab.id?C.accentL:"transparent"}`,
              color:activeTab===tab.id?C.sage:C.muted,
              cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s", position:"relative" }}>
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id==="report" && pendingForMe>0 && (
              <span style={{ position:"absolute", top:6, right:4, width:14, height:14, borderRadius:"50%",
                background:C.risk, color:"#fff", fontSize:8, fontWeight:700,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                {pendingForMe}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content — fills all remaining height, no overflow */}
      <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {activeTab === "sustain" ? (
          <L3Sustainability state={state} sustainData={sustainData}/>
        ) : activeTab === "baseline" ? (
          <L3IntegratedBaseline
            state={state}
            activities={activities}
            milestones={milestones}
            raciData={autoRaci}
            project={project}
            loginCodes={teamMembers}
            member={member}
            onStateChange={onStateChange}
            onBaselineBlur={handleBaselineBlur}
            onSetDirty={setDirty}
            onClearDirty={clearDirty}
            baseline={baseline}
            onMarkComplete={onMarkComplete}
            sustainConfig={sustainConfig}
            setSustainPrompt={setSustainPrompt}
            onConfirmBaseline={handleConfirmBaseline}/>
        ) : TabComponent ? (
          <TabComponent {...sharedProps}/>
        ) : null}
      </div>

      {/* CCR Popup */}
      {ccrPending && (
        <CCRPopup
          change={ccrPending}
          approvers={approvers}
          existingCCRs={changes}
          benefits={charter?.benefits||[]}
          onSubmit={handleCCRSubmit}
          onAddToExisting={handleAddToExistingCCR}
          onMinor={handleCCRMinor}
          onCancel={() => {
            dirtyRollbackRef.current.forEach(({ taskId, itemType, field, oldVal }) => {
              onStateChange(prev => {
                const key = itemType === "milestone" ? "milestones" : "activities";
                const d03 = prev.l2.sheets["03"]?.data || {};
                const next = (d03[key] || []).map(i =>
                  i._id === taskId ? { ...i, [field]: oldVal, _autoDate: false } : i
                );
                return { ...prev, l2: { ...prev.l2, sheets: { ...prev.l2.sheets,
                  "03": { ...prev.l2.sheets["03"], data: { ...d03, [key]: next } }
                }}};
              });
            });
            dirtyRollbackRef.current = [];
            dirtyRef.current = false;
            dirtyDescRef.current = [];
            setCcrPending(null);
          }}/>
      )}

      {/* Leave-page popup */}
      {leavePopup && (
        <LeavePopup
          tabLabel={TABS.find(t=>t.id===activeTab)?.label || activeTab}
          onLogCCR={handleLeaveLogCCR}
          onMinor={handleLeaveMinor}
          onDiscard={handleLeaveDiscard}
          onCancel={()=>setLeavePopup(null)}/>
      )}

      {/* Sustainability micro-prompt */}
      {sustainPrompt && (
        <SustainabilityPrompt
          activity={sustainPrompt}
          sustainConfig={sustainConfig}
          onRecord={(ev) => {
            handleSustainRecord(ev);
            onMarkComplete(sustainPrompt._id, sustainPrompt.itemType, true);
            setSustainPrompt(null);
          }}
          onSkip={() => {
            onMarkComplete(sustainPrompt._id, sustainPrompt.itemType, true);
            setSustainPrompt(null);
          }}
          onClose={() => setSustainPrompt(null)}
        />
      )}
    </div>
  );
}
