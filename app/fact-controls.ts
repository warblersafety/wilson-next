import type {
  EventFactKey,
  PatientFactKey,
  ProductFactKey,
  RelevantTestFactKey,
  ReporterFactKey,
} from "../src/domain/case/types";

export type FactControlShape =
  | "text"
  | "age"
  | "date"
  | "boolean"
  | "list"
  | "weight"
  | "choice"
  | "choices";

export interface FactControl {
  label: string;
  shape: FactControlShape;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

const choices = (...options: Array<[string, string]>): FactControl["options"] =>
  options.map(([value, label]) => ({ value, label }));

const patient = {
  identifier: { label: "Identifier", shape: "text" },
  ageYears: { label: "Age", shape: "age" },
  sex: { label: "Sex", shape: "choice", options: choices(["female", "Female"], ["male", "Male"], ["intersex", "Intersex"]) },
  weight: { label: "Weight", shape: "weight" },
} as const satisfies Record<PatientFactKey, FactControl>;

const event = {
  reportType: { label: "Report type", shape: "choice", options: choices(
    ["adverse-event", "Adverse event"],
    ["product-problem", "Product problem"],
    ["adverse-event-and-product-problem", "Adverse event and product problem"],
  ) },
  problemDescription: { label: "Product problem", shape: "text" },
  symptoms: { label: "Symptoms", shape: "list" },
  onsetDate: { label: "Onset", shape: "date" },
  death: { label: "Death", shape: "boolean" },
  deathDate: { label: "Date of death", shape: "date" },
  lifeThreatening: { label: "Life-threatening", shape: "boolean" },
  hospitalized: { label: "Hospitalized", shape: "boolean" },
  disability: { label: "Disability or permanent damage", shape: "boolean" },
  requiredIntervention: { label: "Required intervention", shape: "boolean" },
  congenitalAnomaly: { label: "Congenital anomaly", shape: "boolean" },
  otherSerious: { label: "Other serious event", shape: "boolean" },
  relevantTestsAvailable: { label: "Relevant tests available", shape: "boolean" },
  relevantHistory: { label: "Relevant history", shape: "text" },
  treatments: { label: "Treatment", shape: "list" },
  outcome: { label: "Outcome", shape: "text" },
  dischargeDate: { label: "Discharged", shape: "date" },
  productAvailability: { label: "Product availability", shape: "choice", options: choices(
    ["available", "Available for evaluation"],
    ["not-available", "Not available for evaluation"],
    ["returned-to-manufacturer", "Returned to manufacturer"],
  ) },
  productReturnDate: { label: "Returned to manufacturer", shape: "date" },
} as const satisfies Record<EventFactKey, FactControl>;

const product = {
  name: { label: "Name", shape: "text" },
  productType: { label: "Product type", shape: "choice", options: choices(
    ["drug-or-biologic", "Drug or biologic"], ["device", "Medical device"], ["other", "Other product"],
  ) },
  role: { label: "Role", shape: "choice", options: choices(["suspect", "Suspect"], ["concomitant", "Concomitant"]) },
  manufacturer: { label: "Manufacturer", shape: "text" },
  lotNumber: { label: "Lot number", shape: "text" },
  dose: { label: "Dose", shape: "text" },
  frequency: { label: "Frequency", shape: "text" },
  route: { label: "Route", shape: "text" },
  startDate: { label: "Started", shape: "date" },
  stopDate: { label: "Stopped date", shape: "date" },
  indication: { label: "Used for", shape: "text" },
  stopped: { label: "Stopped or removed", shape: "boolean" },
  commonName: { label: "Common device name", shape: "text" },
  procode: { label: "Procode", shape: "text" },
  modelNumber: { label: "Model number", shape: "text" },
  catalogNumber: { label: "Catalog number", shape: "text" },
  expirationDate: { label: "Expiration date", shape: "date" },
  serialNumber: { label: "Serial number", shape: "text" },
  udi: { label: "Unique device identifier", shape: "text" },
  deviceOperator: { label: "Device operator", shape: "choice", options: choices(
    ["health-professional", "Health professional"], ["patient-consumer", "Patient or consumer"], ["other", "Other operator"],
  ) },
  implanted: { label: "Implanted device", shape: "boolean" },
  implantDate: { label: "Implant date", shape: "date" },
  explantDate: { label: "Explant date", shape: "date" },
  reprocessedSingleUse: { label: "Reprocessed single-use device", shape: "boolean" },
  reprocessor: { label: "Reprocessor", shape: "text" },
  servicedByThirdParty: { label: "Third-party serviced", shape: "choice", options: choices(
    ["yes", "Yes"], ["no", "No"], ["unknown", "Unknown"],
  ) },
} as const satisfies Record<ProductFactKey, FactControl>;

const test = {
  testResult: { label: "Test and result", shape: "text" },
  lowRange: { label: "Low range", shape: "text" },
  highRange: { label: "High range", shape: "text" },
  date: { label: "Date", shape: "date" },
} as const satisfies Record<RelevantTestFactKey, FactControl>;

const reporter = {
  lastName: { label: "Last name", shape: "text" },
  firstName: { label: "First name", shape: "text" },
  address: { label: "Address", shape: "text" },
  city: { label: "City", shape: "text" },
  state: { label: "State", shape: "text" },
  postalCode: { label: "ZIP/postal code", shape: "text" },
  country: { label: "Country", shape: "text" },
  phone: { label: "Phone", shape: "text" },
  email: { label: "Email", shape: "text" },
  healthProfessional: { label: "Health professional", shape: "boolean" },
  occupation: { label: "Occupation", shape: "text" },
  reportedTo: { label: "Also reported to", shape: "choices", options: choices(
    ["manufacturer", "Manufacturer or compounder"],
    ["user-facility", "User facility"],
    ["distributor-importer", "Distributor or importer"],
    ["packer", "Packer"],
  ) },
  doNotDiscloseIdentity: { label: "Keep identity from manufacturer", shape: "boolean" },
} as const satisfies Record<ReporterFactKey, FactControl>;

export const factControlRegistry = { patient, event, product, test, reporter };
export type FactControlEntity = keyof typeof factControlRegistry;

export function factControl(entity: FactControlEntity, field: string): FactControl | undefined {
  return (factControlRegistry[entity] as Record<string, FactControl>)[field];
}

export function knownOptionLabel(value: string): string | undefined {
  for (const controls of Object.values(factControlRegistry)) {
    for (const control of Object.values(controls) as FactControl[]) {
      const option = control.options?.find((candidate) => candidate.value === value);
      if (option) return option.label;
    }
  }
  return undefined;
}
