import type { Fact, ProductEntity, ReportType, SemanticCase } from "./types";

export interface ProjectionOmission {
  concept: string;
  target: string;
  reason: "empty" | "unknown" | "explicitly-absent" | "inapplicable" | "declined" | "conflicted";
  sourceIds: string[];
}

export interface Form3500Projection {
  revision: number;
  sections: {
    A: { patientIdentifier?: string; ageYears?: number; sex?: "female" | "male" | "intersex"; weight?: { value: number; unit: "kg" | "lb" } };
    B: {
      reportType?: ReportType;
      eventDate?: string;
      eventDescription?: string;
      hospitalized?: boolean;
      death?: boolean;
      deathDate?: string;
      lifeThreatening?: boolean;
      disability?: boolean;
      requiredIntervention?: boolean;
      congenitalAnomaly?: boolean;
      otherSerious?: boolean;
      relevantTests: ProjectedRelevantTest[];
      relevantHistory?: string;
    };
    C: {
      productAvailability?: "available" | "not-available" | "returned-to-manufacturer";
      productReturnDate?: string;
    };
    D: { suspectProducts: ProjectedProduct[] };
    E: { suspectDevice?: ProjectedDevice };
    F: { concomitantProducts: ProjectedConcomitantProduct[] };
    G: { reporter: ProjectedReporter };
  };
  sourceTrace: Record<string, string[]>;
  omissions: ProjectionOmission[];
  notIncluded: string[];
}

export interface ProjectedRelevantTest {
  testId: string;
  testResult?: string;
  lowRange?: string;
  highRange?: string;
  date?: string;
}

export interface ProjectedReporter {
  lastName?: string; firstName?: string; address?: string; city?: string; state?: string;
  postalCode?: string; country?: string; phone?: string; email?: string;
  healthProfessional?: boolean; occupation?: string;
  reportedTo?: Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer">;
  doNotDiscloseIdentity?: boolean;
}

export interface ProjectedProduct {
  productId: string;
  name?: string;
  manufacturer?: string;
  lotNumber?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  stopDate?: string;
  indication?: string;
}

export interface ProjectedDevice {
  productId: string;
  brandName?: string;
  commonName?: string;
  procode?: string;
  manufacturer?: string;
  modelNumber?: string;
  lotNumber?: string;
  catalogNumber?: string;
  expirationDate?: string;
  serialNumber?: string;
  udi?: string;
  operator?: "health-professional" | "patient-consumer" | "other";
  implantDate?: string;
  explantDate?: string;
  reprocessedSingleUse?: boolean;
  reprocessor?: string;
  servicedByThirdParty?: "yes" | "no" | "unknown";
}

export interface ProjectedConcomitantProduct {
  productId: string;
  name?: string;
  startDate?: string;
  stopDate?: string;
}

export function projectForm3500(caseState: SemanticCase): Form3500Projection {
  const projection: Form3500Projection = {
    revision: caseState.revision,
    sections: { A: {}, B: { relevantTests: [] }, C: {}, D: { suspectProducts: [] }, E: {}, F: { concomitantProducts: [] }, G: { reporter: {} } },
    sourceTrace: {},
    omissions: [],
    notIncluded: [
      "Patient date of birth and race or ethnicity",
      "Section C product pictures and additional comments",
      "Concomitant dose, frequency, and route (Section F has no fields for them)",
      "Additional suspect medical devices beyond the first",
    ],
  };

  assign(projection, "sections.A.patientIdentifier", "patient identifier", "patient:patient:identifier", caseState.patient.facts.identifier, projection.sections.A, "patientIdentifier");
  assign(projection, "sections.A.ageYears", "patient age", "patient:patient:ageYears", caseState.patient.facts.ageYears, projection.sections.A, "ageYears");
  assign(projection, "sections.A.sex", "patient sex", "patient:patient:sex", caseState.patient.facts.sex, projection.sections.A, "sex");
  assign(projection, "sections.A.weight", "patient weight", "patient:patient:weight", caseState.patient.facts.weight, projection.sections.A, "weight");
  assign(projection, "sections.B.reportType", "report type", "event:event:reportType", caseState.event.facts.reportType, projection.sections.B, "reportType");
  assign(projection, "sections.B.eventDate", "event date", "event:event:onsetDate", caseState.event.facts.onsetDate, projection.sections.B, "eventDate");
  assign(projection, "sections.B.hospitalized", "hospitalization outcome", "event:event:hospitalized", caseState.event.facts.hospitalized, projection.sections.B, "hospitalized");
  for (const field of ["death", "lifeThreatening", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    assign(projection, `sections.B.${field}`, `${field} outcome`, `event:event:${field}`, caseState.event.facts[field], projection.sections.B, field);
  }
  if (known(caseState.event.facts.death)?.value === true) {
    assign(projection, "sections.B.deathDate", "death date", "event:event:deathDate", caseState.event.facts.deathDate, projection.sections.B, "deathDate");
  }
  assign(projection, "sections.B.relevantHistory", "relevant medical history", "event:event:relevantHistory", caseState.event.facts.relevantHistory, projection.sections.B, "relevantHistory");
  assign(projection, "sections.C.productAvailability", "product availability", "event:event:productAvailability", caseState.event.facts.productAvailability, projection.sections.C, "productAvailability");
  if (known(caseState.event.facts.productAvailability)?.value === "returned-to-manufacturer") {
    assign(projection, "sections.C.productReturnDate", "product return date", "event:event:productReturnDate", caseState.event.facts.productReturnDate, projection.sections.C, "productReturnDate");
  }

  for (const test of caseState.relevantTests.filter(({ state }) => state === "resolved")) {
    const result: ProjectedRelevantTest = { testId: test.id };
    const index = projection.sections.B.relevantTests.length;
    for (const field of ["testResult", "lowRange", "highRange", "date"] as const) {
      assign(projection, `sections.B.relevantTests.${index}.${field}`, `${field} for ${test.id}`, `test:${test.id}:${field}`, test.facts[field], result, field);
    }
    projection.sections.B.relevantTests.push(result);
  }
  if (projection.sections.B.relevantTests.length === 0) {
    const testsAvailable = known(caseState.event.facts.relevantTestsAvailable);
    projection.omissions.push({
      concept: "relevant tests",
      target: "event:event:relevantTestsAvailable",
      reason: testsAvailable?.value === false
        ? "explicitly-absent"
        : omissionReason(caseState.event.facts.relevantTestsAvailable),
      sourceIds: caseState.event.facts.relevantTestsAvailable.sourceIds,
    });
  }

  const eventDescription = buildEventDescription(caseState);
  if (eventDescription.value) {
    projection.sections.B.eventDescription = eventDescription.value;
    projection.sourceTrace["sections.B.eventDescription"] = eventDescription.sourceIds;
  } else {
    projection.omissions.push({ concept: "event description", target: "event:event", reason: "empty", sourceIds: [] });
  }

  for (const product of caseState.products.filter(({ state }) => state === "resolved")) {
    const role = known(product.facts.role);
    const productType = known(product.facts.productType);
    if (!role || (role.value !== "suspect" && role.value !== "concomitant")) {
      projection.omissions.push({
        concept: `report role for ${product.id}`,
        target: `product:${product.id}:role`,
        reason: omissionReason(product.facts.role),
        sourceIds: product.facts.role.sourceIds,
      });
      continue;
    }
    if (role.value === "suspect") {
      if (productType?.value === "device") {
        if (!projection.sections.E.suspectDevice) {
          projection.sections.E.suspectDevice = projectDevice(product, projection);
        }
      } else {
        const target = projection.sections.D.suspectProducts;
        target.push(projectProduct(product, projection, target.length));
      }
    } else {
      const target = projection.sections.F.concomitantProducts;
      target.push(projectConcomitantProduct(product, projection, target.length));
    }
  }

  for (const field of ["lastName", "firstName", "address", "city", "state", "postalCode", "country", "phone", "email", "healthProfessional", "occupation", "reportedTo", "doNotDiscloseIdentity"] as const) {
    assign<unknown>(projection, `sections.G.reporter.${field}`, `reporter ${field}`, `reporter:reporter:${field}`, caseState.reporter.facts[field] as Fact<unknown>, projection.sections.G.reporter, field);
  }

  return projection;
}

function projectProduct(
  product: ProductEntity,
  projection: Form3500Projection,
  index: number,
): ProjectedProduct {
  const result: ProjectedProduct = { productId: product.id };
  const prefix = `sections.D.suspectProducts.${index}`;
  for (const field of ["name", "manufacturer", "lotNumber", "dose", "frequency", "route", "startDate", "stopDate", "indication"] as const) {
    assign(projection, `${prefix}.${field}`, `${field} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field], result, field);
  }
  return result;
}

function projectDevice(product: ProductEntity, projection: Form3500Projection): ProjectedDevice {
  const result: ProjectedDevice = { productId: product.id };
  const mappings = [
    ["name", "brandName"], ["commonName", "commonName"], ["procode", "procode"],
    ["manufacturer", "manufacturer"], ["modelNumber", "modelNumber"], ["lotNumber", "lotNumber"],
    ["catalogNumber", "catalogNumber"], ["expirationDate", "expirationDate"], ["serialNumber", "serialNumber"],
    ["udi", "udi"], ["deviceOperator", "operator"], ["implantDate", "implantDate"],
    ["explantDate", "explantDate"], ["reprocessedSingleUse", "reprocessedSingleUse"],
    ["reprocessor", "reprocessor"], ["servicedByThirdParty", "servicedByThirdParty"],
  ] as const;
  for (const [field, output] of mappings) {
    assign<unknown>(projection, `sections.E.suspectDevice.${output}`, `${output} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field] as Fact<unknown>, result, output);
  }
  return result;
}

function projectConcomitantProduct(
  product: ProductEntity,
  projection: Form3500Projection,
  index: number,
): ProjectedConcomitantProduct {
  const result: ProjectedConcomitantProduct = { productId: product.id };
  const prefix = `sections.F.concomitantProducts.${index}`;
  for (const field of ["name", "startDate", "stopDate"] as const) {
    assign(projection, `${prefix}.${field}`, `${field} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field], result, field);
  }
  return result;
}

function assign<T>(
  projection: Form3500Projection,
  path: string,
  concept: string,
  target: string,
  fact: Fact<T>,
  output: object,
  key: string,
  transform: (value: T) => unknown = (value) => value,
): void {
  const resolved = known(fact);
  if (resolved) {
    (output as Record<string, unknown>)[key] = transform(resolved.value);
    projection.sourceTrace[path] = resolved.sourceIds;
    return;
  }
  projection.omissions.push({ concept, target, reason: omissionReason(fact), sourceIds: fact.sourceIds });
}

function known<T>(fact: Fact<T>): { value: T; sourceIds: string[] } | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known"
    ? { value: fact.resolvedValue.value.value, sourceIds: fact.resolvedValue.sourceIds }
    : undefined;
}

function omissionReason(fact: Fact<unknown>): ProjectionOmission["reason"] {
  if (fact.state === "conflicted") return "conflicted";
  if (!fact.resolvedValue) return "empty";
  return fact.resolvedValue.value.kind === "known" ? "empty" : fact.resolvedValue.value.kind;
}

function buildEventDescription(caseState: SemanticCase): { value?: string; sourceIds: string[] } {
  const parts: string[] = [];
  const sourceIds: string[] = [];
  const append = <T>(fact: Fact<T>, render: (value: T) => string) => {
    const value = known(fact);
    if (value) {
      parts.push(render(value.value));
      sourceIds.push(...value.sourceIds);
    }
  };
  append(caseState.event.facts.problemDescription, (value) => `Problem detail: ${value}.`);
  append(caseState.event.facts.symptoms, (value) => `Symptoms: ${value.join(" and ")}.`);
  append(caseState.event.facts.treatments, (value) => `Treatment: ${value.join("; ")}.`);
  append(caseState.event.facts.outcome, (value) => `Outcome: ${value}.`);
  append(caseState.event.facts.dischargeDate, (value) => `Discharged ${displayDate(value)}.`);
  const stopped = caseState.products.filter(({ state }) => state === "resolved").flatMap((product) => {
    const name = known(product.facts.name);
    const wasStopped = known(product.facts.stopped);
    if (!name || !wasStopped?.value) return [];
    sourceIds.push(...name.sourceIds, ...wasStopped.sourceIds);
    return [name.value];
  });
  if (stopped.length > 0) parts.push(`Products stopped: ${joinWithAnd(stopped)}.`);
  return { value: parts.length > 0 ? parts.join(" ") : undefined, sourceIds: [...new Set(sourceIds)] };
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${Number(day)}-${monthName}-${year}`;
}

function joinWithAnd(values: string[]): string {
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}
