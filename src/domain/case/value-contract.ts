import { isTreatmentDuration } from "./duration";
import { isRaceEthnicitySelections, raceEthnicityValues } from "./race-ethnicity";
import { isCompleteCalendarDate } from "./calendar-date";
import { isCompleteBirthDate } from "./birth-date";
import { isPatientAge } from "./age";
import type {
  CaseValue,
  EventFactKey,
  FactTarget,
  PatientFactKey,
  ProductFactKey,
  RelevantTestFactKey,
  ReporterFactKey,
} from "./types";
import { targetKey } from "./facts";

export type KnownValueContract =
  | { shape: "patient-age" }
  | { shape: "birth-date" }
  | { shape: "calendar-date" }
  | { shape: "duration" }
  | { shape: "string" }
  | { shape: "iso-date" }
  | { shape: "integer"; minimum: number; maximum: number }
  | { shape: "boolean" }
  | { shape: "string-array" }
  | { shape: "measurement"; units: readonly ["kg", "lb"] }
  | { shape: "enum"; values: readonly string[]; mismatch: string }
  | { shape: "enum-array"; values: readonly string[]; mismatch: string };

type CaseValueContracts = {
  patient: Record<PatientFactKey, KnownValueContract>;
  event: Record<EventFactKey, KnownValueContract>;
  product: Record<ProductFactKey, KnownValueContract>;
  test: Record<RelevantTestFactKey, KnownValueContract>;
  reporter: Record<ReporterFactKey, KnownValueContract>;
};

export const caseValueContracts = {
  patient: {
    involvement: { shape: "enum", values: ["present", "none"], mismatch: "Patient involvement requires explicit present or none" },
    identifier: { shape: "string" },
    ageYears: { shape: "patient-age" },
    dateOfBirth: { shape: "birth-date" },
    raceEthnicity: { shape: "enum-array", values: raceEthnicityValues, mismatch: "raceEthnicity requires a nonempty unique list of explicitly supplied native A5 categories" },
    a2Value: { shape: "enum", values: ["age", "date-of-birth"], mismatch: "A2 print choice requires age or date-of-birth" },
    sex: { shape: "enum", values: ["female", "male", "intersex"], mismatch: "sex requires a supported value" },
    weight: { shape: "measurement", units: ["kg", "lb"] },
  },
  event: {
    reportType: {
      shape: "enum",
      values: ["adverse-event", "product-problem", "adverse-event-and-product-problem"],
      mismatch: "reportType requires the supported report type",
    },
    reportDate: { shape: "iso-date" },
    problemDescription: { shape: "string" },
    symptoms: { shape: "string-array" },
    onsetDate: { shape: "iso-date" },
    death: { shape: "boolean" },
    deathDate: { shape: "iso-date" },
    lifeThreatening: { shape: "boolean" },
    hospitalized: { shape: "boolean" },
    disability: { shape: "boolean" },
    requiredIntervention: { shape: "boolean" },
    congenitalAnomaly: { shape: "boolean" },
    otherSerious: { shape: "boolean" },
    relevantTestsAvailable: { shape: "boolean" },
    relevantHistory: { shape: "string" },
    additionalComments: { shape: "string" },
    treatments: { shape: "string-array" },
    outcome: { shape: "string" },
    dischargeDate: { shape: "iso-date" },
    productAvailability: {
      shape: "enum",
      values: ["available", "not-available", "returned-to-manufacturer"],
      mismatch: "productAvailability requires a supported availability state",
    },
    productReturnDate: { shape: "iso-date" },
  },
  product: {
    name: { shape: "string" },
    productType: {
      shape: "enum",
      values: ["drug-or-biologic", "device", "other"],
      mismatch: "productType requires a supported product category",
    },
    role: {
      shape: "enum",
      values: ["suspect", "concomitant"],
      mismatch: "role requires suspect or concomitant",
    },
    manufacturer: { shape: "string" },
    lotNumber: { shape: "string" },
    ndcOrUniqueId: { shape: "string" },
    dose: { shape: "string" },
    strength: { shape: "string" },
    frequency: { shape: "string" },
    route: { shape: "string" },
    startDate: { shape: "iso-date" },
    stopDate: { shape: "iso-date" },
    therapyOngoing: { shape: "boolean" },
    indication: { shape: "string" },
    stopped: { shape: "boolean" },
    cosmeticUse: { shape: "enum", values: ["professional-use-only", "retail"], mismatch: "cosmeticUse requires exactly one explicitly supplied cosmetic product type" },
    medicationType: { shape: "enum-array", values: ["brand", "generic-biosimilar", "otc", "compounded"], mismatch: "medicationType requires supported medication labels" },
    doseReduced: { shape: "boolean" },
    purchaseDate: { shape: "calendar-date" },
    purchaseSellerName: { shape: "string" },
    purchaseSellerAddress: { shape: "string" },
    purchaseSellerCity: { shape: "string" },
    purchaseSellerRegion: { shape: "string" },
    purchaseSellerPostalCode: { shape: "string" },
    purchaseSellerCountry: { shape: "string" },
    purchaseWebsite: { shape: "string" },

    doseReductionDate: { shape: "calendar-date" },
    treatmentDuration: { shape: "duration" },
    d3Value: { shape: "enum", values: ["dates", "duration"], mismatch: "D3 print choice requires dates or duration" },
    improvedAfterChange: { shape: "boolean" },
    restarted: { shape: "boolean" },
    recurred: { shape: "boolean" },
    commonName: { shape: "string" },
    procode: { shape: "string" },
    modelNumber: { shape: "string" },
    catalogNumber: { shape: "string" },
    expirationDate: { shape: "iso-date" },
    serialNumber: { shape: "string" },
    udi: { shape: "string" },
    deviceOperator: {
      shape: "enum",
      values: ["health-professional", "patient-consumer", "other"],
      mismatch: "deviceOperator requires a supported operator",
    },
    implanted: { shape: "boolean" },
    implantDate: { shape: "iso-date" },
    explantDate: { shape: "iso-date" },
    reprocessedSingleUse: { shape: "boolean" },
    reprocessor: { shape: "string" },
    servicedByThirdParty: {
      shape: "enum",
      values: ["yes", "no", "unknown"],
      mismatch: "servicedByThirdParty requires yes, no, or unknown",
    },
  },
  test: {
    testName: { shape: "string" },
    testResult: { shape: "string" },
    lowRange: { shape: "string" },
    highRange: { shape: "string" },
    date: { shape: "iso-date" },
  },
  reporter: {
    lastName: { shape: "string" },
    firstName: { shape: "string" },
    address: { shape: "string" },
    city: { shape: "string" },
    state: { shape: "string" },
    postalCode: { shape: "string" },
    country: { shape: "string" },
    phone: { shape: "string" },
    email: { shape: "string" },
    healthProfessional: { shape: "boolean" },
    occupation: { shape: "string" },
    reportedTo: {
      shape: "enum-array",
      values: ["manufacturer", "user-facility", "distributor-importer", "packer"],
      mismatch: "reportedTo requires supported reporter destinations",
    },
    doNotDiscloseIdentity: { shape: "boolean" },
  },
} as const satisfies CaseValueContracts;

export const modelTargetValueContracts = {
  patient: omit(caseValueContracts.patient, "a2Value"),
  event: omit(omit(caseValueContracts.event, "reportType"), "reportDate"),
  product: omit(caseValueContracts.product, "d3Value"),
  test: caseValueContracts.test,
} as const;

export function knownValueMismatch(target: FactTarget, value: CaseValue<unknown>): string | undefined {
  if (value.kind !== "known") return undefined;
  const contract = contractForTarget(target);
  const actual = value.value;

  switch (contract.shape) {
    case "duration": return isTreatmentDuration(actual) ? undefined : "treatmentDuration requires an explicit positive decimal string amount and supported unit";
    case "calendar-date": return isCompleteCalendarDate(actual) ? undefined : `${target.field} requires a complete valid ISO calendar date (YYYY-MM-DD), year 0001–9999`;
    case "birth-date": return isCompleteBirthDate(actual) ? undefined : "dateOfBirth requires a complete valid ISO calendar date (YYYY-MM-DD), year 0001–9999";
    case "patient-age": return isPatientAge(actual) ? undefined : `${target.field} requires a valid age: whole years 0–150, or an explicit nonnegative whole number with unit months, weeks or days`;
    case "string":
      if (target.entity === "event" && target.field === "additionalComments" && typeof actual === "string" && !actual.trim()) return "additionalComments requires explicitly supplied nonblank text";
      return typeof actual === "string" ? undefined : `${target.field} requires a string`;
    case "iso-date":
      return typeof actual === "string" && /^\d{4}-\d{2}-\d{2}$/.test(actual)
        && (target.field !== "reportDate" || (Number.isFinite(Date.parse(actual)) && new Date(actual).toISOString().slice(0, 10) === actual))
        ? undefined
        : `${target.field} requires an ISO calendar date`;
    case "integer":
      return Number.isInteger(actual) && (actual as number) >= contract.minimum && (actual as number) <= contract.maximum
        ? undefined
        : `${target.field} requires a valid age`;
    case "boolean":
      return typeof actual === "boolean" ? undefined : `${target.field} requires a boolean`;
    case "string-array":
      return Array.isArray(actual) && actual.every((item) => typeof item === "string")
        ? undefined
        : `${target.field} requires a string array`;
    case "measurement":
      return actual !== null
        && typeof actual === "object"
        && typeof (actual as { value?: unknown }).value === "number"
        && Number.isFinite((actual as { value: number }).value)
        && (actual as { value: number }).value > 0
        && contract.units.includes(String((actual as { unit?: unknown }).unit) as "kg" | "lb")
        ? undefined
        : `${target.field} requires a positive weight with kg or lb`;
    case "enum":
      return contract.values.includes(actual as string) ? undefined : contract.mismatch;
    case "enum-array":
      return (target.field !== "raceEthnicity" || isRaceEthnicitySelections(actual)) && Array.isArray(actual) && (target.field !== "medicationType" || (actual.length > 0 && new Set(actual).size === actual.length)) && actual.every((item) => contract.values.includes(String(item)))
        ? undefined
        : contract.mismatch;
  }
}

export function assertCaseValueMatchesTarget(target: FactTarget, value: CaseValue<unknown>): void {
  if (!value || typeof value !== "object") throw new Error(`${targetKey(target)} requires a case value`);
  const raw = value as unknown as Record<string, unknown>;
  const kind = raw.kind;
  if (!["known", "unknown", "explicitly-absent", "inapplicable", "declined"].includes(kind as string)) {
    throw new Error(`${targetKey(target)} has an unsupported resolved meaning`);
  }
  if (kind !== "known") {
    if (Object.keys(raw).some((key) => key !== "kind")) {
      throw new Error(`${targetKey(target)} mixes mutually exclusive resolved meanings`);
    }
    return;
  }
  if (!("value" in raw)) throw new Error(`${targetKey(target)} requires a known value`);
  if (Object.keys(raw).some((key) => !["kind", "value", "qualifier"].includes(key))) {
    throw new Error(`${targetKey(target)} has an unsupported known-value property`);
  }
  if ("qualifier" in raw && (typeof raw.qualifier !== "string" || !raw.qualifier.trim())) {
    throw new Error(`${targetKey(target)} requires a non-empty string qualifier`);
  }
  const mismatch = knownValueMismatch(target, value);
  if (mismatch) throw new Error(`${targetKey(target)} ${mismatch.replace(`${target.field} `, "")}`);
}

export function modelKnownValueGuidance(): string {
  const byDescription = new Map<string, string[]>();
  for (const [entity, fields] of Object.entries(modelTargetValueContracts)) {
    for (const [field, contract] of Object.entries(fields)) {
      const description = describeContract(contract);
      byDescription.set(description, [...(byDescription.get(description) ?? []), `${entity}.${field}`]);
    }
  }
  return `Known values must match their target: ${[...byDescription]
    .map(([description, targets]) => `${description} for ${targets.join(", ")}`)
    .join("; ")}.`;
}

function describeContract(contract: KnownValueContract): string {
  switch (contract.shape) {
    case "duration": return "an object {value: positive plain decimal string, unit: minutes|hours|days|weeks|months|years}, preserving spelling; never calculate from dates or invent units";
    case "calendar-date": return "a complete valid Gregorian ISO calendar date YYYY-MM-DD, year 0001–9999; never infer or repair a supplied date";
    case "birth-date": return "a complete valid Gregorian ISO calendar date YYYY-MM-DD, year 0001–9999; never invent missing components or derive age";
    case "patient-age": return "an integer 0–150 for years, or an object {value: nonnegative safe integer, unit: months, weeks or days} for explicit non-year patient age (legacy target ageYears)";
    case "string": return "a string";
    case "iso-date": return "an ISO date (YYYY-MM-DD)";
    case "integer": return `an integer from ${contract.minimum} through ${contract.maximum}`;
    case "boolean": return "a boolean";
    case "string-array": return "an array of strings";
    case "measurement": return `a positive measurement using ${contract.units.join(" or ")}`;
    case "enum": return `one of ${contract.values.join(", ")}`;
    case "enum-array": return `an array containing only ${contract.values.join(", ")}`;
  }
}

function contractForTarget(target: FactTarget): KnownValueContract {
  const contracts = caseValueContracts[target.entity] as Record<string, KnownValueContract>;
  const contract = contracts[target.field];
  if (!contract) throw new Error(`${targetKey(target)} is not a supported fact target`);
  return contract;
}

function omit<const T extends Record<string, KnownValueContract>, const K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}
