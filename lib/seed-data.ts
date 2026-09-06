/* ---------------------------------------------------------------------------
   Demo / seed data — ported from the original app.js makeSeedData()
   (_legacy/app.js lines ~161-303). Produces the same in-memory shape the app
   uses ({ locales, months, plans }); the seed script and any future
   "reset demo data" action translate this into DB rows.
--------------------------------------------------------------------------- */
import {
  LOCALES,
  MONTH_NAMES,
  buildDefaultSets,
  makeSet,
  nextCapaId,
  uid,
} from "./capa-logic";
import type { AppData, CapaPlan, Month } from "./capa-types";

const EMPTY_VERIFICATION = {
  date: "",
  verifiedBy: "",
  evidence: "",
  result: "",
  remarks: "",
};

export function makeSeedData(): AppData {
  const months: Month[] = [];
  const plans: CapaPlan[] = [];

  function addMonth(localeId: string, year: number, monthNum: number): Month {
    const existing = months.find(
      (m) => m.localeId === localeId && m.year === year && m.monthNum === monthNum,
    );
    if (existing) return existing;
    const m: Month = {
      id: uid("month"),
      localeId,
      year,
      monthNum,
      label: `${MONTH_NAMES[monthNum - 1]} ${year}`,
    };
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
    sets[0].sixM.METHOD = [
      { id: uid("c"), text: "No standardized inspection procedure" },
    ];
    sets[0].sixM.MACHINE = [
      { id: uid("c"), text: "No monitoring device / reminder system" },
    ];
    sets[0].sixM.MEASUREMENT = [
      { id: uid("c"), text: "No tagging system to flag near-expiry units" },
    ];
    sets[0].sixM.MATERIALS = [
      { id: uid("c"), text: "Fire extinguisher refill stock not tracked" },
    ];
    sets[0].sixM.MOTHER_NATURE = [
      { id: uid("c"), text: "Storage area heat exposure accelerates wear" },
    ];
    sets[0].vitalCauses = [
      {
        id: uid("vc"),
        text: "No preventive maintenance schedule for fire safety equipment",
      },
      { id: uid("vc"), text: "No standardized inspection / tagging procedure" },
    ];
    sets[0].fiveWhys = {
      why1: "The fire extinguisher was expired.",
      why2: "Because no one flagged it before the expiry date.",
      why3: "Because there is no tagging system for near-expiry units.",
      why4: "Because inspection rounds are not standardized or scheduled.",
      why5:
        "Because there is no preventive maintenance program for fire safety equipment.",
      rootCause:
        "Absence of a preventive maintenance and inspection schedule for fire safety equipment.",
    };
    sets[0].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction:
          "Replace all expired fire extinguishers in Rooms department.",
        preventiveAction:
          "Implement a color-coded tagging system with quarterly inspection schedule.",
        responsiblePerson: "J. Santos",
        targetDate: "2026-08-20",
        status: "Completed",
        dateCompleted: "2026-08-15",
        verification: "Physical inspection log",
        remarks: "Completed ahead of schedule.",
      },
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Post inspection tags on every unit.",
        preventiveAction: "Assign monthly checklist owner per floor.",
        responsiblePerson: "M. Cruz",
        targetDate: "2026-08-25",
        status: "Completed",
        dateCompleted: "2026-08-22",
        verification: "Audit checklist",
        remarks: "",
      },
    ];
    sets[1].issue =
      "Housekeeping trolley left unattended with chemical spray exposed.";
    sets[1].sixM.METHOD = [
      { id: uid("c"), text: "No lock-verification step for trolleys" },
    ];
    sets[1].vitalCauses = [
      {
        id: uid("vc"),
        text: "Closing procedure does not include trolley lock-verification",
      },
    ];
    sets[1].fiveWhys = {
      why1: "Trolley was left unattended.",
      why2: "Because staff was called away mid-task.",
      why3: "Because there is no buddy-check protocol.",
      why4: "",
      why5: "",
      rootCause: "No buddy-check protocol for unattended trolleys.",
    };
    sets[1].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Secure trolley and retrain staff.",
        preventiveAction:
          "Introduce buddy-check protocol for housekeeping rounds.",
        responsiblePerson: "A. Reyes",
        targetDate: "2026-08-28",
        status: "Completed",
        dateCompleted: "2026-08-27",
        verification: "Training log",
        remarks: "",
      },
    ];
    sets[2].issue = "Guest room smoke detector battery found dead.";
    sets[2].sixM.MACHINE = [
      { id: uid("c"), text: "No battery replacement schedule" },
    ];
    sets[2].vitalCauses = [
      {
        id: uid("vc"),
        text: "No preventive battery-replacement schedule for detectors",
      },
    ];
    sets[2].fiveWhys = {
      why1: "Detector battery was dead.",
      why2: "Because batteries are replaced reactively.",
      why3: "Because there is no PM schedule.",
      why4: "",
      why5: "",
      rootCause:
        "No preventive maintenance schedule for smoke detector batteries.",
    };
    sets[2].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Replace all flagged batteries.",
        preventiveAction: "Add quarterly battery check to PM calendar.",
        responsiblePerson: "L. Tan",
        targetDate: "2026-08-30",
        status: "Completed",
        dateCompleted: "2026-08-29",
        verification: "PM checklist",
        remarks: "",
      },
    ];
    sets[3].issue = "Linen storage room found with inadequate ventilation.";
    sets[4].issue = "Guest complaint log missing follow-up notes for 3 entries.";
    sets[4].sixM.METHOD = [
      { id: uid("c"), text: "No mandatory follow-up field in complaint log" },
    ];
    sets[4].vitalCauses = [
      {
        id: uid("vc"),
        text: "Complaint log template has no mandatory follow-up field",
      },
    ];
    sets[4].fiveWhys = {
      why1: "Follow-up notes were missing.",
      why2: "Because the log template does not require them.",
      why3: "Because the template was never updated.",
      why4: "",
      why5: "",
      rootCause: "Complaint log template lacks a mandatory follow-up field.",
    };
    sets[4].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Back-fill missing follow-up notes.",
        preventiveAction: "Update complaint log template with mandatory field.",
        responsiblePerson: "M. Cruz",
        targetDate: "2026-08-31",
        status: "Completed",
        dateCompleted: "2026-08-30",
        verification: "Updated template",
        remarks: "",
      },
    ];
    sets[5].issue = "Expired amenities found in Building 2 guest rooms.";
    sets[6].issue =
      "Emergency exit signage not illuminated during power interruption test.";
    sets[7].issue =
      "Contractor badge access not deactivated after contract end date.";
    plans.push({
      id: uid("plan"),
      capaId,
      localeId: "VCHI",
      monthId: vchiAug.id,
      year: 2026,
      monthNum: 8,
      department: "Rooms",
      dateCreated: "2026-08-02",
      source: "Internal Audit",
      preparedBy: "J. Santos",
      stage: "submitted",
      submittedDate: "2026-08-31",
      verification: { ...EMPTY_VERIFICATION },
      archived: false,
      sets,
    });
  }

  /* ---- VCHI / Aug 2026 / Service — draft, in progress, only 2 sets ---- */
  {
    const capaId = nextCapaId(plans, "VCHI", 2026, 8);
    const sets = buildDefaultSets(capaId, 1);
    sets.push(makeSet(2, capaId));
    sets[0].issue = "Room service order delivered 25 minutes past SLA.";
    sets[0].sixM.METHOD = [
      {
        id: uid("c"),
        text: "No real-time order tracking between kitchen and floor",
      },
    ];
    sets[1].issue = "Minibar restocking checklist not signed off.";
    plans.push({
      id: uid("plan"),
      capaId,
      localeId: "VCHI",
      monthId: vchiAug.id,
      year: 2026,
      monthNum: 8,
      department: "Service",
      dateCreated: "2026-08-05",
      source: "Customer Complaint",
      preparedBy: "A. Reyes",
      stage: "draft",
      submittedDate: "",
      verification: { ...EMPTY_VERIFICATION },
      archived: false,
      sets,
    });
  }

  /* ---- VCHI / Aug 2026 / LMT — already Effective (closed), single set ---- */
  {
    const capaId = nextCapaId(plans, "VCHI", 2026, 8);
    const sets = buildDefaultSets(capaId, 1);
    sets[0].issue = "Elevator maintenance log had a 2-week gap.";
    sets[0].sixM.METHOD = [
      { id: uid("c"), text: "No escalation when PM log is not updated" },
    ];
    sets[0].vitalCauses = [
      { id: uid("vc"), text: "No escalation trigger for overdue PM log entries" },
    ];
    sets[0].fiveWhys = {
      why1: "PM log had a gap.",
      why2: "Because the technician was on leave with no backup.",
      why3: "Because there is no backup assignment process.",
      why4: "",
      why5: "",
      rootCause:
        "No backup assignment process for PM logging during technician leave.",
    };
    sets[0].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Back-fill PM log with retroactive inspection.",
        preventiveAction: "Assign backup technician for PM logging.",
        responsiblePerson: "K. Fernandez",
        targetDate: "2026-08-10",
        status: "Completed",
        dateCompleted: "2026-08-09",
        verification: "PM log",
        remarks: "",
      },
    ];
    plans.push({
      id: uid("plan"),
      capaId,
      localeId: "VCHI",
      monthId: vchiAug.id,
      year: 2026,
      monthNum: 8,
      department: "LMT",
      dateCreated: "2026-08-01",
      source: "Internal Audit",
      preparedBy: "K. Fernandez",
      stage: "closed",
      submittedDate: "2026-08-12",
      verification: {
        date: "2026-08-14",
        verifiedBy: "R. Dela Cruz (QMD)",
        evidence: "PM log + facility walkthrough",
        result: "Effective",
        remarks: "Backup assignment process adopted facility-wide.",
      },
      archived: false,
      sets,
    });
  }

  /* ---- VCPA / Aug 2026 / Rooms — Partially Effective ---- */
  {
    const capaId = nextCapaId(plans, "VCPA", 2026, 8);
    const sets = buildDefaultSets(capaId, 1);
    sets[0].issue =
      "Room inspection checklist inconsistently applied across shifts.";
    sets[0].sixM.MAN = [
      { id: uid("c"), text: "New shift staff not briefed on checklist standard" },
    ];
    sets[0].vitalCauses = [
      {
        id: uid("vc"),
        text: "Shift handover does not include checklist standard briefing",
      },
    ];
    sets[0].fiveWhys = {
      why1: "Checklist was applied inconsistently.",
      why2: "Because shift staff use different versions.",
      why3: "Because there is no single controlled checklist version.",
      why4: "",
      why5: "",
      rootCause:
        "No single controlled version of the room inspection checklist.",
    };
    sets[0].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction:
          "Distribute the current controlled checklist to all shifts.",
        preventiveAction:
          "Add checklist version control to document management.",
        responsiblePerson: "P. Villanueva",
        targetDate: "2026-08-20",
        status: "Completed",
        dateCompleted: "2026-08-19",
        verification: "Distribution log",
        remarks: "",
      },
    ];
    plans.push({
      id: uid("plan"),
      capaId,
      localeId: "VCPA",
      monthId: vcpaAug.id,
      year: 2026,
      monthNum: 8,
      department: "Rooms",
      dateCreated: "2026-08-03",
      source: "Internal Audit",
      preparedBy: "P. Villanueva",
      stage: "monitoring",
      submittedDate: "2026-08-21",
      verification: {
        date: "2026-08-23",
        verifiedBy: "QMD Team",
        evidence: "Follow-up spot checks",
        result: "Partially Effective",
        remarks:
          "Improved but 2 of 5 shifts still inconsistent — placed under monitoring.",
      },
      archived: false,
      sets,
    });
  }

  /* ---- KHPA / Jul 2026 / FHI — Not Effective ---- */
  {
    const capaId = nextCapaId(plans, "KHPA", 2026, 7);
    const sets = buildDefaultSets(capaId, 1);
    sets[0].issue = "Gym equipment maintenance tag expired.";
    sets[0].sixM.MACHINE = [
      { id: uid("c"), text: "No PM schedule for gym equipment" },
    ];
    sets[0].vitalCauses = [
      { id: uid("vc"), text: "No PM schedule for gym / fitness equipment" },
    ];
    sets[0].fiveWhys = {
      why1: "Maintenance tag was expired.",
      why2: "Because no PM schedule exists for gym equipment.",
      why3: "",
      why4: "",
      why5: "",
      rootCause: "No preventive maintenance schedule for gym equipment.",
    };
    sets[0].actionItems = [
      {
        id: uid("act"),
        startedDate: "",
        correctiveAction: "Re-tag and service all gym equipment.",
        preventiveAction: "Create a PM schedule for gym equipment.",
        responsiblePerson: "K. Sokha",
        targetDate: "2026-07-15",
        status: "Completed",
        dateCompleted: "2026-07-14",
        verification: "Service log",
        remarks: "",
      },
    ];
    plans.push({
      id: uid("plan"),
      capaId,
      localeId: "KHPA",
      monthId: khpaJul.id,
      year: 2026,
      monthNum: 7,
      department: "FHI",
      dateCreated: "2026-07-02",
      source: "Customer Complaint",
      preparedBy: "K. Sokha",
      stage: "reopened",
      submittedDate: "2026-07-16",
      verification: {
        date: "2026-07-20",
        verifiedBy: "QMD Team",
        evidence: "Spot check on 2026-07-19",
        result: "Not Effective",
        remarks:
          "PM schedule was created but not yet followed — one unit found overdue again.",
      },
      archived: false,
      sets,
    });
  }

  return { locales: LOCALES, months, plans };
}
