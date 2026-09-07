/* Domain types for the CAPA system. Shapes mirror the original app's in-memory
   `data` object so ported components need no reshaping. */

export type Category =
  | "MAN"
  | "MACHINE"
  | "METHOD"
  | "MEASUREMENT"
  | "MATERIALS"
  | "MOTHER_NATURE";

export type Cause = { id: string; text: string };

export type SixM = Record<Category, Cause[]>;

export type FiveWhys = {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  rootCause: string;
};

export type ActionItem = {
  id: string;
  correctiveAction: string;
  preventiveAction: string;
  responsiblePerson: string;
  targetDate: string;
  /** Used when status = "In Progress". */
  startedDate: string;
  status: string;
  dateCompleted: string;
  verification: string;
  remarks: string;
};

export type CapaSet = {
  id: string;
  setNumber: number;
  setCode: string;
  archived: boolean;
  issue: string;
  sixM: SixM;
  vitalCauses: Cause[];
  fiveWhys: FiveWhys;
  actionItems: ActionItem[];
};

export type Verification = {
  date: string;
  verifiedBy: string;
  evidence: string;
  result: string;
  remarks: string;
};

export type PlanStage =
  | "draft"
  | "submitted"
  | "observing"
  | "closed"
  | "monitoring"
  | "reopened";

export type CapaPlan = {
  id: string;
  capaId: string;
  localeId: string;
  monthId: string;
  year: number;
  monthNum: number;
  department: string;
  dateCreated: string;
  source: string;
  preparedBy: string;
  stage: PlanStage;
  submittedDate: string;
  verification: Verification;
  archived: boolean;
  /** Observation window (set by QMD from the Observation Panel). Optional so
      seed-data literals need no change; mapPlan() always fills them. */
  observationStartedDate?: string;
  observationDurationDays?: number;
  observationStartedBy?: string;
  sets: CapaSet[];
  /** ISO timestamp from the DB; used for optimistic-concurrency on save. */
  updatedAt?: string;
};

export type Locale = { id: string; name: string };

export type Month = {
  id: string;
  localeId: string;
  year: number;
  monthNum: number;
  label: string;
};

export type AppData = {
  locales: Locale[];
  months: Month[];
  plans: CapaPlan[];
};

export type Role = "LOCALE" | "QMD";

export type SessionUser =
  | { role: "LOCALE"; localeId: string; userId: string }
  | { role: "QMD"; userId: string };
