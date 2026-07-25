import { useState, useCallback, useRef, useMemo } from "react";

const C = {
  surface:"#122E1E", surface2:"#183D28", border:"#1F4D34",
  accent:"#2E7D52", accentL:"#3a9962",
  sage:"#E5F0E8", dim:"#8aac96", muted:"#5a7a66",
  risk:"#e05c5c", milestone:"#e0a23a", activity:"#3ae0a2",
};

const PHASE_ORDER  = ["Concept","Definition","Development","Execution","Handover & Closeout"];
const PHASE_COLORS = {
  Concept:"#5d8aff", Definition:"#3ae0a2", Development:"#2E7D52",
  "Handover & Closeout":"#e0a23a", Execution:"#8aac96",
};
const ROW_H = 54;
const DAY_W = 20;

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d) {
  try { return d.toISOString().slice(0, 10); } catch { return ""; }
}
function dBetween(a, b) {
  const da = a instanceof Date ? a : parseDate(a);
  const db = b instanceof Date ? b : parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
}

function autoDate(items) {
  const sorted = [...items].sort((a, b) => {
    const oi = PHASE_ORDER.indexOf(a.phase);
    const oj = PHASE_ORDER.indexOf(b.phase);
    return (oi < 0 ? 99 : oi) - (oj < 0 ? 99 : oj);
  });
  let cur = addDays(new Date(), 1);
  return sorted.map(item => {
    // Preserve dates on ANY item that has them, unless it was explicitly
    // auto-dated before (_autoDate === true). Extracted/imported items have
    // _autoDate undefined — their real dates must never be overwritten.
    const hasRealDate = item._autoDate !== true && !!(parseDate(item.startDate) || parseDate(item.targetDate));
    if (hasRealDate) {
      const end = parseDate(item.targetDate || item.startDate);
      if (end) {
        const after = addDays(end, 2);
        if (after > cur) cur = after;
      }
      return item;
    }
    const s   = new Date(cur);
    const dur = item.itemType === "milestone" ? 0 : 13;
    const e   = addDays(s, dur);
    cur = addDays(e, 2);
    return { ...item, startDate: toISO(s), targetDate: toISO(e), _autoDate: true };
  });
}

function GanttSVG({ items, gStart, gEnd, phases, baselineItems }) {
  // Clamp to 5 years max — protects against any bad date exploding the SVG width
  const totalDays = Math.min(Math.max(dBetween(gStart, gEnd), 60), 1825);
  const W         = totalDays * DAY_W;
  const HEADER_H  = 44;
  const PHASE_H   = 24;

  const todayX = Math.max(0, dBetween(gStart, new Date())) * DAY_W;

  const months = useMemo(() => {
    const arr = [];
    let mc = new Date(gStart.getFullYear(), gStart.getMonth(), 1);
    let safety = 0;
    while (mc < gEnd && safety++ < 120) {
      arr.push(new Date(mc));
      mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
    }
    return arr;
  }, [gStart, gEnd]);

  const weeks = useMemo(() => {
    const arr = [];
    let wc = new Date(gStart);
    let safety = 0;
    while (wc < gEnd && safety++ < 600) {
      arr.push(new Date(wc));
      wc = addDays(wc, 7);
    }
    return arr;
  }, [gStart, gEnd]);

  const rows = useMemo(() => {
    const r = [];
    let y = HEADER_H;
    phases.forEach(phase => {
      const ph = items.filter(i => (i.phase || "Unassigned") === phase);
      if (!ph.length) return;
      r.push({ type: "phase", phase, y });
      y += PHASE_H;
      ph.forEach((item, idx) => {
        r.push({ type: "item", item, idx, y });
        y += ROW_H;
      });
    });
    return { rows: r, totalH: y };
  }, [items, phases]);

  const { rows: rowList, totalH } = rows;

  const xOf = useCallback(d => {
    const parsed = parseDate(d);
    if (!parsed) return 0;
    return Math.max(0, dBetween(gStart, parsed)) * DAY_W;
  }, [gStart]);

  return (
    <svg width={W} height={totalH} style={{ display:"block", overflow:"visible" }} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height={totalH} fill={C.surface} />

      <rect x={0} y={0} width={W} height={22} fill={C.surface2} />
      {months.map((m, i) => {
        const x = xOf(toISO(m));
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x} y2={22} stroke={C.border} strokeWidth={1} />
            <text x={x+4} y={15} fill={C.muted} fontSize={9} fontFamily="system-ui">
              {m.toLocaleDateString("en-GB",{month:"short",year:"numeric"})}
            </text>
          </g>
        );
      })}

      <rect x={0} y={22} width={W} height={22} fill={C.surface2} />
      <line x1={0} y1={44} x2={W} y2={44} stroke={C.border} strokeWidth={2} />
      {weeks.map((w, i) => {
        const x = xOf(toISO(w));
        return (
          <g key={i}>
            <line x1={x} y1={22} x2={x} y2={44} stroke={C.border} strokeWidth={1} strokeOpacity={0.4} />
            <text x={x+2} y={36} fill={C.muted} fontSize={8} fontFamily="system-ui" opacity={0.7}>
              {w.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}
            </text>
          </g>
        );
      })}

      <line x1={todayX} y1={0} x2={todayX} y2={totalH} stroke={C.accentL} strokeWidth={2} opacity={0.5} />

      {rowList.map((row, ri) => {
        if (row.type === "phase") {
          return (
            <g key={`ph-${ri}`}>
              <rect x={0} y={row.y} width={W} height={PHASE_H} fill={C.surface} />
              <line x1={0} y1={row.y+PHASE_H} x2={W} y2={row.y+PHASE_H} stroke={C.border} strokeWidth={1} opacity={0.4} />
            </g>
          );
        }
        const bg = row.idx % 2 === 0 ? C.surface : C.surface2;
        return (
          <g key={`bg-${ri}`}>
            <rect x={0} y={row.y} width={W} height={ROW_H} fill={bg} />
            <line x1={0} y1={row.y+ROW_H} x2={W} y2={row.y+ROW_H} stroke={C.border} strokeWidth={1} opacity={0.2} />
          </g>
        );
      })}

      <g opacity={0.12}>
        {weeks.map((_, wi) => (
          <line key={`wg-${wi}`} x1={wi*7*DAY_W} y1={HEADER_H} x2={wi*7*DAY_W} y2={totalH} stroke={C.border} strokeWidth={1} />
        ))}
      </g>

      {baselineItems && baselineItems.map((bItem) => {
        const liveItem = items.find(i => i._id === bItem._id);
        if (!liveItem) return null;
        if (bItem.startDate === liveItem.startDate && bItem.targetDate === liveItem.targetDate) return null;
        const isMile = bItem.itemType === "milestone";
        const by = (rowList.find(r => r.type==="item" && r.item._id===bItem._id)?.y || 0) + ROW_H / 2;
        if (!by) return null;
        const gx1 = xOf(bItem.startDate || bItem.targetDate);
        const gx2 = Math.max(gx1 + DAY_W, xOf(bItem.targetDate || bItem.startDate) + DAY_W);
        if (isMile) {
          const mx = gx1 + 6;
          return <polygon key={`ghost-${bItem._id}`} points={`${mx},${by-8} ${mx+8},${by} ${mx},${by+8} ${mx-8},${by}`} fill="none" stroke="#e0a23a" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.5}/>;
        }
        return <rect key={`ghost-${bItem._id}`} x={gx1} y={by-9} width={gx2-gx1} height={18} rx={3} fill="none" stroke="#e0a23a" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.45}/>;
      })}

      {rowList.map((row, ri) => {
        if (row.type !== "item") return null;
        const { item, y: ry } = row;
        const isMile = item.itemType === "milestone";
        const color  = item.color || C.accentL;
        const by     = ry + ROW_H / 2;
        const sd = parseDate(item.startDate);
        const td = parseDate(item.targetDate || item.startDate);
        if (!sd && !td) return null;
        const x1 = xOf(item.startDate || item.targetDate);
        const x2 = Math.max(x1 + DAY_W, xOf(item.targetDate || item.startDate) + DAY_W);
        const bw = x2 - x1;
        if (isMile) {
          const mx = x1 + 6;
          return (
            <polygon key={`bar-${ri}`}
              points={`${mx},${by-8} ${mx+8},${by} ${mx},${by+8} ${mx-8},${by}`}
              fill={color} opacity={0.9}
            />
          );
        }
        return (
          <g key={`bar-${ri}`}>
            <rect x={x1} y={by-9} width={bw} height={18} rx={3} fill={color} opacity={0.85} />
            {item._complete && (
              <rect x={x1} y={by-9} width={bw} height={18} rx={3} fill="none" stroke={C.activity} strokeWidth={2} />
            )}
            <clipPath id={`clip-${item._id}`}>
              <rect x={x1+4} y={by-9} width={Math.max(0,bw-8)} height={18} />
            </clipPath>
            <text x={x1+5} y={by+3} fill="#fff" fontSize={9} fontFamily="system-ui"
              clipPath={`url(#clip-${item._id})`} style={{pointerEvents:"none"}}>
              {item.name || item.description}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function L3IntegratedBaseline({ state, activities, milestones, member, onStateChange, onBaselineBlur, onSetDirty, baseline, onMarkComplete, sustainConfig, setSustainPrompt }) {
  const canEdit   = member?.isPM || member?.canApprove;
  const loginCode = member?.loginCode;

  const preFocusValue = useRef({});
  const [taskFilter, setTaskFilter] = useState("all");

  const raciRows   = [...(state?.l2?.sheets?.["04"]?.data?.raciRows || []), ...(state?.l2?.sheets?.["04"]?.data?.customRows || [])];
  const getAssignment = (taskId) => raciRows.find(r => r.taskId === taskId)?.assignments?.[loginCode] || null;
  const canComplete   = (taskId) => getAssignment(taskId) === "R" || canEdit;
  const isMine        = (taskId) => !!getAssignment(taskId);

  const handleComplete = (item, complete) => {
    if (complete && sustainConfig && Object.values(sustainConfig.enabled || {}).some(Boolean)) {
      setSustainPrompt?.({ ...item, itemType: item.itemType || "activity" });
    } else {
      onMarkComplete?.(item._id, item.itemType || "activity", complete);
    }
  };

  const sheets = state?.l2?.sheets || {};

  const costData = useMemo(() => {
    const saved = sheets["03"]?.data?.costData || {};
    const init  = {};
    [...activities, ...milestones].forEach(a => {
      init[a._id] = saved[a._id] || { plannedAmount:"", actualAmount:"" };
    });
    Object.keys(saved).forEach(id => { if (!init[id]) init[id] = saved[id]; });
    return init;
  }, [sheets, activities, milestones]);

  const expLog = useMemo(() => sheets["03"]?.data?.expenditureLog || [], [sheets]);
  const [newExp, setNewExp] = useState({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });

  const saveSheet03 = useCallback((patch) => {
    onStateChange(prev => ({
      ...prev,
      l2: {
        ...prev.l2,
        sheets: {
          ...prev.l2.sheets,
          "03": {
            ...prev.l2.sheets["03"],
            data: { ...prev.l2.sheets["03"]?.data, ...patch },
          },
        },
      },
    }));
  }, [onStateChange]);

  const updateItemDate = useCallback((taskId, itemType, field, newVal) => {
    if (!newVal) return;
    // Native date inputs fire onChange with partial years while typing —
    // only accept plausible years to prevent SVG width explosion.
    const yr = parseInt(newVal.slice(0, 4));
    if (isNaN(yr) || yr < 2000 || yr > 2100) return;
    const key = itemType === "milestone" ? "milestones" : "activities";
    // Read from prev inside onStateChange (not the outer closure) to prevent
    // stale-closure reads wiping sibling fields on the same item (Bug 2).
    // Also mark ALL items _autoDate:false so autoDate() never cascades
    // downstream dates when one item is manually edited (Bug 1).
    onStateChange(prev => {
      const list = prev.l2.sheets["03"]?.data?.[key] || [];
      const next = list.map(i => {
        if (i._id === taskId) return { ...i, [field]: newVal, _autoDate: false };
        // Lock every other item that has real dates so autoDate() won't
        // shift them when it recalculates after this state update.
        if (i.startDate || i.targetDate) return { ...i, _autoDate: false };
        return i;
      });
      return {
        ...prev,
        l2: {
          ...prev.l2,
          sheets: {
            ...prev.l2.sheets,
            "03": {
              ...prev.l2.sheets["03"],
              data: { ...prev.l2.sheets["03"]?.data, [key]: next },
            },
          },
        },
      };
    });
  }, [onStateChange]);

  const handleDateFocus = useCallback((taskId, field, currentVal) => {
    preFocusValue.current[`${taskId}_${field}`] = currentVal;
  }, []);

  const handleDateBlur = useCallback((taskId, itemType, field, newVal) => {
    if (!newVal) return;
    const key    = `${taskId}_${field}`;
    const oldVal = preFocusValue.current[key] ?? (
      (itemType === "milestone" ? milestones : activities).find(i => i._id === taskId)?.[field] || ""
    );
    delete preFocusValue.current[key];
    if (String(newVal) !== String(oldVal)) {
      const itemList   = itemType === "milestone" ? milestones : activities;
      const name       = itemList.find(i => i._id === taskId)?.name || taskId;
      const fieldLabel = field === "startDate" ? "Start Date" : "Target Date";
      const typeLabel  = itemType === "milestone" ? "Milestone" : "Activity";
      const label      = `${typeLabel} "${name}" ${fieldLabel}: "${oldVal}" → "${newVal}"`;
      const rollback   = `__ROLLBACK__${JSON.stringify({ taskId, itemType, field, oldVal })}`;
      const notify     = onSetDirty || onBaselineBlur;
      notify?.(label);
      notify?.(rollback);
    }
  }, [activities, milestones, onSetDirty, onBaselineBlur]);

  const updateCost = useCallback((id, field, val) => {
    const next = { ...costData, [id]: { ...(costData[id] || {}), [field]: val } };
    saveSheet03({ costData: next });
  }, [costData, saveSheet03]);

  const syncActuals = useCallback((log, currentCostData) => {
    const sums = {};
    log.forEach(e => {
      if (!e.activityId || !e.amount) return;
      sums[e.activityId] = (sums[e.activityId] || 0) + (parseFloat(e.amount) || 0);
    });
    const next = { ...currentCostData };
    Object.keys(next).forEach(id => {
      next[id] = { ...next[id], actualAmount: sums[id] ? String(sums[id]) : "" };
    });
    Object.keys(sums).forEach(id => {
      if (!next[id]) next[id] = { plannedAmount:"", actualAmount: String(sums[id]) };
    });
    return next;
  }, []);

  const addExp = useCallback(() => {
    if (!newExp.activityId || !newExp.amount) return;
    const nextLog  = [...expLog, { ...newExp, id:`EXP-${String(expLog.length+1).padStart(3,"0")}`, date: newExp.date || toISO(new Date()) }];
    const nextCost = syncActuals(nextLog, costData);
    saveSheet03({ expenditureLog: nextLog, costData: nextCost });
    setNewExp({ activityId:"", date:"", amount:"", description:"", invoiceRef:"" });
  }, [newExp, expLog, costData, syncActuals, saveSheet03]);

  const delExp = useCallback((i) => {
    const nextLog  = expLog.filter((_, j) => j !== i);
    const nextCost = syncActuals(nextLog, costData);
    saveSheet03({ expenditureLog: nextLog, costData: nextCost });
  }, [expLog, costData, syncActuals, saveSheet03]);

  const items = useMemo(() => {
    const raw = [
      ...activities.map(a => ({ ...a, itemType:"activity",  color: PHASE_COLORS[a.phase] || C.accentL })),
      ...milestones.map(m => ({ ...m, itemType:"milestone", color: C.milestone })),
    ].filter(i => i.name || i.description);
    return autoDate(raw);
  }, [activities, milestones]);

  const phases = useMemo(() => {
    const p = [...new Set(items.map(i => i.phase || "Unassigned"))];
    return p.sort((a, b) => {
      const ia = PHASE_ORDER.indexOf(a), ib = PHASE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [items]);

  const { gStart, gEnd } = useMemo(() => {
    const liveD = items.flatMap(i =>
      [i.startDate, i.targetDate].filter(Boolean).map(d => parseDate(d))
    ).filter(Boolean);
    const baseD = [
      ...(baseline?.snapshot?.activities || []),
      ...(baseline?.snapshot?.milestones || []),
    ].flatMap(b => [b.startDate, b.targetDate].filter(Boolean).map(d => parseDate(d))).filter(Boolean);
    const allD = [...liveD, ...baseD];
    if (!allD.length) return { gStart: addDays(new Date(), -14), gEnd: addDays(new Date(), 90) };
    const minD = new Date(Math.min(...allD));
    const maxD = new Date(Math.max(...allD));
    return { gStart: addDays(minD, -7), gEnd: addDays(maxD, 21) };
  }, [items, baseline]);

  const { phaseSpend, maxBar, totalPlanned, totalActual } = useMemo(() => {
    const ps = phases.map(ph => {
      const its = items.filter(i => (i.phase || "Unassigned") === ph);
      return {
        phase:   ph,
        planned: its.reduce((s, i) => s + (parseFloat(costData[i._id]?.plannedAmount) || 0), 0),
        actual:  its.reduce((s, i) => s + (parseFloat(costData[i._id]?.actualAmount)  || 0), 0),
      };
    }).filter(d => d.planned || d.actual);
    return {
      phaseSpend:   ps,
      maxBar:       Math.max(...ps.map(d => Math.max(d.planned, d.actual)), 1),
      totalPlanned: Object.values(costData).reduce((s, c) => s + (parseFloat(c.plannedAmount) || 0), 0),
      totalActual:  expLog.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    };
  }, [phases, items, costData, expLog]);

  const inp     = { background:C.surface2, border:`1px solid ${C.border}`, borderRadius:4, color:C.sage, fontSize:11, padding:"3px 6px", outline:"none", fontFamily:"inherit", boxSizing:"border-box", width:"100%" };
  const dateInp = { ...inp, fontSize:10, padding:"2px 4px", cursor: canEdit ? "pointer" : "default" };
  const TH      = { background:C.surface2, fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".4px", padding:"0 8px", whiteSpace:"nowrap" };
  const W_NAME  = 150;
  const W_DATE  = 120;
  const W_PLAN  = 70;
  const W_ACT   = 70;
  const W_DONE  = 42;

  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const syncLeft  = () => { if (rightRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop; };
  const syncRight = () => { if (leftRef.current)  leftRef.current.scrollTop  = rightRef.current.scrollTop; };

  const sectionLabel = {
    fontSize:11, fontWeight:700, color:C.muted,
    textTransform:"uppercase", letterSpacing:".5px", marginBottom:12,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — GANTT  (taller — flex 2)
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex:"2 1 0", minHeight:0, display:"flex", overflow:"hidden", borderBottom:`2px solid ${C.border}` }}>

        {/* Frozen left columns */}
        <div style={{ flexShrink:0, display:"flex", flexDirection:"column", borderRight:`2px solid ${C.border}`, background:C.surface2 }}>

          {/* Header row */}
          <div style={{ display:"flex", height:44, flexShrink:0, alignItems:"center", borderBottom:`2px solid ${C.border}` }}>
            <div style={{ ...TH, width:W_NAME, borderRight:`1px solid ${C.border}` }}>Activity / Milestone</div>
            <div style={{ ...TH, width:W_DATE, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", justifyContent:"center", gap:1 }}>
              <span style={{ fontSize:8 }}>START</span>
              <span style={{ fontSize:8 }}>END</span>
            </div>
            <div style={{ ...TH, width:W_PLAN, textAlign:"right", borderRight:`1px solid ${C.border}` }}>Plan £</div>
            <div style={{ ...TH, width:W_ACT,  textAlign:"right", borderRight:`1px solid ${C.border}` }}>Act £</div>
            <div style={{ ...TH, width:W_DONE, textAlign:"center" }}>Done</div>
          </div>

          {/* Scrollable body */}
          <div ref={leftRef} onScroll={syncLeft}
            style={{ flex:1, overflowY:"auto", overflowX:"hidden", scrollbarWidth:"none", msOverflowStyle:"none" }}>

            {phases.map(phase => {
              const phItems = items.filter(i => (i.phase || "Unassigned") === phase);
              if (!phItems.length) return null;
              return (
                <div key={phase}>
                  <div style={{ height:24, display:"flex", alignItems:"center", padding:"0 8px", background:C.surface, borderBottom:`1px solid ${C.border}44`, fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", width:W_NAME+W_DATE+W_PLAN+W_ACT+W_DONE }}>
                    {phase}
                  </div>
                  {phItems.filter(item => {
                    if (taskFilter === "mine")       return isMine(item._id);
                    if (taskFilter === "incomplete") return !item._complete;
                    if (taskFilter === "complete")   return item._complete;
                    return true;
                  }).map((item, idx) => {
                    const isMile = item.itemType === "milestone";
                    const cd     = costData[item._id] || {};
                    const bg     = idx % 2 === 0 ? C.surface : C.surface2;
                    return (
                      <div key={item._id} style={{ display:"flex", height:ROW_H, background:bg, borderBottom:`1px solid ${C.border}22`, alignItems:"center" }}>

                        <div style={{ width:W_NAME, padding:"4px 8px", fontSize:11, color:isMile?C.milestone:C.sage, overflow:"hidden", wordBreak:"break-word", lineHeight:1.35, borderRight:`1px solid ${C.border}22`, flexShrink:0 }}>
                          {isMile ? "◆ " : ""}{item.name || item.description || "—"}
                        </div>

                        <div style={{ width:W_DATE, display:"flex", flexDirection:"column", justifyContent:"center", borderRight:`1px solid ${C.border}22`, flexShrink:0, padding:"2px 4px", gap:2 }}>
                          <input type="date" value={item.startDate||""} disabled={!canEdit} style={dateInp}
                            onFocus={e => handleDateFocus(item._id,"startDate",e.target.value)}
                            onChange={e => updateItemDate(item._id,item.itemType,"startDate",e.target.value)}
                            onBlur={e => handleDateBlur(item._id,item.itemType,"startDate",e.target.value)} />
                          {!isMile
                            ? <input type="date" value={item.targetDate||""} disabled={!canEdit} style={dateInp}
                                onFocus={e => handleDateFocus(item._id,"targetDate",e.target.value)}
                                onChange={e => updateItemDate(item._id,item.itemType,"targetDate",e.target.value)}
                                onBlur={e => handleDateBlur(item._id,item.itemType,"targetDate",e.target.value)} />
                            : <span style={{ fontSize:9, color:C.muted, paddingLeft:2 }}>milestone</span>
                          }
                        </div>

                        <div style={{ width:W_PLAN, padding:"0 4px", borderRight:`1px solid ${C.border}22`, flexShrink:0 }}>
                          {canEdit
                            ? <input style={{ ...inp, textAlign:"right" }} value={cd.plannedAmount||""} onChange={e => updateCost(item._id,"plannedAmount",e.target.value)} placeholder="0" />
                            : <span style={{ fontSize:10, color:C.dim, display:"block", textAlign:"right", paddingRight:4 }}>{cd.plannedAmount?`£${cd.plannedAmount}`:"—"}</span>
                          }
                        </div>

                        <div style={{ width:W_ACT, padding:"0 4px", borderRight:`1px solid ${C.border}22`, flexShrink:0 }}>
                          <span style={{ fontSize:10, color:cd.actualAmount?C.milestone:C.muted, display:"block", textAlign:"right", paddingRight:4 }}>
                            {cd.actualAmount?`£${cd.actualAmount}`:"—"}
                          </span>
                        </div>

                        <div style={{ width:W_DONE, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {canComplete(item._id) ? (
                            <button
                              onClick={() => handleComplete(item,!item._complete)}
                              title={item._complete?"Undo completion":"Mark complete"}
                              style={{ width:26, height:26, borderRadius:5, border:`1px solid ${item._complete?C.activity:C.border}`, background:item._complete?C.activity+"22":"none", color:item._complete?C.activity:C.muted, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                              {item._complete?"✓":""}
                            </button>
                          ) : (
                            <div style={{ width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", color:item._complete?C.activity:C.border, fontSize:13 }}>
                              {item._complete?"✓":"—"}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gantt SVG scroll pane */}
        <div ref={rightRef} onScroll={syncRight}
          style={{ flex:1, overflowX:"auto", overflowY:"auto", scrollbarWidth:"none", msOverflowStyle:"none" }}>
          <GanttSVG
            items={items}
            gStart={gStart}
            gEnd={gEnd}
            phases={phases}
            baselineItems={[
              ...(baseline?.snapshot?.activities||[]).map(a=>({...a,itemType:"activity"})),
              ...(baseline?.snapshot?.milestones||[]).map(m=>({...m,itemType:"milestone"})),
            ]}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — MIDDLE ROW: Cost Overview (left) | Expenditure Register (right)
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex:"1.3 1 0", minHeight:0, display:"flex", borderBottom:`2px solid ${C.border}`, overflow:"hidden" }}>

        {/* LEFT — Cost Overview + Cost Summary */}
        <div style={{ flex:1, borderRight:`2px solid ${C.border}`, overflowY:"auto", padding:"14px 16px", scrollbarWidth:"none", msOverflowStyle:"none" }}>
          <div style={sectionLabel}>Cost Overview</div>

          {phaseSpend.length > 0 ? (
            <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.muted, marginBottom:8, textTransform:"uppercase", letterSpacing:".4px" }}>Spend by Phase</div>
              {phaseSpend.map(({ phase, planned, actual }, i) => (
                <div key={i} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:C.dim, marginBottom:3 }}>{phase}</div>
                  {[["Planned",planned,C.accentL],["Actual",actual,C.milestone]].map(([lbl,val,col]) => (
                    <div key={lbl} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}>
                      <div style={{ width:44, fontSize:8, color:C.muted, textAlign:"right" }}>{lbl}</div>
                      <div style={{ flex:1, height:8, background:C.border, borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${(val/maxBar)*100}%`, height:"100%", background:col }} />
                      </div>
                      <span style={{ fontSize:9, color:col, minWidth:50, textAlign:"right" }}>£{val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginBottom:12 }}>No planned costs entered yet.</div>
          )}

          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", overflow:"hidden" }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, marginBottom:10, textTransform:"uppercase", letterSpacing:".4px" }}>Cost Summary</div>
            {[["Total Planned",totalPlanned,C.accentL],["Total Actual",totalActual,C.milestone]].map(([lbl,val,col]) => (
              <div key={lbl} style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{lbl}</div>
                <div style={{ fontSize:20, fontWeight:700, color:col }}>£{val.toLocaleString()}</div>
              </div>
            ))}
            <div style={{ paddingTop:8, borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>Variance</div>
              {(() => {
                const v = totalPlanned - totalActual;
                return (
                  <div style={{ fontSize:16, fontWeight:700, color: v>=0?C.activity:C.risk }}>
                    {v<0?"-":""}£{Math.abs(v).toLocaleString()}
                    <span style={{ fontSize:10, fontWeight:400, color:C.muted, marginLeft:6 }}>{v>=0?"under":"over"} budget</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT — Expenditure Register (read display; entries come from the form below) */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
          <div style={sectionLabel}>Expenditure Register</div>

          {expLog.length === 0 ? (
            <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>No expenditure logged yet. Use the form below to add entries.</div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", width:"100%", fontSize:11 }}>
                <thead>
                  <tr>
                    {["ID","Activity","Date","Amount £","Description","Ref", canEdit?"":""].map((h,i) => (
                      <th key={i} style={{ padding:"4px 8px", fontSize:9, fontWeight:700, color:C.muted, textTransform:"uppercase", textAlign:"left", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expLog.map((e, i) => {
                    const act = items.find(a => a._id === e.activityId);
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${C.border}22` }}>
                        <td style={{ padding:"4px 8px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{e.id}</td>
                        <td style={{ padding:"4px 8px", color:C.dim }}>{act?.name || act?.description || e.activityId}</td>
                        <td style={{ padding:"4px 8px", color:C.muted }}>{e.date}</td>
                        <td style={{ padding:"4px 8px", color:C.accentL, fontWeight:700 }}>£{parseFloat(e.amount||0).toLocaleString()}</td>
                        <td style={{ padding:"4px 8px", color:C.dim }}>{e.description}</td>
                        <td style={{ padding:"4px 8px", fontFamily:"monospace", fontSize:10, color:C.muted }}>{e.invoiceRef}</td>
                        {canEdit && (
                          <td style={{ padding:"4px 8px" }}>
                            <button onClick={() => delExp(i)} title="Delete entry"
                              style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, lineHeight:1, padding:"2px 4px", borderRadius:4, transition:"color .15s" }}
                              onMouseEnter={e2 => e2.target.style.color=C.risk}
                              onMouseLeave={e2 => e2.target.style.color=C.muted}>
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding:"5px 8px", fontSize:10, fontWeight:700, color:C.muted }}>TOTAL</td>
                    <td style={{ padding:"5px 8px", fontSize:12, fontWeight:700, color:C.accentL }}>
                      £{expLog.reduce((s,e) => s+(parseFloat(e.amount)||0),0).toLocaleString()}
                    </td>
                    <td colSpan={canEdit?3:2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — LOG NEW EXPENDITURE (full width, PM only)
      ══════════════════════════════════════════════════════ */}
      {canEdit && (
        <div style={{ flexShrink:0, borderTop:`1px solid ${C.border}`, background:C.surface2, padding:"12px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:10 }}>
            Log New Expenditure
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 110px 100px 1.6fr 100px auto", gap:8, alignItems:"end" }}>
            {[
              ["ACTIVITY",
                <select style={inp} value={newExp.activityId} onChange={e => setNewExp(p=>({...p,activityId:e.target.value}))}>
                  <option value="">Select activity…</option>
                  {items.map(i => <option key={i._id} value={i._id}>{i.name||i.description}</option>)}
                </select>
              ],
              ["DATE",        <input type="date" style={inp} value={newExp.date}        onChange={e=>setNewExp(p=>({...p,date:e.target.value}))} />],
              ["AMOUNT £",    <input style={inp} value={newExp.amount}      onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))}      placeholder="0.00" />],
              ["DESCRIPTION", <input style={inp} value={newExp.description} onChange={e=>setNewExp(p=>({...p,description:e.target.value}))} placeholder="e.g. Invoice" />],
              ["REF",         <input style={inp} value={newExp.invoiceRef}  onChange={e=>setNewExp(p=>({...p,invoiceRef:e.target.value}))}  placeholder="INV-001" />],
            ].map(([lbl,el]) => (
              <div key={lbl}>
                <div style={{ fontSize:8, color:C.muted, marginBottom:3, textTransform:"uppercase", letterSpacing:".4px" }}>{lbl}</div>
                {el}
              </div>
            ))}
            <button onClick={addExp}
              style={{ padding:"6px 16px", background:C.accent, border:"none", borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", alignSelf:"end", whiteSpace:"nowrap" }}>
              + Log
            </button>
          </div>
          {(!newExp.activityId || !newExp.amount) && (
            <div style={{ fontSize:9, color:C.muted, marginTop:6, fontStyle:"italic" }}>
              Activity and Amount are required. Entry will appear in the Expenditure Register above.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
