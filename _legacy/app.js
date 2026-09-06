import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, X, Check, AlertTriangle, ArrowLeft, Printer, Search, LogOut, Building2, ClipboardList, ChevronRight, ShieldCheck, Lock, RefreshCcw, FileText, CircleDot, CircleCheck, CircleDashed, Info, Calendar, ClipboardCheck, Send, RotateCcw, KeyRound, AlertCircle } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
/* ---------------------------------------------------------------------------
   Standalone storage shim — mirrors the get/set/delete/list API this app
   was originally written against, but persists to the browser's
   localStorage instead of Claude's artifact storage service. Data stays
   on the device/browser that opens the page (per-origin), same as any
   other localStorage-backed web app.
--------------------------------------------------------------------------- */
const LS_PREFIX = "capa_qms_store::";
const storage = {
    async get(key) {
        const raw = window.localStorage.getItem(LS_PREFIX + key);
        if (raw === null)
            return null;
        return { key, value: raw, shared: true };
    },
    async set(key, value) {
        window.localStorage.setItem(LS_PREFIX + key, value);
        return { key, value, shared: true };
    },
    async delete(key) {
        const existed = window.localStorage.getItem(LS_PREFIX + key) !== null;
        window.localStorage.removeItem(LS_PREFIX + key);
        return { key, deleted: existed, shared: true };
    },
    async list(prefix) {
        const keys = Object.keys(window.localStorage)
            .filter((k) => k.startsWith(LS_PREFIX + (prefix || "")))
            .map((k) => k.slice(LS_PREFIX.length));
        return { keys, prefix, shared: true };
    },
};
/* ============================================================================
   CAPA MANAGEMENT SYSTEM  —  v3
   Hierarchy: LOCALE -> MONTH -> DEPARTMENT -> CAPA PLAN -> CAPA SET[] (dynamic, starts at 1)
   Locale workflow is a single continuous form: SAVE CAPA PLAN (draft) or
   SUBMIT FOR QMD VERIFICATION (locks editing). QMD area is password-protected;
   QMD verification classifies plans into Effective / Partially Effective / Not Effective.
   ========================================================================== */
const STORAGE_KEY = "capa_qms_data_v3";
const QMD_CREDENTIALS = { username: "qmd.admin", password: "QMD@2026" };
const LOCALES = [
    { id: "VCHI", name: "VCHI" }, { id: "VCPA", name: "VCPA" }, { id: "VCNE", name: "VCNE" },
    { id: "VCLP", name: "VCLP" }, { id: "VCMA", name: "VCMA" }, { id: "VCSF", name: "VCSF" },
    { id: "KHBA", name: "KHBA" }, { id: "KHPA", name: "KHPA" },
];
const DEPARTMENTS = ["Service", "Rooms", "LMT", "FHI"];
const CATEGORIES = ["MAN", "MACHINE", "METHOD", "MEASUREMENT", "MATERIALS", "MOTHER_NATURE"];
const CATEGORY_LABELS = {
    MAN: "MAN", MACHINE: "MACHINE", METHOD: "METHOD",
    MEASUREMENT: "MEASUREMENT", MATERIALS: "MATERIALS", MOTHER_NATURE: "MOTHER NATURE (ENVIRONMENT)",
};
const MAX_CAUSES_PER_CATEGORY = 10;
const STAGES_LOCALE = [
    { key: "issue6m", label: "Issue & 6M", num: "01" },
    { key: "fishbone", label: "Fishbone", num: "02" },
    { key: "fivewhys", label: "5 Whys", num: "03" },
    { key: "action", label: "Action Plan", num: "04" },
];
const STAGE_QMD_VERIFY = { key: "verify", label: "QMD Verification", num: "05" };
const ACTION_STATUSES = ["Not Started", "In Progress", "Completed", "For Verification", "Closed"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/* ---------------------------------- utils --------------------------------- */
let uidCounter = 1;
function uid(prefix = "id") {
    uidCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${uidCounter}-${Math.floor(Math.random() * 9999)}`;
}
function pad(n, len = 2) { return String(n).padStart(len, "0"); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
    if (!d)
        return "—";
    try {
        return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    catch {
        return d;
    }
}
function isPastDate(d) {
    if (!d)
        return false;
    return new Date(d + "T00:00:00").getTime() < new Date(todayStr() + "T00:00:00").getTime();
}
function emptySixM() { const o = {}; CATEGORIES.forEach((c) => (o[c] = [])); return o; }
function makeSet(setNumber, capaId, overrides = {}) {
    return {
        id: uid("set"), setNumber, setCode: `${capaId}-SET-${pad(setNumber)}`, archived: false,
        issue: "", sixM: emptySixM(), vitalCauses: [],
        fiveWhys: { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "" },
        actionItems: [],
        ...overrides,
    };
}
function buildDefaultSets(capaId, count = 1) {
    const sets = [];
    for (let i = 1; i <= count; i++)
        sets.push(makeSet(i, capaId));
    return sets;
}
function activeSets(plan) { return (plan.sets || []).filter((s) => !s.archived); }
/** Sequence is unique per Locale + Year + Month, across all departments. */
function nextCapaId(plans, localeId, year, monthNum) {
    const count = plans.filter((p) => p.localeId === localeId && p.year === year && p.monthNum === monthNum).length;
    return `CAPA-${localeId}-${year}-${pad(monthNum)}-${pad(count + 1, 3)}`;
}
function setReadiness(s) {
    let n = 0;
    if (s.issue && s.issue.trim())
        n++;
    if (CATEGORIES.some((c) => s.sixM[c].length > 0))
        n++;
    if (s.vitalCauses.length > 0)
        n++;
    if (s.fiveWhys.rootCause && s.fiveWhys.rootCause.trim())
        n++;
    if (s.actionItems.length > 0)
        n++;
    return n / 5;
}
function planProgressPct(plan) {
    if (plan.stage === "closed")
        return 100;
    const sets = activeSets(plan);
    if (sets.length === 0)
        return 0;
    const avg = sets.reduce((a, s) => a + setReadiness(s), 0) / sets.length;
    return Math.round(avg * 100);
}
/** stage -> display label. "closed" stage represents an Effective (closed) verification result. */
const STAGE_LABEL = {
    submitted: "For QMD Verification",
    closed: "Effective",
    monitoring: "Partially Effective",
    reopened: "Not Effective",
};
function planStatus(plan) {
    if (plan.stage !== "draft")
        return STAGE_LABEL[plan.stage] || "Open";
    const sets = activeSets(plan);
    if (sets.length === 0)
        return "Open";
    const anyOverdue = sets.some((s) => s.actionItems.some((a) => a.targetDate && isPastDate(a.targetDate) && !["Completed", "Closed"].includes(a.status)));
    if (anyOverdue)
        return "Overdue";
    const anyProgress = sets.some((s) => setReadiness(s) > 0);
    return anyProgress ? "In Progress" : "Open";
}
function planRepresentativeIssue(plan) {
    const sets = activeSets(plan);
    const first = sets.find((s) => s.issue && s.issue.trim());
    if (first)
        return first.issue;
    return sets.length > 0 ? `${sets.length} finding(s) — issue not yet entered` : "No findings entered";
}
/* ------------------------------- seed / demo ------------------------------- */
function makeSeedData() {
    const months = [];
    const plans = [];
    function addMonth(localeId, year, monthNum) {
        const existing = months.find((m) => m.localeId === localeId && m.year === year && m.monthNum === monthNum);
        if (existing)
            return existing;
        const m = { id: uid("month"), localeId, year, monthNum, label: `${MONTH_NAMES[monthNum - 1]} ${year}` };
        months.push(m);
        return m;
    }
    const vchiAug = addMonth("VCHI", 2026, 8);
    addMonth("VCHI", 2026, 9);
    const vcpaAug = addMonth("VCPA", 2026, 8);
    const khpaJul = addMonth("KHPA", 2026, 7);
    /* ---- VCHI / Aug 2026 / Rooms — 8 dynamic sets, submitted for QMD verification ---- */
    {
        const capaId = nextCapaId(plans, "VCHI", 2026, 8);
        const sets = buildDefaultSets(capaId, 8);
        sets[0].issue = "Fire extinguisher was found expired during inspection.";
        sets[0].sixM.MAN = [
            { id: uid("c"), text: "Lack of training on fire safety equipment checks" },
            { id: uid("c"), text: "Lack of awareness of expiration monitoring" },
            { id: uid("c"), text: "Incorrect execution of inspection checklist" },
            { id: uid("c"), text: "Insufficient manpower assigned to safety rounds" },
        ];
        sets[0].sixM.METHOD = [{ id: uid("c"), text: "No standardized inspection procedure" }];
        sets[0].sixM.MACHINE = [{ id: uid("c"), text: "No monitoring device / reminder system" }];
        sets[0].sixM.MEASUREMENT = [{ id: uid("c"), text: "No tagging system to flag near-expiry units" }];
        sets[0].sixM.MATERIALS = [{ id: uid("c"), text: "Fire extinguisher refill stock not tracked" }];
        sets[0].sixM.MOTHER_NATURE = [{ id: uid("c"), text: "Storage area heat exposure accelerates wear" }];
        sets[0].vitalCauses = [
            { id: uid("vc"), text: "No preventive maintenance schedule for fire safety equipment" },
            { id: uid("vc"), text: "No standardized inspection / tagging procedure" },
        ];
        sets[0].fiveWhys = {
            why1: "The fire extinguisher was expired.",
            why2: "Because no one flagged it before the expiry date.",
            why3: "Because there is no tagging system for near-expiry units.",
            why4: "Because inspection rounds are not standardized or scheduled.",
            why5: "Because there is no preventive maintenance program for fire safety equipment.",
            rootCause: "Absence of a preventive maintenance and inspection schedule for fire safety equipment.",
        };
        sets[0].actionItems = [
            { id: uid("act"), correctiveAction: "Replace all expired fire extinguishers in Rooms department.", preventiveAction: "Implement a color-coded tagging system with quarterly inspection schedule.", responsiblePerson: "J. Santos", targetDate: "2026-08-20", status: "Completed", dateCompleted: "2026-08-15", verification: "Physical inspection log", remarks: "Completed ahead of schedule." },
            { id: uid("act"), correctiveAction: "Post inspection tags on every unit.", preventiveAction: "Assign monthly checklist owner per floor.", responsiblePerson: "M. Cruz", targetDate: "2026-08-25", status: "Completed", dateCompleted: "2026-08-22", verification: "Audit checklist", remarks: "" },
        ];
        sets[1].issue = "Housekeeping trolley left unattended with chemical spray exposed.";
        sets[1].sixM.METHOD = [{ id: uid("c"), text: "No lock-verification step for trolleys" }];
        sets[1].vitalCauses = [{ id: uid("vc"), text: "Closing procedure does not include trolley lock-verification" }];
        sets[1].fiveWhys = { why1: "Trolley was left unattended.", why2: "Because staff was called away mid-task.", why3: "Because there is no buddy-check protocol.", why4: "", why5: "", rootCause: "No buddy-check protocol for unattended trolleys." };
        sets[1].actionItems = [{ id: uid("act"), correctiveAction: "Secure trolley and retrain staff.", preventiveAction: "Introduce buddy-check protocol for housekeeping rounds.", responsiblePerson: "A. Reyes", targetDate: "2026-08-28", status: "Completed", dateCompleted: "2026-08-27", verification: "Training log", remarks: "" }];
        sets[2].issue = "Guest room smoke detector battery found dead.";
        sets[2].sixM.MACHINE = [{ id: uid("c"), text: "No battery replacement schedule" }];
        sets[2].vitalCauses = [{ id: uid("vc"), text: "No preventive battery-replacement schedule for detectors" }];
        sets[2].fiveWhys = { why1: "Detector battery was dead.", why2: "Because batteries are replaced reactively.", why3: "Because there is no PM schedule.", why4: "", why5: "", rootCause: "No preventive maintenance schedule for smoke detector batteries." };
        sets[2].actionItems = [{ id: uid("act"), correctiveAction: "Replace all flagged batteries.", preventiveAction: "Add quarterly battery check to PM calendar.", responsiblePerson: "L. Tan", targetDate: "2026-08-30", status: "Completed", dateCompleted: "2026-08-29", verification: "PM checklist", remarks: "" }];
        sets[3].issue = "Linen storage room found with inadequate ventilation.";
        sets[4].issue = "Guest complaint log missing follow-up notes for 3 entries.";
        sets[4].sixM.METHOD = [{ id: uid("c"), text: "No mandatory follow-up field in complaint log" }];
        sets[4].vitalCauses = [{ id: uid("vc"), text: "Complaint log template has no mandatory follow-up field" }];
        sets[4].fiveWhys = { why1: "Follow-up notes were missing.", why2: "Because the log template does not require them.", why3: "Because the template was never updated.", why4: "", why5: "", rootCause: "Complaint log template lacks a mandatory follow-up field." };
        sets[4].actionItems = [{ id: uid("act"), correctiveAction: "Back-fill missing follow-up notes.", preventiveAction: "Update complaint log template with mandatory field.", responsiblePerson: "M. Cruz", targetDate: "2026-08-31", status: "Completed", dateCompleted: "2026-08-30", verification: "Updated template", remarks: "" }];
        sets[5].issue = "Expired amenities found in Building 2 guest rooms.";
        sets[6].issue = "Emergency exit signage not illuminated during power interruption test.";
        sets[7].issue = "Contractor badge access not deactivated after contract end date.";
        plans.push({
            id: uid("plan"), capaId, localeId: "VCHI", monthId: vchiAug.id, year: 2026, monthNum: 8,
            department: "Rooms", dateCreated: "2026-08-02", source: "Internal Audit", preparedBy: "J. Santos",
            stage: "submitted", submittedDate: "2026-08-31",
            verification: { date: "", verifiedBy: "", evidence: "", result: "", remarks: "" },
            archived: false, sets,
        });
    }
    /* ---- VCHI / Aug 2026 / Service — draft, in progress, only 2 sets ---- */
    {
        const capaId = nextCapaId(plans, "VCHI", 2026, 8);
        const sets = buildDefaultSets(capaId, 1);
        sets.push(makeSet(2, capaId));
        sets[0].issue = "Room service order delivered 25 minutes past SLA.";
        sets[0].sixM.METHOD = [{ id: uid("c"), text: "No real-time order tracking between kitchen and floor" }];
        sets[1].issue = "Minibar restocking checklist not signed off.";
        plans.push({
            id: uid("plan"), capaId, localeId: "VCHI", monthId: vchiAug.id, year: 2026, monthNum: 8,
            department: "Service", dateCreated: "2026-08-05", source: "Customer Complaint", preparedBy: "A. Reyes",
            stage: "draft", submittedDate: "",
            verification: { date: "", verifiedBy: "", evidence: "", result: "", remarks: "" },
            archived: false, sets,
        });
    }
    /* ---- VCHI / Aug 2026 / LMT — already Effective (closed), single set ---- */
    {
        const capaId = nextCapaId(plans, "VCHI", 2026, 8);
        const sets = buildDefaultSets(capaId, 1);
        sets[0].issue = "Elevator maintenance log had a 2-week gap.";
        sets[0].sixM.METHOD = [{ id: uid("c"), text: "No escalation when PM log is not updated" }];
        sets[0].vitalCauses = [{ id: uid("vc"), text: "No escalation trigger for overdue PM log entries" }];
        sets[0].fiveWhys = { why1: "PM log had a gap.", why2: "Because the technician was on leave with no backup.", why3: "Because there is no backup assignment process.", why4: "", why5: "", rootCause: "No backup assignment process for PM logging during technician leave." };
        sets[0].actionItems = [{ id: uid("act"), correctiveAction: "Back-fill PM log with retroactive inspection.", preventiveAction: "Assign backup technician for PM logging.", responsiblePerson: "K. Fernandez", targetDate: "2026-08-10", status: "Completed", dateCompleted: "2026-08-09", verification: "PM log", remarks: "" }];
        plans.push({
            id: uid("plan"), capaId, localeId: "VCHI", monthId: vchiAug.id, year: 2026, monthNum: 8,
            department: "LMT", dateCreated: "2026-08-01", source: "Internal Audit", preparedBy: "K. Fernandez",
            stage: "closed", submittedDate: "2026-08-12",
            verification: { date: "2026-08-14", verifiedBy: "R. Dela Cruz (QMD)", evidence: "PM log + facility walkthrough", result: "Effective", remarks: "Backup assignment process adopted facility-wide." },
            archived: false, sets,
        });
    }
    /* ---- VCPA / Aug 2026 / Rooms — Partially Effective ---- */
    {
        const capaId = nextCapaId(plans, "VCPA", 2026, 8);
        const sets = buildDefaultSets(capaId, 1);
        sets[0].issue = "Room inspection checklist inconsistently applied across shifts.";
        sets[0].sixM.MAN = [{ id: uid("c"), text: "New shift staff not briefed on checklist standard" }];
        sets[0].vitalCauses = [{ id: uid("vc"), text: "Shift handover does not include checklist standard briefing" }];
        sets[0].fiveWhys = { why1: "Checklist was applied inconsistently.", why2: "Because shift staff use different versions.", why3: "Because there is no single controlled checklist version.", why4: "", why5: "", rootCause: "No single controlled version of the room inspection checklist." };
        sets[0].actionItems = [{ id: uid("act"), correctiveAction: "Distribute the current controlled checklist to all shifts.", preventiveAction: "Add checklist version control to document management.", responsiblePerson: "P. Villanueva", targetDate: "2026-08-20", status: "Completed", dateCompleted: "2026-08-19", verification: "Distribution log", remarks: "" }];
        plans.push({
            id: uid("plan"), capaId, localeId: "VCPA", monthId: vcpaAug.id, year: 2026, monthNum: 8,
            department: "Rooms", dateCreated: "2026-08-03", source: "Internal Audit", preparedBy: "P. Villanueva",
            stage: "monitoring", submittedDate: "2026-08-21",
            verification: { date: "2026-08-23", verifiedBy: "QMD Team", evidence: "Follow-up spot checks", result: "Partially Effective", remarks: "Improved but 2 of 5 shifts still inconsistent — placed under monitoring." },
            archived: false, sets,
        });
    }
    /* ---- KHPA / Jul 2026 / FHI — Not Effective ---- */
    {
        const capaId = nextCapaId(plans, "KHPA", 2026, 7);
        const sets = buildDefaultSets(capaId, 1);
        sets[0].issue = "Gym equipment maintenance tag expired.";
        sets[0].sixM.MACHINE = [{ id: uid("c"), text: "No PM schedule for gym equipment" }];
        sets[0].vitalCauses = [{ id: uid("vc"), text: "No PM schedule for gym / fitness equipment" }];
        sets[0].fiveWhys = { why1: "Maintenance tag was expired.", why2: "Because no PM schedule exists for gym equipment.", why3: "", why4: "", why5: "", rootCause: "No preventive maintenance schedule for gym equipment." };
        sets[0].actionItems = [{ id: uid("act"), correctiveAction: "Re-tag and service all gym equipment.", preventiveAction: "Create a PM schedule for gym equipment.", responsiblePerson: "K. Sokha", targetDate: "2026-07-15", status: "Completed", dateCompleted: "2026-07-14", verification: "Service log", remarks: "" }];
        plans.push({
            id: uid("plan"), capaId, localeId: "KHPA", monthId: khpaJul.id, year: 2026, monthNum: 7,
            department: "FHI", dateCreated: "2026-07-02", source: "Customer Complaint", preparedBy: "K. Sokha",
            stage: "reopened", submittedDate: "2026-07-16",
            verification: { date: "2026-07-20", verifiedBy: "QMD Team", evidence: "Spot check on 2026-07-19", result: "Not Effective", remarks: "PM schedule was created but not yet followed — one unit found overdue again." },
            archived: false, sets,
        });
    }
    return { locales: LOCALES, months, plans };
}
/* ==================================== ATOMS ==================================== */
function GlobalStyle() {
    return (_jsx("style", { children: `
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      :root{
        --bg:#F4F6F9; --surface:#FFFFFF; --surface-alt:#EEF2F6;
        --ink:#16212C; --ink-muted:#5D6E7E; --ink-faint:#93A1AF;
        --border:#DCE3EA;
        --navy:#1B3A5C; --navy-deep:#0F2740; --steel:#3B7CB4; --steel-soft:#E4EFF7;
        --rose:#C5405A; --rose-soft:#FBE7EB;
        --gold:#D9A02A; --gold-soft:#FBF1DA;
        --green:#1E8E52; --green-soft:#E4F5EC;
        --orange:#D9791F; --orange-soft:#FBEEDE;
        --purple:#7A5CC0; --purple-soft:#F0EBFA;
        --red:#CC3B3B; --red-soft:#FBE4E4;
        --slate-soft:#EDF0F4;
      }
      *{box-sizing:border-box;}
      .capa-root{ font-family:'Inter',system-ui,sans-serif; color:var(--ink); background:var(--bg); min-height:100vh; width:100%; -webkit-font-smoothing:antialiased; }
      .capa-root ::-webkit-scrollbar{ height:8px; width:8px; }
      .capa-root ::-webkit-scrollbar-thumb{ background:#C6D0DA; border-radius:8px; }
      .disp{ font-family:'Space Grotesk',sans-serif; }
      .mono{ font-family:'IBM Plex Mono',monospace; letter-spacing:0.02em; }
      .capa-tag{
        display:inline-flex; align-items:center; gap:6px; font-family:'IBM Plex Mono',monospace;
        font-size:12px; font-weight:600; letter-spacing:0.04em; padding:4px 10px;
        border:1px solid var(--navy); border-radius:4px; color:var(--navy); background:#fff; position:relative;
      }
      .capa-tag::before{ content:''; position:absolute; left:-1px; top:-1px; width:6px; height:6px; border-top:2px solid var(--navy); border-left:2px solid var(--navy); }
      .capa-tag::after{ content:''; position:absolute; right:-1px; bottom:-1px; width:6px; height:6px; border-bottom:2px solid var(--navy); border-right:2px solid var(--navy); }
      @media print{
        .no-print{ display:none !important; }
        .capa-root{ background:#fff !important; }
        .print-page{ box-shadow:none !important; margin:0 !important; padding:0 !important; }
        body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    ` }));
}
const STATUS_STYLES = {
    Open: { bg: "var(--slate-soft)", fg: "var(--ink-muted)", dot: "#93A1AF" },
    "In Progress": { bg: "var(--steel-soft)", fg: "var(--steel)", dot: "#3B7CB4" },
    "For QMD Verification": { bg: "var(--gold-soft)", fg: "var(--gold)", dot: "#D9A02A" },
    Overdue: { bg: "var(--red-soft)", fg: "var(--red)", dot: "#CC3B3B" },
    Effective: { bg: "var(--green-soft)", fg: "var(--green)", dot: "#1E8E52" },
    "Partially Effective": { bg: "var(--purple-soft)", fg: "var(--purple)", dot: "#7A5CC0" },
    "Not Effective": { bg: "var(--red-soft)", fg: "var(--red)", dot: "#CC3B3B" },
    "Not Started": { bg: "var(--slate-soft)", fg: "var(--ink-muted)", dot: "#93A1AF" },
    Completed: { bg: "var(--green-soft)", fg: "var(--green)", dot: "#1E8E52" },
};
function StatusBadge({ status, size = "md" }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.Open;
    return (_jsxs("span", { style: { background: s.bg, color: s.fg, borderRadius: 999, padding: size === "sm" ? "2px 8px" : "4px 12px", fontSize: size === "sm" ? 11 : 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }, children: [_jsx("span", { style: { width: 6, height: 6, borderRadius: 999, background: s.dot } }), status] }));
}
function Btn({ children, variant = "primary", onClick, type = "button", disabled, style, size = "md", title }) {
    const base = { fontFamily: "Inter, sans-serif", fontWeight: 600, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid transparent", padding: size === "sm" ? "6px 12px" : "9px 16px", fontSize: size === "sm" ? 13 : 14, transition: "all .15s ease", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" };
    const variants = {
        primary: { background: "var(--navy)", color: "#fff" },
        steel: { background: "var(--steel)", color: "#fff" },
        outline: { background: "#fff", color: "var(--navy)", border: "1px solid var(--border)" },
        ghost: { background: "transparent", color: "var(--ink-muted)" },
        danger: { background: "#fff", color: "var(--red)", border: "1px solid var(--red-soft)" },
        success: { background: "var(--green)", color: "#fff" },
        save: { background: "var(--navy)", color: "#fff" },
    };
    return (_jsx("button", { title: title, type: type, disabled: disabled, onClick: onClick, style: { ...base, ...variants[variant], ...style }, children: children }));
}
function Card({ children, style, className }) {
    return _jsx("div", { className: className, style: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, ...style }, children: children });
}
function FieldLabel({ children, hint }) {
    return (_jsxs("div", { style: { marginBottom: 5 }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }, children: children }), hint && _jsx("div", { style: { fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }, children: hint })] }));
}
const inputStyle = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14, fontFamily: "Inter, sans-serif", background: "#fff", color: "var(--ink)" };
function TextInput(props) { return _jsx("input", { ...props, style: { ...inputStyle, ...(props.style || {}) } }); }
function TextArea(props) { return _jsx("textarea", { ...props, style: { ...inputStyle, resize: "vertical", ...(props.style || {}) } }); }
function Select({ children, ...props }) { return _jsx("select", { ...props, style: { ...inputStyle, ...(props.style || {}) }, children: children }); }
function Modal({ title, onClose, children, width = 640 }) {
    return (_jsx("div", { style: { position: "fixed", inset: 0, background: "rgba(15,39,64,0.45)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }, onMouseDown: (e) => { if (e.target === e.currentTarget)
            onClose && onClose(); }, children: _jsxs("div", { style: { background: "#fff", borderRadius: 14, width: "100%", maxWidth: width, boxShadow: "0 20px 60px rgba(15,39,64,0.3)" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid var(--border)" }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 17 }, children: title }), _jsx("button", { onClick: onClose, style: { background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }, children: _jsx(X, { size: 20 }) })] }), _jsx("div", { style: { padding: 22 }, children: children })] }) }));
}
function ConfirmDialog({ title, message, onCancel, onConfirm, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = true }) {
    return (_jsxs(Modal, { title: title, onClose: onCancel, width: 460, children: [_jsxs("div", { style: { display: "flex", gap: 12, marginBottom: 20 }, children: [_jsx(AlertTriangle, { size: 22, color: "var(--red)", style: { flexShrink: 0, marginTop: 2 } }), _jsx("div", { style: { fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.5 }, children: message })] }), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 }, children: [_jsx(Btn, { variant: "ghost", onClick: onCancel, children: cancelLabel }), _jsx(Btn, { variant: danger ? "danger" : "primary", onClick: onConfirm, children: confirmLabel })] })] }));
}
function AccessDenied({ message, onGoHome, homeLabel = "Go to my Dashboard" }) {
    return (_jsxs("div", { style: { maxWidth: 520, margin: "80px auto", textAlign: "center", padding: "0 20px" }, children: [_jsx("div", { style: { width: 56, height: 56, borderRadius: 999, background: "var(--red-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }, children: _jsx(Lock, { size: 24, color: "var(--red)" }) }), _jsx("div", { className: "disp", style: { fontSize: 20, fontWeight: 700, color: "var(--navy-deep)", marginBottom: 8 }, children: "Access Denied" }), _jsx("div", { style: { fontSize: 13.5, color: "var(--ink-muted)", marginBottom: 20 }, children: message }), _jsx(Btn, { onClick: onGoHome, children: homeLabel })] }));
}
function SummaryCard({ label, value, tone = "ink", icon: Icon }) {
    const toneColor = { ink: "var(--navy)", green: "var(--green)", orange: "var(--orange)", red: "var(--red)", steel: "var(--steel)", gold: "var(--gold)", purple: "var(--purple)" }[tone];
    return (_jsxs(Card, { style: { padding: "16px 18px", flex: "1 1 140px", minWidth: 140 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }, children: label }), Icon && _jsx(Icon, { size: 16, color: toneColor })] }), _jsx("div", { className: "disp", style: { fontSize: 28, fontWeight: 700, color: toneColor, marginTop: 6 }, children: value })] }));
}
function countByStatus(plans) {
    const c = { total: plans.length, Open: 0, "In Progress": 0, "For QMD Verification": 0, Overdue: 0, Effective: 0, "Partially Effective": 0, "Not Effective": 0 };
    plans.forEach((p) => { const s = planStatus(p); c[s] = (c[s] || 0) + 1; });
    return c;
}
/* ==================================== LOGIN ==================================== */
function LoginScreen({ locales, onLogin, onGoQmdLogin, onResetDemo }) {
    return (_jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, children: _jsxs("div", { style: { width: "100%", maxWidth: 680 }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: 32 }, children: [_jsx("div", { className: "capa-tag", style: { marginBottom: 18 }, children: "QMS \u00B7 CORRECTIVE & PREVENTIVE ACTION" }), _jsx("div", { className: "disp", style: { fontSize: 38, fontWeight: 700, color: "var(--navy-deep)", letterSpacing: "-0.01em" }, children: "CAPA Management System" }), _jsx("div", { style: { color: "var(--ink-muted)", marginTop: 8, fontSize: 15 }, children: "Select your locale, or sign in as Quality Management Department" })] }), _jsxs(Card, { style: { padding: 28 }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }, children: "Select Locale" }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 22 }, children: locales.map((l) => (_jsxs("button", { onClick: () => onLogin({ role: "locale", localeId: l.id }), style: { border: "1px solid var(--border)", borderRadius: 10, padding: "14px 12px", background: "#fff", cursor: "pointer", textAlign: "left" }, onMouseEnter: (e) => (e.currentTarget.style.borderColor = "var(--steel)"), onMouseLeave: (e) => (e.currentTarget.style.borderColor = "var(--border)"), children: [_jsx(Building2, { size: 16, color: "var(--steel)" }), _jsx("div", { className: "disp mono", style: { fontSize: 16, fontWeight: 700, marginTop: 8, color: "var(--navy-deep)" }, children: l.id })] }, l.id))) }), _jsxs("div", { style: { borderTop: "1px solid var(--border)", paddingTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [_jsx(ShieldCheck, { size: 20, color: "var(--navy)" }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, fontSize: 14.5 }, children: "Quality Management Department" }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)" }, children: "Password-protected \u2014 verification & monitoring" })] })] }), _jsxs(Btn, { onClick: onGoQmdLogin, children: [_jsx(KeyRound, { size: 15 }), " QMD / Management Login"] })] })] }), _jsx("div", { style: { textAlign: "center", marginTop: 18 }, children: _jsxs("button", { onClick: onResetDemo, style: { background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }, children: [_jsx(RefreshCcw, { size: 12 }), " Reset demo data"] }) })] }) }));
}
function QmdLoginScreen({ onSubmit, onBack }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const submit = (e) => {
        e.preventDefault();
        const userOk = username.trim().toLowerCase() === QMD_CREDENTIALS.username.toLowerCase();
        const passOk = password.trim() === QMD_CREDENTIALS.password;
        if (userOk && passOk) {
            setError("");
            onSubmit();
        }
        else {
            setError("Invalid username or password.");
        }
    };
    return (_jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, children: _jsxs("div", { style: { width: "100%", maxWidth: 420 }, children: [_jsxs("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 18 }, children: [_jsx(ArrowLeft, { size: 14 }), " Back to locale selection"] }), _jsxs(Card, { style: { padding: 28 }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: 20 }, children: [_jsx("div", { style: { width: 52, height: 52, borderRadius: 999, background: "var(--steel-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }, children: _jsx(ShieldCheck, { size: 24, color: "var(--navy)" }) }), _jsx("div", { className: "disp", style: { fontSize: 22, fontWeight: 700, color: "var(--navy-deep)" }, children: "QMD Login" }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 4 }, children: "Quality Management Department access only" })] }), _jsxs("form", { onSubmit: submit, children: [_jsxs("div", { style: { marginBottom: 14 }, children: [_jsx(FieldLabel, { children: "Username" }), _jsx(TextInput, { value: username, onChange: (e) => setUsername(e.target.value), placeholder: "Enter username", autoFocus: true })] }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx(FieldLabel, { children: "Password" }), _jsx(TextInput, { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter password" })] }), error && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, color: "var(--red)", fontSize: 12.5, marginBottom: 10 }, children: [_jsx(AlertCircle, { size: 14 }), " ", error] })), _jsx(Btn, { type: "submit", style: { width: "100%", justifyContent: "center", marginTop: 6 }, children: "LOGIN" })] }), _jsxs("div", { style: { marginTop: 16, fontSize: 11.5, color: "var(--ink-faint)", textAlign: "center" }, children: ["Demo credentials: ", _jsx("span", { className: "mono", children: QMD_CREDENTIALS.username }), " / ", _jsx("span", { className: "mono", children: QMD_CREDENTIALS.password })] })] })] }) }));
}
/* ============================== TOP NAV ============================== */
function TopBar({ currentUser, onLogout, breadcrumbs }) {
    return (_jsxs("div", { className: "no-print", style: { background: "var(--navy-deep)", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40, flexWrap: "wrap", gap: 10 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }, children: [_jsx(ClipboardList, { size: 20 }), _jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 15.5 }, children: "CAPA Management System" }), (breadcrumbs || []).map((b, i) => (_jsxs("div", { style: { color: "#9FB3C6", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }, children: [_jsx(ChevronRight, { size: 13 }), b] }, i)))] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [_jsxs("div", { style: { fontSize: 13, color: "#C7D6E3", display: "flex", alignItems: "center", gap: 6 }, children: [currentUser.role === "qmd" ? _jsx(ShieldCheck, { size: 15 }) : _jsx(Building2, { size: 15 }), currentUser.role === "qmd" ? "QMD / Management" : `${currentUser.localeId} Locale User`] }), _jsxs("button", { onClick: onLogout, style: { background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }, children: [_jsx(LogOut, { size: 14 }), " Log out"] })] })] }));
}
/* ============================ LOCALE DASHBOARD (top) ============================ */
function LocaleDashboard({ data, localeId, onOpenMonth, onCreateMonth }) {
    const plans = data.plans.filter((p) => p.localeId === localeId && !p.archived);
    const counts = countByStatus(plans);
    const months = data.months.filter((m) => m.localeId === localeId).sort((a, b) => (b.year - a.year) || (b.monthNum - a.monthNum));
    return (_jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 14 }, children: [_jsxs("div", { children: [_jsx("div", { className: "capa-tag", children: "LOCALE DASHBOARD" }), _jsx("div", { className: "disp", style: { fontSize: 34, fontWeight: 700, color: "var(--navy-deep)", marginTop: 10 }, children: localeId })] }), _jsxs(Btn, { onClick: onCreateMonth, children: [_jsx(Plus, { size: 16 }), " Create Month"] })] }), _jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }, children: "CAPA Summary" }), _jsxs("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }, children: [_jsx(SummaryCard, { label: "Total CAPA Plans", value: counts.total, tone: "ink", icon: ClipboardList }), _jsx(SummaryCard, { label: "Open", value: counts.Open || 0, tone: "steel", icon: CircleDot }), _jsx(SummaryCard, { label: "In Progress", value: counts["In Progress"] || 0, tone: "steel", icon: CircleDashed }), _jsx(SummaryCard, { label: "For QMD Verification", value: counts["For QMD Verification"] || 0, tone: "gold", icon: ClipboardCheck }), _jsx(SummaryCard, { label: "Overdue", value: counts.Overdue || 0, tone: "red", icon: AlertTriangle }), _jsx(SummaryCard, { label: "Effective", value: counts.Effective || 0, tone: "green", icon: CircleCheck }), _jsx(SummaryCard, { label: "Partially Effective", value: counts["Partially Effective"] || 0, tone: "purple", icon: RotateCcw }), _jsx(SummaryCard, { label: "Not Effective", value: counts["Not Effective"] || 0, tone: "red", icon: RefreshCcw }), _jsx(SummaryCard, { label: "Closed", value: counts.Effective || 0, tone: "green", icon: CircleCheck })] }), _jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }, children: "Months" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }, children: [months.map((m) => {
                        const mPlans = plans.filter((p) => p.monthId === m.id);
                        return (_jsxs("button", { onClick: () => onOpenMonth(m.id), style: { textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18, cursor: "pointer" }, onMouseEnter: (e) => (e.currentTarget.style.borderColor = "var(--steel)"), onMouseLeave: (e) => (e.currentTarget.style.borderColor = "var(--border)"), children: [_jsx(Calendar, { size: 16, color: "var(--steel)" }), _jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 17, marginTop: 10 }, children: m.label }), _jsxs("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 4 }, children: [mPlans.length, " CAPA plan", mPlans.length !== 1 ? "s" : ""] })] }, m.id));
                    }), months.length === 0 && (_jsxs("div", { style: { gridColumn: "1 / -1", padding: 28, textAlign: "center", color: "var(--ink-faint)", border: "1px dashed var(--border)", borderRadius: 12 }, children: ["No months yet. Click ", _jsx("strong", { children: "Create Month" }), " to start."] }))] })] }));
}
function CreateMonthModal({ localeId, existingMonths, onClose, onCreate }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthNum, setMonthNum] = useState(now.getMonth() + 1);
    const duplicate = existingMonths.some((m) => m.year === Number(year) && m.monthNum === Number(monthNum));
    return (_jsxs(Modal, { title: "Create Month", onClose: onClose, width: 420, children: [_jsxs("div", { style: { fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }, children: ["Select the month to create for locale ", _jsx("strong", { children: localeId }), "."] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Month" }), _jsx(Select, { value: monthNum, onChange: (e) => setMonthNum(Number(e.target.value)), children: MONTH_NAMES.map((m, i) => _jsx("option", { value: i + 1, children: m }, m)) })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Year" }), _jsx(TextInput, { type: "number", value: year, onChange: (e) => setYear(Number(e.target.value)) })] })] }), duplicate && _jsxs("div", { style: { marginTop: 10, fontSize: 12.5, color: "var(--red)" }, children: ["This month already exists for ", localeId, "."] }), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }, children: [_jsx(Btn, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsxs(Btn, { variant: "save", disabled: duplicate, onClick: () => onCreate({ year: Number(year), monthNum: Number(monthNum) }), children: [_jsx(Check, { size: 14 }), " Click to Save"] })] })] }));
}
/* ============================ MONTH DASHBOARD (departments) ============================ */
function MonthDashboard({ data, month, onBack, onOpenPlan, onCreatePlan }) {
    const plans = data.plans.filter((p) => p.monthId === month.id && !p.archived);
    return (_jsxs("div", { style: { maxWidth: 1200, margin: "0 auto", padding: "24px 24px 60px" }, children: [_jsxs("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12 }, children: [_jsx(ArrowLeft, { size: 14 }), " Back to ", month.localeId, " Dashboard"] }), _jsx("div", { className: "capa-tag", children: "MONTHLY CAPA VIEW" }), _jsxs("div", { className: "disp", style: { fontSize: 30, fontWeight: 700, color: "var(--navy-deep)", margin: "10px 0 24px" }, children: [month.localeId, " \u2014 ", month.label] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }, children: DEPARTMENTS.map((dept) => {
                    const deptPlans = plans.filter((p) => p.department === dept);
                    return (_jsxs(Card, { style: { padding: 0, overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-alt)" }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 15 }, children: dept.toUpperCase() }), _jsxs(Btn, { size: "sm", variant: "outline", onClick: () => onCreatePlan(dept), children: [_jsx(Plus, { size: 13 }), " CAPA Plan"] })] }), _jsxs("div", { style: { padding: 10 }, children: [deptPlans.length === 0 && _jsx("div", { style: { padding: 12, fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }, children: "No CAPA plans yet." }), deptPlans.map((p) => {
                                        const status = planStatus(p);
                                        const pct = planProgressPct(p);
                                        return (_jsxs("button", { onClick: () => onOpenPlan(p.id), style: { width: "100%", textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }, children: [_jsx("span", { className: "mono", style: { fontWeight: 700, fontSize: 12 }, children: p.capaId }), _jsx(StatusBadge, { status: status, size: "sm" })] }), _jsxs("div", { style: { fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }, children: [activeSets(p).length, " CAPA Set(s) \u00B7 ", pct, "% complete"] })] }, p.id));
                                    })] })] }, dept));
                }) })] }));
}
function CreateCapaModal({ localeId, month, department, plans, onClose, onCreate }) {
    const previewId = nextCapaId(plans, localeId, month.year, month.monthNum);
    const [form, setForm] = useState({ dateCreated: todayStr(), source: "Internal Audit", preparedBy: "" });
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const canSubmit = form.preparedBy.trim();
    return (_jsxs(Modal, { title: `Create CAPA Plan — ${department}`, onClose: onClose, width: 520, children: [_jsxs("div", { style: { marginBottom: 16, background: "var(--steel-soft)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--navy)" }, children: [_jsx("span", { className: "mono", style: { fontWeight: 700 }, children: previewId }), " \u00B7 ", localeId, " \u00B7 ", month.label, " \u00B7 ", department, ". Created with ", _jsx("strong", { children: "1 default CAPA Set" }), " \u2014 add more from the workflow as needed."] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Date Created" }), _jsx(TextInput, { type: "date", value: form.dateCreated, onChange: (e) => set("dateCreated", e.target.value) })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Source of Finding" }), _jsx(Select, { value: form.source, onChange: (e) => set("source", e.target.value), children: ["Internal Audit", "External Audit", "Customer Complaint", "Management Review", "Incident Report", "Other"].map((s) => _jsx("option", { children: s }, s)) })] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx(FieldLabel, { children: "Prepared By" }), _jsx(TextInput, { value: form.preparedBy, onChange: (e) => set("preparedBy", e.target.value) })] })] }), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }, children: [_jsx(Btn, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsxs(Btn, { variant: "save", disabled: !canSubmit, onClick: () => onCreate(form), children: [_jsx(Check, { size: 14 }), " Click to Save"] })] })] }));
}
/* ============================== WORKFLOW SHELL ============================== */
function StageNav({ stages, activeStage, onSelect }) {
    return (_jsx("div", { className: "no-print", style: { display: "flex", overflowX: "auto", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6 }, children: stages.map((s, i) => {
            const active = s.key === activeStage;
            return (_jsxs(React.Fragment, { children: [_jsxs("button", { onClick: () => onSelect(s.key), style: { border: "none", cursor: "pointer", padding: "9px 14px", borderRadius: 8, whiteSpace: "nowrap", background: active ? "var(--navy)" : "transparent", color: active ? "#fff" : "var(--ink-muted)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { className: "mono", style: { fontSize: 11, opacity: 0.8 }, children: s.num }), " ", s.label] }), i < stages.length - 1 && _jsx(ChevronRight, { size: 14, color: "var(--ink-faint)", style: { alignSelf: "center", flexShrink: 0 } })] }, s.key));
        }) }));
}
function SetTabs({ sets, activeSetId, onSelect, onAdd, onDelete, readOnly }) {
    return (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [sets.map((s) => {
                const active = s.id === activeSetId;
                const ready = setReadiness(s);
                const dot = ready >= 1 ? "#1E8E52" : ready > 0 ? "#3B7CB4" : "#93A1AF";
                return (_jsxs("button", { onClick: () => onSelect(s.id), title: s.issue || `Set ${s.setNumber}`, style: { border: active ? "1px solid var(--navy)" : "1px solid var(--border)", background: active ? "var(--navy)" : "#fff", color: active ? "#fff" : "var(--ink)", borderRadius: 999, padding: "7px 14px 7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }, children: [_jsx("span", { style: { width: 7, height: 7, borderRadius: 999, background: active ? "#fff" : dot } }), "Set ", s.setNumber, !readOnly && sets.length > 1 && (_jsx("span", { onClick: (e) => { e.stopPropagation(); onDelete(s.id); }, style: { marginLeft: 2, opacity: 0.7, display: "flex" }, children: _jsx(Trash2, { size: 12 }) }))] }, s.id));
            }), !readOnly && _jsxs(Btn, { size: "sm", variant: "outline", onClick: onAdd, children: [_jsx(Plus, { size: 14 }), " Add CAPA Set"] })] }));
}
function ProgressTracker({ plan }) {
    const sets = activeSets(plan);
    const has = (fn) => sets.length > 0 && sets.every(fn);
    const items = [
        { label: "Issue Identified", done: has((s) => s.issue && s.issue.trim()) },
        { label: "6M Root Cause Analysis", done: has((s) => CATEGORIES.some((c) => s.sixM[c].length > 0)) },
        { label: "Fishbone (auto)", done: has((s) => CATEGORIES.some((c) => s.sixM[c].length > 0)) },
        { label: "5 Whys / Root Cause", done: has((s) => s.fiveWhys.rootCause && s.fiveWhys.rootCause.trim()) },
        { label: "Action Plan", done: has((s) => s.actionItems.length > 0) },
        { label: "Submitted for QMD Verification", done: plan.stage !== "draft" },
        { label: "QMD Verification Result", done: ["closed", "monitoring", "reopened"].includes(plan.stage) },
    ];
    const pct = planProgressPct(plan);
    return (_jsxs(Card, { style: { padding: "16px 18px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 14 }, children: "CAPA Progress Tracker" }), _jsxs("div", { style: { fontSize: 13, fontWeight: 700, color: pct === 100 ? "var(--green)" : "var(--navy)" }, children: ["Overall Completion: ", pct, "%"] })] }), _jsx("div", { style: { display: "flex", gap: 6, marginBottom: 14 }, children: items.map((it) => _jsx("div", { style: { flex: 1, height: 6, borderRadius: 999, background: it.done ? "var(--green)" : "var(--surface-alt)" } }, it.label)) }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "10px 22px" }, children: items.map((it) => (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }, children: [it.done ? _jsx(CircleCheck, { size: 15, color: "var(--green)" }) : _jsx(CircleDashed, { size: 15, color: "var(--ink-faint)" }), _jsx("span", { style: { color: it.done ? "var(--ink)" : "var(--ink-muted)" }, children: it.label })] }, it.label))) })] }));
}
/* --------------------------- Stage: Issue & 6M --------------------------- */
function CausesList({ category, causes, onChange, readOnly }) {
    const label = CATEGORY_LABELS[category];
    const update = (idx, text) => { const next = causes.slice(); next[idx] = { ...next[idx], text }; onChange(next); };
    const add = () => { if (causes.length >= MAX_CAUSES_PER_CATEGORY)
        return; onChange([...causes, { id: uid("c"), text: "" }]); };
    const remove = (idx) => onChange(causes.filter((_, i) => i !== idx));
    return (_jsxs(Card, { style: { padding: 14 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5 }, children: label }), _jsxs("span", { style: { fontSize: 11.5, color: "var(--ink-faint)" }, children: [causes.length, "/", MAX_CAUSES_PER_CATEGORY] })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [causes.map((c, i) => (_jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [_jsx("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-faint)", width: 16 }, children: i + 1 }), _jsx(TextInput, { value: c.text, disabled: readOnly, onChange: (e) => update(i, e.target.value), placeholder: `Cause #${i + 1}`, style: { padding: "6px 9px", fontSize: 13 } }), !readOnly && _jsx("button", { onClick: () => remove(i), style: { background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", flexShrink: 0 }, children: _jsx(X, { size: 14 }) })] }, c.id))), causes.length === 0 && _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }, children: "No causes identified yet." })] }), !readOnly && causes.length < MAX_CAUSES_PER_CATEGORY && (_jsxs("button", { onClick: add, style: { marginTop: 8, background: "none", border: "1px dashed var(--border)", borderRadius: 6, width: "100%", padding: "6px", cursor: "pointer", color: "var(--steel)", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }, children: [_jsx(Plus, { size: 13 }), " Add cause"] }))] }));
}
function IssueAnd6MStage({ set, onUpdateSet, readOnly }) {
    const setIssue = (issue) => onUpdateSet({ ...set, issue });
    const setCause = (cat, causes) => onUpdateSet({ ...set, sixM: { ...set.sixM, [cat]: causes } });
    const addVital = () => onUpdateSet({ ...set, vitalCauses: [...set.vitalCauses, { id: uid("vc"), text: "" }] });
    const updateVital = (idx, text) => { const n = set.vitalCauses.slice(); n[idx] = { ...n[idx], text }; onUpdateSet({ ...set, vitalCauses: n }); };
    const removeVital = (idx) => onUpdateSet({ ...set, vitalCauses: set.vitalCauses.filter((_, i) => i !== idx) });
    return (_jsxs("div", { children: [_jsxs(Card, { style: { padding: 16, marginBottom: 16, borderColor: "var(--rose)" }, children: [_jsxs(FieldLabel, { children: ["Issue / Finding \u2014 Set ", set.setNumber] }), _jsx(TextArea, { rows: 2, disabled: readOnly, value: set.issue, onChange: (e) => setIssue(e.target.value), placeholder: 'e.g. "Fire extinguisher was found expired during inspection."', style: { background: "var(--rose-soft)", border: "1px solid var(--rose)", fontWeight: 500 } }), _jsxs("div", { style: { fontSize: 12, color: "var(--ink-faint)", marginTop: 6, display: "flex", gap: 6, alignItems: "center" }, children: [_jsx(Info, { size: 12 }), " Flows automatically into Fishbone, 5 Whys, Action Plan and the CAPA Report. Remember to click ", _jsx("strong", { children: "Save CAPA Plan" }), " at the end."] })] }), _jsx("div", { style: { fontSize: 13, color: "var(--ink-muted)", marginBottom: 10 }, children: "Identify possible causes under each 6M category (up to 10 each)." }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 20 }, children: CATEGORIES.map((cat) => _jsx(CausesList, { category: cat, causes: set.sixM[cat], onChange: (c) => setCause(cat, c), readOnly: readOnly }, cat)) }), _jsxs(Card, { style: { padding: 16, background: "var(--gold-soft)", border: "1px solid var(--gold)" }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 14.5, marginBottom: 4 }, children: "Affinitize Here" }), _jsx("div", { style: { fontSize: 13, color: "var(--ink-muted)", marginBottom: 12 }, children: "Group the identified causes with almost the same context and reduce them to 1\u20132 common causes." }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: set.vitalCauses.map((vc, i) => (_jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsx("span", { className: "disp", style: { fontSize: 12, fontWeight: 700, color: "var(--gold)", width: 20 }, children: i + 1 }), _jsx(TextInput, { value: vc.text, disabled: readOnly, onChange: (e) => updateVital(i, e.target.value), placeholder: "Vital / Affinitized cause", style: { background: "#fff", border: "1px solid var(--gold)" } }), !readOnly && _jsx("button", { onClick: () => removeVital(i), style: { background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)" }, children: _jsx(X, { size: 15 }) })] }, vc.id))) }), !readOnly && set.vitalCauses.length < 2 && (_jsxs(Btn, { size: "sm", variant: "outline", onClick: addVital, style: { marginTop: 10, borderColor: "var(--gold)", color: "#8a6a12" }, children: [_jsx(Plus, { size: 13 }), " Add Vital / Affinitized Cause"] }))] })] }));
}
/* ------------------------------ Stage: Fishbone (redesigned) ------------------------------ */
function BoneList({ title, causes, onExpand }) {
    return (_jsxs("div", { style: { width: 185 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 12, color: "var(--navy-deep)", marginBottom: 6 }, children: title }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [causes.length === 0 && _jsx("div", { style: { fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }, children: "No causes yet" }), causes.map((c, i) => (_jsxs("button", { onClick: () => onExpand(c.text, title), style: { width: "100%", textAlign: "left", background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", display: "flex", gap: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [_jsx("span", { className: "mono", style: { color: "var(--ink-faint)" }, children: i + 1 }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: c.text || "—" })] }, c.id)))] })] }));
}
function FishboneStage({ set }) {
    const [expanded, setExpanded] = useState(null);
    const W = 1080, H = 480;
    const spineY = 240, spineX1 = 70, spineX2 = 640;
    const cx = 850, cy = 240, r = 100;
    const topAttach = [[190, "MAN"], [370, "METHOD"], [540, "MEASUREMENT"]];
    const botAttach = [[190, "MOTHER_NATURE"], [370, "MATERIALS"], [540, "MACHINE"]];
    return (_jsxs(Card, { style: { padding: 20 }, children: [_jsxs("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginBottom: 4 }, children: ["Fishbone Diagram \u2014 Set ", set.setNumber] }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }, children: "Auto-populated from the 6M Root Cause Analysis. Click any cause to view its full text." }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("div", { style: { position: "relative", width: W, height: H, margin: "0 auto" }, children: [_jsxs("svg", { width: W, height: H, style: { position: "absolute", top: 0, left: 0, zIndex: 0 }, children: [_jsx("line", { x1: spineX1, y1: spineY, x2: spineX2, y2: spineY, stroke: "#B9C6D2", strokeWidth: "2.5" }), topAttach.map(([x], i) => _jsx("line", { x1: x, y1: 70, x2: x + 100, y2: spineY, stroke: "#CBD6DF", strokeWidth: "2" }, "t" + i)), botAttach.map(([x], i) => _jsx("line", { x1: x, y1: 410, x2: x + 100, y2: spineY, stroke: "#CBD6DF", strokeWidth: "2" }, "b" + i)), _jsx("circle", { cx: cx, cy: cy, r: r, fill: "#FBE7EB", stroke: "var(--rose)", strokeWidth: "2.5" }), _jsx("foreignObject", { x: cx - 82, y: cy - 62, width: 164, height: 124, children: _jsxs("div", { onClick: () => setExpanded({ t: set.issue || "No issue entered yet", c: "Issue / Effect" }), style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.04em" }, children: "Issue / Effect" }), _jsx("div", { style: { fontSize: 12, fontWeight: 600, marginTop: 4, color: "var(--navy-deep)", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: set.issue || "No issue entered yet" })] }) })] }), topAttach.map(([x, cat]) => (_jsx("div", { style: { position: "absolute", left: x - 100, top: 8, zIndex: 1 }, children: _jsx(BoneList, { title: CATEGORY_LABELS[cat], causes: set.sixM[cat], onExpand: (t, c) => setExpanded({ t, c }) }) }, cat))), botAttach.map(([x, cat]) => (_jsx("div", { style: { position: "absolute", left: x - 100, top: 348, zIndex: 1 }, children: _jsx(BoneList, { title: CATEGORY_LABELS[cat], causes: set.sixM[cat], onExpand: (t, c) => setExpanded({ t, c }) }) }, cat)))] }) }), _jsxs("div", { style: { marginTop: 8, background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 8, padding: 14 }, children: [_jsx("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 8 }, children: "List of Affinitized Vital Causes" }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [set.vitalCauses.length === 0 && _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }, children: "None identified yet \u2014 complete Affinitization on the Issue & 6M page." }), set.vitalCauses.map((vc, i) => _jsxs("div", { style: { fontSize: 13 }, children: [_jsxs("strong", { children: [i + 1, "."] }), " ", vc.text || "—"] }, vc.id))] })] }), expanded && (_jsx(Modal, { title: expanded.c, onClose: () => setExpanded(null), width: 440, children: _jsx("div", { style: { fontSize: 14, lineHeight: 1.5 }, children: expanded.t }) }))] }));
}
/* ------------------------------ Stage: 5 Whys ------------------------------ */
function FiveWhysStage({ set, onUpdateSet, readOnly }) {
    const setW = (k, v) => onUpdateSet({ ...set, fiveWhys: { ...set.fiveWhys, [k]: v } });
    return (_jsxs(Card, { style: { padding: 20 }, children: [_jsxs("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginBottom: 4 }, children: ["5 Whys Root Cause Analysis \u2014 Set ", set.setNumber] }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }, children: "Continue asking Why until the underlying root cause is identified." }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }, children: [_jsxs("div", { style: { background: "var(--surface-alt)", borderRadius: 8, padding: 12 }, children: [_jsx(FieldLabel, { children: "Issue" }), _jsx("div", { style: { fontSize: 13.5 }, children: set.issue || "—" })] }), _jsxs("div", { style: { background: "var(--gold-soft)", borderRadius: 8, padding: 12 }, children: [_jsx(FieldLabel, { children: "Vital / Affinitized Causes" }), set.vitalCauses.length === 0 ? _jsx("div", { style: { fontSize: 13.5, color: "var(--ink-faint)" }, children: "\u2014" }) : set.vitalCauses.map((vc, i) => _jsxs("div", { style: { fontSize: 13.5 }, children: [i + 1, ". ", vc.text] }, vc.id))] })] }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [1, 2, 3, 4, 5].map((n) => (_jsxs("div", { style: { display: "flex", gap: 12, alignItems: "flex-start" }, children: [_jsx("div", { style: { width: 90, flexShrink: 0, paddingTop: 9 }, children: _jsxs("span", { style: { background: "var(--navy)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12.5, fontWeight: 700 }, children: ["WHY ", n] }) }), _jsx(TextInput, { value: set.fiveWhys[`why${n}`], disabled: readOnly, onChange: (e) => setW(`why${n}`, e.target.value), placeholder: n === 1 ? "Why did this happen?" : "Why did that happen?" })] }, n))) }), _jsxs("div", { style: { marginTop: 18, background: "var(--gold-soft)", border: "2px solid var(--gold)", borderRadius: 10, padding: 16 }, children: [_jsx(FieldLabel, { children: "Root Cause" }), _jsx(TextArea, { rows: 2, disabled: readOnly, value: set.fiveWhys.rootCause, onChange: (e) => setW("rootCause", e.target.value), placeholder: "Final identified root cause...", style: { background: "#fff", fontWeight: 600 } })] })] }));
}
/* --------------------------- Stage: Action Plan --------------------------- */
/** Textarea that grows to fit its content — used wherever full, untruncated text matters. */
function AutoTextArea({ value, style, ...props }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        el.style.height = "auto";
        el.style.height = Math.max(el.scrollHeight, 64) + "px";
    }, [value]);
    return (_jsx("textarea", { ref: ref, value: value, ...props, style: { ...inputStyle, resize: "vertical", overflow: "hidden", minHeight: 64, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", ...(style || {}) } }));
}
function ActionItemCard({ item, index, onUpdate, onRemove, readOnly }) {
    const overdue = item.targetDate && isPastDate(item.targetDate) && !["Completed", "Closed"].includes(item.status);
    return (_jsxs(Card, { style: { padding: 16, borderColor: overdue ? "var(--red)" : "var(--border)", background: overdue ? "var(--red-soft)" : "#fff" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }, children: [_jsxs("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5 }, children: ["Action Item #", index + 1] }), _jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }, children: [_jsx("div", { style: { minWidth: 150 }, children: _jsx(Select, { disabled: readOnly, value: item.status, onChange: (e) => onUpdate({ status: e.target.value }), style: { padding: "6px 9px", fontSize: 12.5 }, children: ACTION_STATUSES.map((s) => _jsx("option", { children: s }, s)) }) }), overdue && _jsx(StatusBadge, { status: "Overdue", size: "sm" }), !readOnly && (_jsx("button", { onClick: onRemove, style: { background: "none", border: "none", cursor: "pointer", color: "var(--red)", display: "flex" }, title: "Remove action item", children: _jsx(Trash2, { size: 15 }) }))] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Corrective Action" }), _jsx(AutoTextArea, { disabled: readOnly, value: item.correctiveAction, onChange: (e) => onUpdate({ correctiveAction: e.target.value }), placeholder: "What was done to correct the immediate issue..." })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Preventive Action" }), _jsx(AutoTextArea, { disabled: readOnly, value: item.preventiveAction, onChange: (e) => onUpdate({ preventiveAction: e.target.value }), placeholder: "What will prevent recurrence..." })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Responsible Person" }), _jsx(TextInput, { disabled: readOnly, value: item.responsiblePerson, onChange: (e) => onUpdate({ responsiblePerson: e.target.value }) })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Target Date" }), _jsx(TextInput, { disabled: readOnly, type: "date", value: item.targetDate, onChange: (e) => onUpdate({ targetDate: e.target.value }) })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Date Completed" }), _jsx(TextInput, { disabled: readOnly, type: "date", value: item.dateCompleted, onChange: (e) => onUpdate({ dateCompleted: e.target.value }) })] })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Verification" }), _jsx(AutoTextArea, { disabled: readOnly, value: item.verification, onChange: (e) => onUpdate({ verification: e.target.value }), placeholder: "Evidence used to verify this action was completed..." })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Remarks" }), _jsx(AutoTextArea, { disabled: readOnly, value: item.remarks, onChange: (e) => onUpdate({ remarks: e.target.value }), placeholder: "Additional notes..." })] })] })] }));
}
function ActionPlanStage({ set, onUpdateSet, readOnly }) {
    const items = set.actionItems;
    const setItems = (next) => onUpdateSet({ ...set, actionItems: next });
    const addItem = () => setItems([...items, { id: uid("act"), correctiveAction: "", preventiveAction: "", responsiblePerson: "", targetDate: "", status: "Not Started", dateCompleted: "", verification: "", remarks: "" }]);
    const updateItem = (idx, patch) => { const n = items.slice(); n[idx] = { ...n[idx], ...patch }; setItems(n); };
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
    return (_jsxs(Card, { style: { padding: 20 }, children: [_jsxs("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginBottom: 4 }, children: ["Improvement Action Plan \u2014 Set ", set.setNumber] }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }, children: "Define corrective and preventive actions that address the identified root cause." }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }, children: [_jsxs("div", { style: { background: "var(--surface-alt)", borderRadius: 8, padding: 12 }, children: [_jsx(FieldLabel, { children: "Issue" }), _jsx("div", { style: { fontSize: 13, whiteSpace: "pre-wrap" }, children: set.issue || "—" })] }), _jsxs("div", { style: { background: "var(--gold-soft)", borderRadius: 8, padding: 12 }, children: [_jsx(FieldLabel, { children: "Root Cause / Finding" }), _jsx("div", { style: { fontSize: 13, whiteSpace: "pre-wrap" }, children: set.fiveWhys.rootCause || "—" })] }), _jsxs("div", { style: { background: "var(--steel-soft)", borderRadius: 8, padding: 12 }, children: [_jsx(FieldLabel, { children: "Vital Cause" }), _jsx("div", { style: { fontSize: 13, whiteSpace: "pre-wrap" }, children: set.vitalCauses.map((v) => v.text).filter(Boolean).join("; ") || "—" })] })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 14 }, children: [items.map((item, idx) => (_jsx(ActionItemCard, { item: item, index: idx, readOnly: readOnly, onUpdate: (patch) => updateItem(idx, patch), onRemove: () => removeItem(idx) }, item.id))), items.length === 0 && _jsx("div", { style: { padding: 20, color: "var(--ink-faint)", fontSize: 13, fontStyle: "italic", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 10 }, children: "No action items yet." })] }), !readOnly && _jsxs(Btn, { size: "sm", variant: "outline", onClick: addItem, style: { marginTop: 14 }, children: [_jsx(Plus, { size: 13 }), " Add Action Item"] })] }));
}
/* --------------------------- Save / Submit footer (single-save workflow) --------------------------- */
function WorkflowSaveBar({ dirty, onSave, onSubmit, justSaved }) {
    return (_jsx(Card, { style: { padding: 18, marginTop: 18, background: "var(--surface-alt)", borderStyle: "dashed" }, children: _jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }, children: [_jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)" }, children: dirty ? (_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 6, color: "var(--orange)", fontWeight: 600 }, children: [_jsx(AlertCircle, { size: 14 }), " You have unsaved changes."] })) : justSaved ? (_jsxs("span", { style: { display: "flex", alignItems: "center", gap: 6, color: "var(--green)", fontWeight: 600 }, children: [_jsx(CircleCheck, { size: 14 }), " CAPA Plan saved."] })) : (_jsx("span", { children: "All CAPA Sets, 6M, Fishbone, 5 Whys and Action Plan data save together." })) }), _jsxs("div", { style: { display: "flex", gap: 10 }, children: [_jsxs(Btn, { variant: "save", onClick: onSave, children: [_jsx(Check, { size: 15 }), " Save CAPA Plan"] }), _jsxs(Btn, { variant: "steel", onClick: onSubmit, children: [_jsx(Send, { size: 15 }), " Submit for QMD Verification"] })] })] }) }));
}
/* --------------------------- Stage: QMD Verification (plan-level) --------------------------- */
function QmdVerificationStage({ plan, onSubmitVerification }) {
    const [v, setV] = useState(plan.verification);
    const setField = (k, val) => setV((prev) => ({ ...prev, [k]: val }));
    const [confirmOpen, setConfirmOpen] = useState(false);
    const locked = plan.stage === "closed";
    const canSubmit = !!v.result && v.verifiedBy.trim();
    return (_jsxs(Card, { style: { padding: 20 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginBottom: 4 }, children: "Effectiveness Verification" }), _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 16 }, children: "Review the complete CAPA Plan across all sets, then record the verification decision." }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }, children: [_jsxs("div", { children: [_jsx(FieldLabel, { children: "Verification Date" }), _jsx(TextInput, { type: "date", disabled: locked, value: v.date, onChange: (e) => setField("date", e.target.value) })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Verified By" }), _jsx(TextInput, { disabled: locked, value: v.verifiedBy, onChange: (e) => setField("verifiedBy", e.target.value) })] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx(FieldLabel, { children: "Evidence / Reference" }), _jsx(TextArea, { rows: 2, disabled: locked, value: v.evidence, onChange: (e) => setField("evidence", e.target.value) })] }), _jsxs("div", { children: [_jsx(FieldLabel, { children: "Result" }), _jsxs(Select, { disabled: locked, value: v.result, onChange: (e) => setField("result", e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Select result \u2014" }), _jsx("option", { children: "Effective" }), _jsx("option", { children: "Partially Effective" }), _jsx("option", { children: "Not Effective" })] })] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx(FieldLabel, { children: "Remarks" }), _jsx(TextArea, { rows: 2, disabled: locked, value: v.remarks, onChange: (e) => setField("remarks", e.target.value) })] })] }), plan.verification.result && (_jsxs("div", { style: { marginTop: 14, fontSize: 13, color: "var(--ink-muted)" }, children: ["Currently recorded result: ", _jsx(StatusBadge, { status: plan.verification.result, size: "sm" })] })), !locked ? (_jsxs(_Fragment, { children: [_jsxs(Btn, { variant: "primary", disabled: !canSubmit, onClick: () => setConfirmOpen(true), style: { marginTop: 18 }, children: [_jsx(Send, { size: 15 }), " Submit Verification"] }), !canSubmit && _jsx("div", { style: { fontSize: 12, color: "var(--ink-faint)", marginTop: 6 }, children: "Select a Result and enter Verified By to submit." })] })) : (_jsxs("div", { style: { marginTop: 16, background: "var(--green-soft)", border: "1px solid var(--green)", borderRadius: 8, padding: 14, display: "flex", gap: 10, alignItems: "center" }, children: [_jsx(CircleCheck, { size: 20, color: "var(--green)" }), _jsx("div", { style: { fontSize: 13.5 }, children: "This CAPA Plan has been marked Effective and is closed." })] })), confirmOpen && (_jsx(ConfirmDialog, { title: "Submit Verification?", message: v.result === "Effective" ? "This will mark the CAPA Plan Effective and Closed. This reflects final QMD sign-off." :
                    v.result === "Partially Effective" ? "This will mark the CAPA Plan Partially Effective and place it under monitoring / follow-up." :
                        "This will mark the CAPA Plan Not Effective and reopen it, returning it to the locale for corrective action.", confirmLabel: "Submit Verification", cancelLabel: "Cancel", danger: v.result === "Not Effective", onCancel: () => setConfirmOpen(false), onConfirm: () => { onSubmitVerification(v); setConfirmOpen(false); } }))] }));
}
/* ------------------------------ Workflow Page ------------------------------ */
function CapaWorkflowPage({ plan, month, onBack, onCommitPlan, onOpenReport, currentUser, initialStage }) {
    const isQmd = currentUser.role === "qmd";
    const isOwner = !isQmd && plan.localeId === currentUser.localeId;
    const editable = isOwner && (plan.stage === "draft" || plan.stage === "reopened");
    const stages = isQmd ? [...STAGES_LOCALE, STAGE_QMD_VERIFY] : STAGES_LOCALE;
    const [stage, setStage] = useState(initialStage || (isQmd ? "verify" : "issue6m"));
    // Local draft copy — locale edits accumulate here until an explicit Save/Submit.
    const [draft, setDraft] = useState(plan);
    const [dirty, setDirty] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [confirmLeaveAction, setConfirmLeaveAction] = useState(null);
    const [confirmSubmit, setConfirmSubmit] = useState(false);
    useEffect(() => { setDraft(plan); setDirty(false); }, [plan.id]); // eslint-disable-line
    useEffect(() => {
        const handler = (e) => { if (dirty) {
            e.preventDefault();
            e.returnValue = "";
        } };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);
    const sets = activeSets(draft);
    const [activeSetId, setActiveSetId] = useState(sets[0] && sets[0].id);
    const [confirmDeleteSet, setConfirmDeleteSet] = useState(null);
    useEffect(() => {
        if (!sets.find((s) => s.id === activeSetId) && sets[0])
            setActiveSetId(sets[0].id);
    }, [draft.id]); // eslint-disable-line
    const activeSet = draft.sets.find((s) => s.id === activeSetId) || sets[0];
    const updateSet = (nextSet) => {
        setDraft((d) => ({ ...d, sets: d.sets.map((s) => (s.id === nextSet.id ? nextSet : s)) }));
        setDirty(true);
        setJustSaved(false);
    };
    const addSet = () => {
        const maxNum = Math.max(0, ...draft.sets.map((s) => s.setNumber));
        const newSet = makeSet(maxNum + 1, draft.capaId);
        setDraft((d) => ({ ...d, sets: [...d.sets, newSet] }));
        setDirty(true);
        setJustSaved(false);
        setActiveSetId(newSet.id);
    };
    const deleteSet = (setId) => {
        setDraft((d) => ({ ...d, sets: d.sets.map((s) => (s.id === setId ? { ...s, archived: true } : s)) }));
        setDirty(true);
        setJustSaved(false);
        setConfirmDeleteSet(null);
        const remaining = draft.sets.filter((s) => !s.archived && s.id !== setId);
        if (remaining[0])
            setActiveSetId(remaining[0].id);
    };
    const doSave = () => {
        onCommitPlan(draft);
        setDirty(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
    };
    const doSubmit = () => {
        const submitted = { ...draft, stage: "submitted", submittedDate: todayStr() };
        onCommitPlan(submitted);
        setDraft(submitted);
        setDirty(false);
        setConfirmSubmit(false);
    };
    const guardedNav = (action) => { if (dirty)
        setConfirmLeaveAction(() => action);
    else
        action(); };
    const onQmdSubmitVerification = (v) => {
        const stageMap = { Effective: "closed", "Partially Effective": "monitoring", "Not Effective": "reopened" };
        const next = { ...draft, verification: { ...v, date: v.date || todayStr() }, stage: stageMap[v.result] };
        onCommitPlan(next);
        setDraft(next);
    };
    if (!activeSet) {
        return (_jsxs("div", { style: { maxWidth: 900, margin: "60px auto", textAlign: "center" }, children: [_jsx("div", { style: { color: "var(--ink-muted)" }, children: "No CAPA Sets found." }), _jsx(Btn, { variant: "outline", onClick: onBack, style: { marginTop: 12 }, children: "Back" })] }));
    }
    const status = planStatus(draft);
    const readOnlySetContent = !editable;
    return (_jsxs("div", { style: { maxWidth: 1240, margin: "0 auto", padding: "24px 24px 60px" }, children: [_jsxs("div", { className: "no-print", style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }, children: [_jsxs("div", { children: [_jsxs("button", { onClick: () => guardedNav(onBack), style: { background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 8 }, children: [_jsx(ArrowLeft, { size: 14 }), " Back"] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [_jsx("span", { className: "capa-tag mono", children: draft.capaId }), _jsx(StatusBadge, { status: status }), _jsxs("span", { style: { fontSize: 12.5, color: "var(--ink-muted)" }, children: [draft.localeId, " \u00B7 ", month ? month.label : "", " \u00B7 ", draft.department] }), readOnlySetContent && !isQmd && _jsxs("span", { style: { fontSize: 12, color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 4 }, children: [_jsx(Lock, { size: 12 }), " Locked \u2014 awaiting/complete QMD review"] }), isQmd && _jsxs("span", { style: { fontSize: 12, color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 4 }, children: [_jsx(Lock, { size: 12 }), " Content read-only (QMD view)"] })] })] }), _jsxs(Btn, { variant: "outline", onClick: () => guardedNav(onOpenReport), children: [_jsx(FileText, { size: 15 }), " View CAPA Report"] })] }), _jsx("div", { style: { marginBottom: 16 }, children: _jsx(ProgressTracker, { plan: draft }) }), _jsx("div", { className: "no-print", style: { marginBottom: 16 }, children: _jsx(StageNav, { stages: stages, activeStage: stage, onSelect: setStage }) }), stage !== "verify" && (_jsx("div", { className: "no-print", style: { marginBottom: 18 }, children: _jsx(SetTabs, { sets: sets, activeSetId: activeSet.id, onSelect: setActiveSetId, onAdd: addSet, onDelete: (id) => setConfirmDeleteSet(id), readOnly: readOnlySetContent }) })), stage === "issue6m" && _jsx(IssueAnd6MStage, { set: activeSet, onUpdateSet: updateSet, readOnly: readOnlySetContent }), stage === "fishbone" && _jsx(FishboneStage, { set: activeSet }), stage === "fivewhys" && _jsx(FiveWhysStage, { set: activeSet, onUpdateSet: updateSet, readOnly: readOnlySetContent }), stage === "action" && _jsx(ActionPlanStage, { set: activeSet, onUpdateSet: updateSet, readOnly: readOnlySetContent }), stage === "verify" && isQmd && _jsx(QmdVerificationStage, { plan: draft, onSubmitVerification: onQmdSubmitVerification }), editable && stage !== "verify" && (_jsx(WorkflowSaveBar, { dirty: dirty, justSaved: justSaved, onSave: doSave, onSubmit: () => setConfirmSubmit(true) })), confirmDeleteSet && (_jsx(ConfirmDialog, { title: `Delete CAPA Set ${draft.sets.find((s) => s.id === confirmDeleteSet)?.setNumber}?`, message: "Deleting this CAPA Set may remove its Issue, Root Cause Analysis, Fishbone, 5 Whys and Action Plan data. The set will be archived and hidden from all workflow views. Remember to click Save CAPA Plan afterward.", onCancel: () => setConfirmDeleteSet(null), onConfirm: () => deleteSet(confirmDeleteSet) })), confirmSubmit && (_jsx(ConfirmDialog, { title: "Submit for QMD Verification?", message: "This will save all current information and lock the CAPA Plan from further editing until QMD completes its verification review.", confirmLabel: "Submit", cancelLabel: "Cancel", danger: false, onCancel: () => setConfirmSubmit(false), onConfirm: doSubmit })), confirmLeaveAction && (_jsx(ConfirmDialog, { title: "Unsaved Changes", message: "You have unsaved changes. Are you sure you want to leave?", confirmLabel: "Leave Without Saving", cancelLabel: "Stay and Continue Editing", danger: true, onCancel: () => setConfirmLeaveAction(null), onConfirm: () => { const action = confirmLeaveAction; setConfirmLeaveAction(null); action(); } }))] }));
}
/* ================================ QMD DASHBOARD ================================ */
const PIE_COLORS = ["#93A1AF", "#3B7CB4", "#D9A02A", "#CC3B3B", "#7A5CC0", "#1E8E52"];
const QMD_TABS = [
    { key: "overview", label: "Overview" },
    { key: "verification", label: "For Verification" },
    { key: "effective", label: "Effective" },
    { key: "partial", label: "Partially Effective" },
    { key: "noteffective", label: "Not Effective" },
];
function ResultListTable({ plans, data, columns, actions, emptyLabel }) {
    const [query, setQuery] = useState("");
    const [localeFilter, setLocaleFilter] = useState("All");
    const filtered = plans.filter((p) => {
        if (localeFilter !== "All" && p.localeId !== localeFilter)
            return false;
        if (query) {
            const q = query.toLowerCase();
            if (!(p.capaId.toLowerCase().includes(q) || p.department.toLowerCase().includes(q) || planRepresentativeIssue(p).toLowerCase().includes(q)))
                return false;
        }
        return true;
    });
    return (_jsxs(Card, { style: { padding: 0, overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }, children: [_jsxs("div", { style: { position: "relative", width: 220 }, children: [_jsx(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: "var(--ink-faint)" } }), _jsx(TextInput, { placeholder: "Search...", value: query, onChange: (e) => setQuery(e.target.value), style: { paddingLeft: 30 } })] }), _jsxs(Select, { value: localeFilter, onChange: (e) => setLocaleFilter(e.target.value), style: { width: 130 }, children: [_jsx("option", { children: "All" }), data.locales.map((l) => _jsx("option", { children: l.id }, l.id))] }), _jsxs("span", { style: { fontSize: 12.5, color: "var(--ink-faint)", marginLeft: "auto" }, children: [filtered.length, " CAPA(s)"] })] }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { background: "var(--surface-alt)" }, children: [columns.map((h) => _jsx("th", { style: { padding: "10px 14px", textAlign: "left", fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }, children: h }, h)), _jsx("th", {})] }) }), _jsxs("tbody", { children: [filtered.map((p) => {
                                    const month = data.months.find((m) => m.id === p.monthId);
                                    return (_jsxs("tr", { style: { borderTop: "1px solid var(--border)" }, children: [_jsx("td", { style: { padding: "10px 14px" }, children: _jsx("span", { className: "mono", style: { fontWeight: 700, fontSize: 12.5 }, children: p.capaId }) }), _jsx("td", { style: { padding: "10px 14px", fontWeight: 700 }, children: p.localeId }), _jsx("td", { style: { padding: "10px 14px" }, children: month ? month.label : "—" }), _jsx("td", { style: { padding: "10px 14px" }, children: p.department }), _jsx("td", { style: { padding: "10px 14px", maxWidth: 260 }, children: planRepresentativeIssue(p) }), _jsx("td", { style: { padding: "10px 14px" }, children: fmtDate(p.verification.date) }), _jsx("td", { style: { padding: "10px 14px" }, children: p.verification.verifiedBy || "—" }), _jsx("td", { style: { padding: "10px 14px" }, children: _jsx(StatusBadge, { status: planStatus(p), size: "sm" }) }), _jsx("td", { style: { padding: "10px 14px" }, children: actions(p) })] }, p.id));
                                }), filtered.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: columns.length + 1, style: { padding: 20, textAlign: "center", color: "var(--ink-faint)" }, children: emptyLabel }) })] })] }) })] }));
}
function QmdDashboard({ data, onOpenPlan, onOpenReport }) {
    const [tab, setTab] = useState("overview");
    const plans = data.plans.filter((p) => !p.archived);
    const [query, setQuery] = useState("");
    const [localeFilter, setLocaleFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const enriched = plans.map((p) => ({ ...p, _status: planStatus(p), _pct: planProgressPct(p), _sets: activeSets(p).length, _month: data.months.find((m) => m.id === p.monthId) }));
    const totals = countByStatus(plans);
    totals.majorFindings = enriched.reduce((a, p) => a + p._sets, 0);
    totals.closed = totals.Effective || 0;
    const forVerification = enriched.filter((p) => p._status === "For QMD Verification");
    const effective = enriched.filter((p) => p._status === "Effective");
    const partial = enriched.filter((p) => p._status === "Partially Effective");
    const notEffective = enriched.filter((p) => p._status === "Not Effective");
    const byLocale = data.locales.map((l) => {
        const lp = enriched.filter((p) => p.localeId === l.id);
        return {
            locale: l.id, plans: lp.length, findings: lp.reduce((a, p) => a + p._sets, 0),
            open: lp.filter((p) => p._status === "Open").length,
            inProgress: lp.filter((p) => p._status === "In Progress").length,
            overdue: lp.filter((p) => p._status === "Overdue").length,
            closed: lp.filter((p) => p._status === "Effective").length,
        };
    });
    const statusPie = ["Open", "In Progress", "For QMD Verification", "Overdue", "Partially Effective", "Effective"]
        .map((s) => ({ name: s, value: enriched.filter((p) => p._status === s).length })).filter((d) => d.value > 0);
    const deptMap = {};
    enriched.forEach((p) => { deptMap[p.department] = (deptMap[p.department] || 0) + 1; });
    const byDept = Object.entries(deptMap).map(([name, value]) => ({ name, value }));
    const filtered = enriched.filter((p) => {
        if (localeFilter !== "All" && p.localeId !== localeFilter)
            return false;
        if (statusFilter !== "All" && p._status !== statusFilter)
            return false;
        if (query) {
            const q = query.toLowerCase();
            if (!(p.capaId.toLowerCase().includes(q) || p.department.toLowerCase().includes(q) || p.preparedBy.toLowerCase().includes(q)))
                return false;
        }
        return true;
    });
    const resultColumns = ["CAPA ID", "Locale", "Month", "Department", "Issue / Finding", "Verification Date", "Verified By", "Status"];
    return (_jsxs("div", { style: { maxWidth: 1320, margin: "0 auto", padding: "28px 24px 60px" }, children: [_jsx("div", { className: "capa-tag", style: { marginBottom: 10 }, children: "MANAGEMENT MASTER DASHBOARD" }), _jsx("div", { className: "disp", style: { fontSize: 32, fontWeight: 700, color: "var(--navy-deep)", marginBottom: 20 }, children: "QMD Overview \u2014 All Locales" }), _jsxs("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }, children: [_jsx(SummaryCard, { label: "Total CAPA", value: totals.total, tone: "ink", icon: ClipboardList }), _jsx(SummaryCard, { label: "For Verification", value: totals["For QMD Verification"] || 0, tone: "gold", icon: ClipboardCheck }), _jsx(SummaryCard, { label: "Effective", value: totals.Effective || 0, tone: "green", icon: CircleCheck }), _jsx(SummaryCard, { label: "Partially Effective", value: totals["Partially Effective"] || 0, tone: "purple", icon: RotateCcw }), _jsx(SummaryCard, { label: "Not Effective", value: totals["Not Effective"] || 0, tone: "red", icon: RefreshCcw }), _jsx(SummaryCard, { label: "Closed", value: totals.closed, tone: "green", icon: CircleCheck })] }), _jsx("div", { className: "no-print", style: { display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, marginBottom: 20, overflowX: "auto" }, children: QMD_TABS.map((t) => (_jsxs("button", { onClick: () => setTab(t.key), style: { border: "none", cursor: "pointer", padding: "9px 16px", borderRadius: 8, whiteSpace: "nowrap", background: tab === t.key ? "var(--navy)" : "transparent", color: tab === t.key ? "#fff" : "var(--ink-muted)", fontWeight: 600, fontSize: 13.5 }, children: [t.label, t.key === "verification" && forVerification.length > 0 && _jsx("span", { style: { marginLeft: 8, background: tab === t.key ? "rgba(255,255,255,0.25)" : "var(--gold-soft)", color: tab === t.key ? "#fff" : "var(--gold)", borderRadius: 999, padding: "1px 7px", fontSize: 11 }, children: forVerification.length })] }, t.key))) }), tab === "verification" && (_jsxs(Card, { style: { padding: 0, overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "16px 18px", borderBottom: "1px solid var(--border)", background: "var(--gold-soft)" }, className: "disp", children: [_jsx("span", { style: { fontWeight: 700, fontSize: 16 }, children: "CAPAs for Verification" }), _jsxs("span", { style: { marginLeft: 10, fontSize: 12.5, fontWeight: 600, color: "var(--gold)" }, children: [forVerification.length, " awaiting QMD review"] })] }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: "var(--surface-alt)" }, children: ["CAPA ID", "Locale", "Month", "Department", "No. of Findings", "Submitted Date", "Status", ""].map((h) => (_jsx("th", { style: { padding: "10px 14px", textAlign: "left", fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }, children: h }, h))) }) }), _jsxs("tbody", { children: [forVerification.map((p) => (_jsxs("tr", { style: { borderTop: "1px solid var(--border)" }, children: [_jsx("td", { style: { padding: "10px 14px" }, children: _jsx("span", { className: "mono", style: { fontWeight: 700, fontSize: 12.5 }, children: p.capaId }) }), _jsx("td", { style: { padding: "10px 14px", fontWeight: 700 }, children: p.localeId }), _jsx("td", { style: { padding: "10px 14px" }, children: p._month ? p._month.label : "—" }), _jsx("td", { style: { padding: "10px 14px" }, children: p.department }), _jsx("td", { style: { padding: "10px 14px" }, children: p._sets }), _jsx("td", { style: { padding: "10px 14px" }, children: fmtDate(p.submittedDate) }), _jsx("td", { style: { padding: "10px 14px" }, children: _jsx(StatusBadge, { status: p._status, size: "sm" }) }), _jsx("td", { style: { padding: "10px 14px" }, children: _jsxs(Btn, { size: "sm", onClick: () => onOpenPlan(p.id, "verify"), children: [_jsx(ClipboardCheck, { size: 13 }), " Review / Verify"] }) })] }, p.id))), forVerification.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 8, style: { padding: 20, textAlign: "center", color: "var(--ink-faint)" }, children: "Nothing awaiting verification right now." }) })] })] }) })] })), tab === "effective" && (_jsx(ResultListTable, { plans: effective, data: data, columns: resultColumns, emptyLabel: "No CAPAs marked Effective yet.", actions: (p) => (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx(Btn, { size: "sm", variant: "outline", onClick: () => onOpenPlan(p.id, "verify"), children: "View CAPA" }), _jsx(Btn, { size: "sm", variant: "ghost", onClick: () => onOpenReport(p.id), title: "Report", children: _jsx(FileText, { size: 14 }) })] })) })), tab === "partial" && (_jsx(ResultListTable, { plans: partial, data: data, columns: resultColumns, emptyLabel: "No CAPAs marked Partially Effective yet.", actions: (p) => (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx(Btn, { size: "sm", variant: "outline", onClick: () => onOpenPlan(p.id, "verify"), children: "View CAPA" }), _jsx(Btn, { size: "sm", variant: "ghost", onClick: () => onOpenReport(p.id), title: "Report", children: _jsx(FileText, { size: 14 }) })] })) })), tab === "noteffective" && (_jsx(ResultListTable, { plans: notEffective, data: data, columns: resultColumns, emptyLabel: "No CAPAs marked Not Effective.", actions: (p) => (_jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsxs(Btn, { size: "sm", variant: "danger", onClick: () => onOpenPlan(p.id, "verify"), children: [_jsx(RefreshCcw, { size: 13 }), " Reopen CAPA"] }), _jsx(Btn, { size: "sm", variant: "ghost", onClick: () => onOpenReport(p.id), title: "Report", children: _jsx(FileText, { size: 14 }) })] })) })), tab === "overview" && (_jsxs(_Fragment, { children: [_jsxs(Card, { style: { padding: 0, marginBottom: 18, overflow: "hidden" }, children: [_jsx("div", { style: { padding: "16px 18px", borderBottom: "1px solid var(--border)" }, className: "disp", children: _jsx("span", { style: { fontWeight: 700, fontSize: 16 }, children: "CAPA Status by Locale" }) }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: "var(--surface-alt)" }, children: ["Locale", "CAPA Plans", "Major Findings", "Open", "In Progress", "Overdue", "Effective"].map((h) => (_jsx("th", { style: { padding: "10px 14px", textAlign: h === "Locale" ? "left" : "right", fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }, children: h }, h))) }) }), _jsx("tbody", { children: byLocale.map((l) => (_jsxs("tr", { style: { borderTop: "1px solid var(--border)" }, children: [_jsx("td", { style: { padding: "10px 14px", fontWeight: 700 }, children: l.locale }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right" }, children: l.plans }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right" }, children: l.findings }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right" }, children: l.open }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right" }, children: l.inProgress }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right", color: l.overdue > 0 ? "var(--red)" : "inherit", fontWeight: l.overdue > 0 ? 700 : 400 }, children: l.overdue }), _jsx("td", { style: { padding: "10px 14px", textAlign: "right", color: "var(--green)", fontWeight: 700 }, children: l.closed })] }, l.locale))) })] }) })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 18 }, children: [_jsxs(Card, { style: { padding: 16, height: 260 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5, marginBottom: 8 }, children: "CAPAs by Locale" }), _jsx(ResponsiveContainer, { width: "100%", height: "88%", children: _jsxs(BarChart, { data: byLocale, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#E9EEF2" }), _jsx(XAxis, { dataKey: "locale", fontSize: 11, interval: 0, angle: -20, textAnchor: "end", height: 40 }), _jsx(YAxis, { fontSize: 12, allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "plans", fill: "#3B7CB4", radius: [4, 4, 0, 0] })] }) })] }), _jsxs(Card, { style: { padding: 16, height: 260 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5, marginBottom: 8 }, children: "CAPAs by Status" }), _jsx(ResponsiveContainer, { width: "100%", height: "88%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: statusPie, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 72, label: (e) => e.name, children: statusPie.map((_, i) => _jsx(Cell, { fill: PIE_COLORS[i % PIE_COLORS.length] }, i)) }), _jsx(Tooltip, {})] }) })] }), _jsxs(Card, { style: { padding: 16, height: 260 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5, marginBottom: 8 }, children: "Major Findings by Locale" }), _jsx(ResponsiveContainer, { width: "100%", height: "88%", children: _jsxs(BarChart, { data: byLocale, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#E9EEF2" }), _jsx(XAxis, { dataKey: "locale", fontSize: 11, interval: 0, angle: -20, textAnchor: "end", height: 40 }), _jsx(YAxis, { fontSize: 12, allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "findings", fill: "#D9A02A", radius: [4, 4, 0, 0] })] }) })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }, children: [_jsxs(Card, { style: { padding: 16, height: 240 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5, marginBottom: 8 }, children: "Overdue CAPAs by Locale" }), _jsx(ResponsiveContainer, { width: "100%", height: "88%", children: _jsxs(BarChart, { data: byLocale, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#E9EEF2" }), _jsx(XAxis, { dataKey: "locale", fontSize: 11, interval: 0, angle: -20, textAnchor: "end", height: 40 }), _jsx(YAxis, { fontSize: 12, allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "overdue", fill: "#CC3B3B", radius: [4, 4, 0, 0] })] }) })] }), _jsxs(Card, { style: { padding: 16, height: 240 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 13.5, marginBottom: 8 }, children: "CAPAs by Department" }), _jsx(ResponsiveContainer, { width: "100%", height: "88%", children: _jsxs(BarChart, { data: byDept, layout: "vertical", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#E9EEF2" }), _jsx(XAxis, { type: "number", fontSize: 12, allowDecimals: false }), _jsx(YAxis, { type: "category", dataKey: "name", width: 80, fontSize: 12 }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "value", fill: "#1B3A5C", radius: [0, 4, 4, 0] })] }) })] })] }), _jsxs(Card, { style: { padding: 0, overflow: "hidden" }, children: [_jsxs("div", { style: { padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginRight: "auto" }, children: "All CAPA Plans" }), _jsxs("div", { style: { position: "relative", width: 220 }, children: [_jsx(Search, { size: 14, style: { position: "absolute", left: 10, top: 10, color: "var(--ink-faint)" } }), _jsx(TextInput, { placeholder: "Search...", value: query, onChange: (e) => setQuery(e.target.value), style: { paddingLeft: 30 } })] }), _jsxs(Select, { value: localeFilter, onChange: (e) => setLocaleFilter(e.target.value), style: { width: 120 }, children: [_jsx("option", { children: "All" }), data.locales.map((l) => _jsx("option", { children: l.id }, l.id))] }), _jsxs(Select, { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), style: { width: 190 }, children: [_jsx("option", { children: "All" }), ["Open", "In Progress", "For QMD Verification", "Overdue", "Effective", "Partially Effective", "Not Effective"].map((s) => _jsx("option", { children: s }, s))] })] }), _jsx("div", { style: { overflowX: "auto" }, children: _jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: "var(--surface-alt)" }, children: ["CAPA ID", "Locale", "Month", "Department", "Status", "Completion", "Action"].map((h) => (_jsx("th", { style: { padding: "10px 14px", textAlign: "left", fontSize: 12, color: "var(--ink-muted)", textTransform: "uppercase" }, children: h }, h))) }) }), _jsxs("tbody", { children: [filtered.map((p) => (_jsxs("tr", { style: { borderTop: "1px solid var(--border)" }, children: [_jsx("td", { style: { padding: "10px 14px" }, children: _jsx("span", { className: "mono", style: { fontWeight: 700, fontSize: 12.5 }, children: p.capaId }) }), _jsx("td", { style: { padding: "10px 14px", fontWeight: 700 }, children: p.localeId }), _jsx("td", { style: { padding: "10px 14px", color: "var(--ink-muted)" }, children: p._month ? p._month.label : "—" }), _jsx("td", { style: { padding: "10px 14px", color: "var(--ink-muted)" }, children: p.department }), _jsx("td", { style: { padding: "10px 14px" }, children: _jsx(StatusBadge, { status: p._status, size: "sm" }) }), _jsxs("td", { style: { padding: "10px 14px" }, children: [p._pct, "%"] }), _jsx("td", { style: { padding: "10px 14px" }, children: _jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx(Btn, { size: "sm", variant: "outline", onClick: () => onOpenPlan(p.id), children: "View" }), _jsx(Btn, { size: "sm", variant: "ghost", onClick: () => onOpenReport(p.id), title: "Report", children: _jsx(FileText, { size: 14 }) })] }) })] }, p.id))), filtered.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 7, style: { padding: 24, textAlign: "center", color: "var(--ink-faint)" }, children: "No matching CAPA plans." }) })] })] }) })] })] }))] }));
}
/* ================================ CAPA REPORT ================================ */
function CapaReportPage({ plan, month, onBack }) {
    const sets = activeSets(plan);
    const status = planStatus(plan);
    return (_jsxs("div", { style: { maxWidth: 980, margin: "0 auto", padding: "24px 24px 80px" }, children: [_jsxs("div", { className: "no-print", style: { display: "flex", justifyContent: "space-between", marginBottom: 16 }, children: [_jsxs("button", { onClick: onBack, style: { background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }, children: [_jsx(ArrowLeft, { size: 14 }), " Back"] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsxs(Btn, { variant: "outline", onClick: () => window.print(), children: [_jsx(Printer, { size: 15 }), " Print Report"] }), _jsxs(Btn, { onClick: () => window.print(), children: [_jsx(FileText, { size: 15 }), " Export PDF"] })] })] }), _jsxs(Card, { className: "print-page", style: { padding: 32 }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: 24, borderBottom: "2px solid var(--navy)", paddingBottom: 18 }, children: [_jsx("div", { className: "capa-tag", children: "CAPA REPORT \u2014 QMD RECORD" }), _jsx("div", { className: "disp", style: { fontSize: 26, fontWeight: 700, marginTop: 10 }, children: plan.capaId }), _jsxs("div", { style: { fontSize: 13, color: "var(--ink-muted)" }, children: [plan.localeId, " \u00B7 ", month ? month.label : "—", " \u00B7 ", plan.department] }), _jsx("div", { style: { marginTop: 8 }, children: _jsx(StatusBadge, { status: status }) })] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24, fontSize: 13 }, children: [
                            ["Locale", plan.localeId], ["Month", month ? month.label : "—"], ["Department", plan.department],
                            ["Date Created", fmtDate(plan.dateCreated)], ["Source of Finding", plan.source], ["Prepared By", plan.preparedBy],
                            ["Submitted Date", fmtDate(plan.submittedDate)], ["Status", status], ["No. of CAPA Sets", sets.length],
                        ].map(([k, v]) => (_jsxs("div", { children: [_jsx("div", { style: { color: "var(--ink-faint)", fontSize: 11, textTransform: "uppercase" }, children: k }), _jsx("div", { style: { fontWeight: 600 }, children: v })] }, k))) }), sets.map((s) => (_jsxs("div", { style: { marginBottom: 30, pageBreakInside: "avoid", borderTop: "1px solid var(--border)", paddingTop: 18 }, children: [_jsx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: _jsxs("div", { className: "disp", style: { fontWeight: 700, fontSize: 16 }, children: ["CAPA Set ", s.setNumber, " ", _jsxs("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-faint)" }, children: ["(", s.setCode, ")"] })] }) }), _jsxs("div", { style: { background: "var(--rose-soft)", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13.5 }, children: [_jsx("strong", { children: "Issue / Finding:" }), " ", s.issue || "—"] }), _jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { fontWeight: 700, fontSize: 12.5, marginBottom: 6 }, children: "6M Root Cause Analysis" }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12.5 }, children: CATEGORIES.map((c) => (_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, color: "var(--ink-muted)" }, children: CATEGORY_LABELS[c] }), s.sixM[c].filter((x) => x.text).length === 0 ? _jsx("div", { style: { color: "var(--ink-faint)" }, children: "\u2014" }) :
                                                    s.sixM[c].filter((x) => x.text).map((x, i) => _jsxs("div", { children: [i + 1, ". ", x.text] }, x.id))] }, c))) })] }), _jsxs("div", { style: { marginBottom: 10, background: "var(--gold-soft)", borderRadius: 8, padding: 10, fontSize: 13 }, children: [_jsx("strong", { children: "Vital / Affinitized Causes:" }), " ", s.vitalCauses.map((v) => v.text).filter(Boolean).join("; ") || "—"] }), _jsxs("div", { style: { marginBottom: 10, fontSize: 13 }, children: [_jsx("div", { style: { fontWeight: 700, fontSize: 12.5, marginBottom: 4 }, children: "5 Whys" }), [1, 2, 3, 4, 5].map((n) => (s.fiveWhys[`why${n}`] ? _jsxs("div", { children: ["Why ", n, ": ", s.fiveWhys[`why${n}`]] }, n) : null)), _jsxs("div", { style: { fontWeight: 700, marginTop: 4 }, children: ["Root Cause: ", s.fiveWhys.rootCause || "—"] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, fontSize: 12.5, marginBottom: 6 }, children: "Improvement Action Plan" }), s.actionItems.length === 0 ? _jsx("div", { style: { fontSize: 12.5, color: "var(--ink-faint)" }, children: "No action items." }) : (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11.5 }, children: [_jsx("thead", { children: _jsx("tr", { style: { background: "var(--surface-alt)" }, children: ["Corrective", "Preventive", "Responsible", "Target", "Status"].map((h) => _jsx("th", { style: { padding: "5px 7px", textAlign: "left" }, children: h }, h)) }) }), _jsx("tbody", { children: s.actionItems.map((a) => (_jsxs("tr", { style: { borderTop: "1px solid var(--border)" }, children: [_jsx("td", { style: { padding: "5px 7px" }, children: a.correctiveAction }), _jsx("td", { style: { padding: "5px 7px" }, children: a.preventiveAction }), _jsx("td", { style: { padding: "5px 7px" }, children: a.responsiblePerson }), _jsx("td", { style: { padding: "5px 7px" }, children: fmtDate(a.targetDate) }), _jsx("td", { style: { padding: "5px 7px" }, children: a.status })] }, a.id))) })] }))] })] }, s.id))), _jsxs("div", { style: { borderTop: "2px solid var(--navy)", paddingTop: 18, marginTop: 10 }, children: [_jsx("div", { className: "disp", style: { fontWeight: 700, fontSize: 16, marginBottom: 8 }, children: "QMD Verification" }), plan.verification.result ? (_jsxs("div", { style: { fontSize: 13.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Verification Date:" }), " ", fmtDate(plan.verification.date)] }), _jsxs("div", { children: [_jsx("strong", { children: "Verified By:" }), " ", plan.verification.verifiedBy || "—"] }), _jsxs("div", { children: [_jsx("strong", { children: "Result:" }), " ", plan.verification.result] }), _jsxs("div", { children: [_jsx("strong", { children: "Final CAPA Status:" }), " ", status] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("strong", { children: "Evidence / Reference:" }), " ", plan.verification.evidence || "—"] }), _jsxs("div", { style: { gridColumn: "1 / -1" }, children: [_jsx("strong", { children: "Remarks:" }), " ", plan.verification.remarks || "—"] })] })) : _jsx("div", { style: { fontSize: 13.5, color: "var(--ink-faint)" }, children: "Not yet reviewed by QMD." })] })] })] }));
}
/* =================================== APP ROOT =================================== */
export default function App() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [nav, setNav] = useState({ view: "login" });
    const [createMonthModal, setCreateMonthModal] = useState(false);
    const [createPlanCtx, setCreatePlanCtx] = useState(null); // { monthId, department }
    const saveTimer = useRef(null);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await storage.get(STORAGE_KEY, true);
            if (res && res.value)
                setData(JSON.parse(res.value));
            else {
                const seed = makeSeedData();
                setData(seed);
                await storage.set(STORAGE_KEY, JSON.stringify(seed), true);
            }
        }
        catch (e) {
            const seed = makeSeedData();
            setData(seed);
            try {
                await storage.set(STORAGE_KEY, JSON.stringify(seed), true);
            }
            catch (e2) { /* ignore */ }
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    // QMD security guard: any attempt to land on a QMD-only view without an
    // authenticated QMD session is bounced straight to the QMD login screen —
    // this runs on every nav/currentUser change, not just at the point of the
    // click, so it also covers state restored from a stale/forged nav object.
    useEffect(() => {
        const qmdOnlyViews = ["qmd"];
        const isQmdOnlyWorkflow = nav.view === "workflow" && nav.initialStage === "verify";
        if ((qmdOnlyViews.includes(nav.view) || isQmdOnlyWorkflow) && (!currentUser || currentUser.role !== "qmd")) {
            setNav({ view: "qmdLogin" });
        }
    }, [nav, currentUser]);
    const persist = useCallback((next) => {
        setData(next);
        if (saveTimer.current)
            clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await storage.set(STORAGE_KEY, JSON.stringify(next), true);
            }
            catch (e) { /* ignore */ }
        }, 250);
    }, []);
    const resetDemo = () => persist(makeSeedData());
    if (loading || !data) {
        return (_jsxs("div", { className: "capa-root", children: [_jsx(GlobalStyle, {}), _jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)" }, children: "Loading CAPA Management System\u2026" })] }));
    }
    const commitPlan = (nextPlan) => persist({ ...data, plans: data.plans.map((p) => (p.id === nextPlan.id ? nextPlan : p)) });
    const handleLogin = (user) => { setCurrentUser(user); setNav(user.role === "qmd" ? { view: "qmd" } : { view: "locale" }); };
    const handleLogout = () => { setCurrentUser(null); setNav({ view: "login" }); };
    const openMonth = (monthId) => setNav({ view: "month", monthId, from: "locale" });
    const openPlan = (planId, initialStage, from) => setNav((n) => ({ view: "workflow", planId, initialStage, from: from || n.view }));
    const openReport = (planId, from) => setNav((n) => ({ view: "report", planId, from: from || n.view }));
    const backFromMonth = () => setNav({ view: "locale" });
    const backFromWorkflow = () => {
        const plan = data.plans.find((p) => p.id === nav.planId);
        if (nav.from === "qmd" || currentUser.role === "qmd")
            setNav({ view: "qmd" });
        else
            setNav({ view: "month", monthId: plan ? plan.monthId : null });
    };
    const backFromReport = () => {
        if (nav.from === "workflow" || nav.from === "qmd" || nav.from === "month")
            setNav({ view: nav.from === "workflow" ? "qmd" : nav.from });
        else
            setNav({ view: currentUser.role === "qmd" ? "qmd" : "locale" });
    };
    const createMonth = ({ year, monthNum }) => {
        const m = { id: uid("month"), localeId: currentUser.localeId, year, monthNum, label: `${MONTH_NAMES[monthNum - 1]} ${year}` };
        persist({ ...data, months: [...data.months, m] });
        setCreateMonthModal(false);
        setNav({ view: "month", monthId: m.id });
    };
    const createPlan = (form) => {
        const { monthId, department } = createPlanCtx;
        const month = data.months.find((m) => m.id === monthId);
        const capaId = nextCapaId(data.plans, currentUser.localeId, month.year, month.monthNum);
        const plan = {
            id: uid("plan"), capaId, localeId: currentUser.localeId, monthId, year: month.year, monthNum: month.monthNum,
            department, dateCreated: form.dateCreated, source: form.source, preparedBy: form.preparedBy,
            stage: "draft", submittedDate: "",
            verification: { date: "", verifiedBy: "", evidence: "", result: "", remarks: "" },
            archived: false, sets: buildDefaultSets(capaId, 1),
        };
        persist({ ...data, plans: [...data.plans, plan] });
        setCreatePlanCtx(null);
        openPlan(plan.id, "issue6m", "month");
    };
    const currentPlan = nav.planId ? data.plans.find((p) => p.id === nav.planId) : null;
    const currentMonth = nav.monthId ? data.months.find((m) => m.id === nav.monthId) : (currentPlan ? data.months.find((m) => m.id === currentPlan.monthId) : null);
    const canAccessPlan = currentPlan && (currentUser && (currentUser.role === "qmd" || currentPlan.localeId === currentUser.localeId));
    let breadcrumbs = [];
    if (currentUser) {
        if (nav.view === "locale")
            breadcrumbs = [`${currentUser.localeId} Dashboard`];
        if (nav.view === "month" && currentMonth)
            breadcrumbs = [currentMonth.localeId, currentMonth.label];
        if (nav.view === "qmd")
            breadcrumbs = ["Management Dashboard"];
        if (nav.view === "workflow" && currentPlan)
            breadcrumbs = [currentPlan.localeId, currentMonth ? currentMonth.label : "", currentPlan.department, currentPlan.capaId];
        if (nav.view === "report" && currentPlan)
            breadcrumbs = [currentPlan.capaId, "Report"];
    }
    return (_jsxs("div", { className: "capa-root", children: [_jsx(GlobalStyle, {}), nav.view === "login" && (_jsx(LoginScreen, { locales: data.locales, onLogin: handleLogin, onGoQmdLogin: () => setNav({ view: "qmdLogin" }), onResetDemo: resetDemo })), nav.view === "qmdLogin" && (_jsx(QmdLoginScreen, { onSubmit: () => handleLogin({ role: "qmd" }), onBack: () => setNav({ view: "login" }) })), currentUser && nav.view !== "login" && nav.view !== "qmdLogin" && (_jsxs(_Fragment, { children: [_jsx(TopBar, { currentUser: currentUser, onLogout: handleLogout, breadcrumbs: breadcrumbs.filter(Boolean) }), nav.view === "locale" && (_jsx(LocaleDashboard, { data: data, localeId: currentUser.localeId, onOpenMonth: openMonth, onCreateMonth: () => setCreateMonthModal(true) })), nav.view === "month" && currentMonth && (currentUser.role === "qmd" || currentMonth.localeId === currentUser.localeId ? (_jsx(MonthDashboard, { data: data, month: currentMonth, onBack: backFromMonth, onOpenPlan: (id) => openPlan(id, "issue6m", "month"), onCreatePlan: (dept) => setCreatePlanCtx({ monthId: currentMonth.id, department: dept }) })) : (_jsx(AccessDenied, { message: `${currentMonth.localeId} is not your locale. You can only view and manage CAPAs for your own locale.`, onGoHome: () => setNav({ view: "locale" }) }))), nav.view === "qmd" && currentUser.role === "qmd" && (_jsx(QmdDashboard, { data: data, onOpenPlan: (id, stage) => openPlan(id, stage, "qmd"), onOpenReport: (id) => openReport(id, "qmd") })), nav.view === "workflow" && currentPlan && (canAccessPlan ? (_jsx(CapaWorkflowPage, { plan: currentPlan, month: currentMonth, onBack: backFromWorkflow, onCommitPlan: commitPlan, onOpenReport: () => openReport(currentPlan.id, "workflow"), currentUser: currentUser, initialStage: nav.initialStage })) : (_jsx(AccessDenied, { message: `This CAPA belongs to ${currentPlan.localeId}. You can only view and manage CAPAs for your own locale.`, onGoHome: () => setNav({ view: currentUser.role === "qmd" ? "qmd" : "locale" }) }))), nav.view === "report" && currentPlan && (canAccessPlan ? (_jsx(CapaReportPage, { plan: currentPlan, month: currentMonth, onBack: backFromReport })) : (_jsx(AccessDenied, { message: `This CAPA belongs to ${currentPlan.localeId}. You can only view reports for your own locale.`, onGoHome: () => setNav({ view: currentUser.role === "qmd" ? "qmd" : "locale" }) }))), createMonthModal && (_jsx(CreateMonthModal, { localeId: currentUser.localeId, existingMonths: data.months.filter((m) => m.localeId === currentUser.localeId), onClose: () => setCreateMonthModal(false), onCreate: createMonth })), createPlanCtx && (_jsx(CreateCapaModal, { localeId: currentUser.localeId, month: data.months.find((m) => m.id === createPlanCtx.monthId), department: createPlanCtx.department, plans: data.plans, onClose: () => setCreatePlanCtx(null), onCreate: createPlan }))] }))] }));
}
/* ---------------------------------- mount ---------------------------------- */
import { createRoot } from "react-dom/client";
const rootEl = document.getElementById("root");
createRoot(rootEl).render(_jsx(App, {}));
