import { d3DateFields, type TreatmentDuration } from "./duration";
import { raceEthnicityOptions, type RaceEthnicity } from "./race-ethnicity";
import type { PatientAge } from "./age";
import { allFacts, targetKey } from "./facts";
import { doseReductionDateNotice, ongoingTherapyNotice, isSettled, restartApplicability, withdrawalApplicability } from "./medication";
import { productDisplayLabel } from "./product-label";
import type { Fact, ProductEntity, ProductFactKey, ReportType, SemanticCase } from "./types";

const sectionDProductFields = ["name", "manufacturer", "lotNumber", "ndcOrUniqueId", "expirationDate", "dose", "strength", "frequency", "route", "startDate", "stopDate", "therapyOngoing", "doseReductionDate", "treatmentDuration", "indication", "medicationType"] as const satisfies readonly ProductFactKey[];
const sectionEProductFields = ["name", "commonName", "procode", "manufacturer", "modelNumber", "lotNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"] as const satisfies readonly ProductFactKey[];
const sectionFProductFields = ["name", "startDate", "stopDate"] as const satisfies readonly ProductFactKey[];
const productSelectorOrSharedFields = new Set<ProductFactKey>(["productType", "role", "stopped", "d3Value"]);

export interface ProjectionOmission {
  concept: string;
  target: string;
  reason: "empty" | "unknown" | "explicitly-absent" | "inapplicable" | "declined" | "conflicted" | "qualifier-not-included" | "a2-alternative-not-selected" | "reduction-date-conflict" | "d3-alternative-not-selected";
  qualifier?: string;
  baseValueIncluded?: boolean;
  sourceIds: string[];
}

export interface Form3500Projection {
  revision: number;
  sections: {
    A: { patientIdentifier?: string; ageYears?: PatientAge; dateOfBirth?: string; raceEthnicity?: RaceEthnicity[]; sex?: "female" | "male" | "intersex"; weight?: { value: number; unit: "kg" | "lb" } };
    B: {
      reportType?: ReportType;
      reportDate?: string;
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
      relevantTestContext?: string;
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

/** Raw reviewed quantity and context stay distinct until native PDF formatting. */
export interface ProjectedQuantity {
  value: string;
  qualifier?: string;
}

export interface ProjectedProduct {
  productId: string;
  name?: string;
  manufacturer?: string;
  lotNumber?: string;
  ndcOrUniqueId?: string;
  expirationDate?: string;
  dose?: ProjectedQuantity;
  strength?: ProjectedQuantity;
  frequency?: string;
  route?: string;
  startDate?: string;
  stopDate?: string;
  therapyOngoing?: boolean;
  doseReductionDate?: string;
  treatmentDuration?: TreatmentDuration;
  indication?: string;
  medicationType?: Array<"brand" | "generic-biosimilar" | "otc" | "compounded">;
  improvedAfterChange?: boolean | "inapplicable";
  recurred?: boolean | "inapplicable";
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
      "Patient fractional or compound ages and partial date of birth",
      "Patient race/ethnicity detail outside the seven A5 categories",
      "Section C product pictures and general additional comments",
      "Additional suspect medical devices beyond the first",
      "Section D partial expiration dates, other product-type categories and purchase details",
      "Section D partial dose-reduction dates; dose-count, compound and range treatment durations",
    ],
  };

  assign(projection, "sections.A.patientIdentifier", "patient identifier", "patient:patient:identifier", caseState.patient.facts.identifier, projection.sections.A, "patientIdentifier");
  assign(projection, "sections.A.ageYears", "patient age", "patient:patient:ageYears", caseState.patient.facts.ageYears, projection.sections.A, "ageYears");
  assign(projection, "sections.A.dateOfBirth", "patient date of birth", "patient:patient:dateOfBirth", caseState.patient.facts.dateOfBirth, projection.sections.A, "dateOfBirth");
  const a2Choice = known(caseState.patient.facts.a2Value);
  if (a2Choice) {
    projection.sourceTrace["sections.A.a2Value"] = a2Choice.sourceIds;
    const unselected = a2Choice.value === "age" ? "dateOfBirth" : "ageYears";
    const omitted = known<unknown>(caseState.patient.facts[unselected]);
    delete projection.sections.A[unselected];
    delete projection.sourceTrace[`sections.A.${unselected}`];
    if (omitted) projection.omissions.push({ concept: unselected === "ageYears" ? "patient age" : "patient date of birth", target: `patient:patient:${unselected}`, reason: "a2-alternative-not-selected", sourceIds: omitted.sourceIds });
    for (const item of projection.omissions) if (item.target === `patient:patient:${unselected}` && item.reason === "qualifier-not-included") item.baseValueIncluded = false;
  }
  assign(projection, "sections.A.raceEthnicity", "patient race and/or ethnicity", "patient:patient:raceEthnicity", caseState.patient.facts.raceEthnicity, projection.sections.A, "raceEthnicity", values => raceEthnicityOptions.filter(option => values.includes(option.value)).map(option => option.value));
  assign(projection, "sections.A.sex", "patient sex", "patient:patient:sex", caseState.patient.facts.sex, projection.sections.A, "sex");
  assign(projection, "sections.A.weight", "patient weight", "patient:patient:weight", caseState.patient.facts.weight, projection.sections.A, "weight");
  assign(projection, "sections.B.reportType", "report type", "event:event:reportType", caseState.event.facts.reportType, projection.sections.B, "reportType");
  assign(projection, "sections.B.eventDate", "event date", "event:event:onsetDate", caseState.event.facts.onsetDate, projection.sections.B, "eventDate");
  assign(projection, "sections.B.reportDate", "date of this report", "event:event:reportDate", caseState.event.facts.reportDate, projection.sections.B, "reportDate");
  assign(projection, "sections.B.hospitalized", "hospitalization outcome", "event:event:hospitalized", caseState.event.facts.hospitalized, projection.sections.B, "hospitalized");
  for (const field of ["death", "lifeThreatening", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    assign(projection, `sections.B.${field}`, `${field} outcome`, `event:event:${field}`, caseState.event.facts[field], projection.sections.B, field);
  }
  if (known(caseState.event.facts.death)?.value === true) {
    assign(projection, "sections.B.deathDate", "death date", "event:event:deathDate", caseState.event.facts.deathDate, projection.sections.B, "deathDate");
  }
  assign(projection, "sections.B.relevantHistory", "relevant medical history", "event:event:relevantHistory", caseState.event.facts.relevantHistory, projection.sections.B, "relevantHistory", value => known(caseState.event.facts.relevantHistory)?.qualifier ? `${value}\nHistory context: ${known(caseState.event.facts.relevantHistory)!.qualifier}` : value, true);
  assign(projection, "sections.C.productAvailability", "product availability", "event:event:productAvailability", caseState.event.facts.productAvailability, projection.sections.C, "productAvailability");
  if (known(caseState.event.facts.productAvailability)?.value === "returned-to-manufacturer") {
    assign(projection, "sections.C.productReturnDate", "product return date", "event:event:productReturnDate", caseState.event.facts.productReturnDate, projection.sections.C, "productReturnDate");
  }

  for (const test of caseState.relevantTests.filter(({ state }) => state === "resolved")) {
    const result: ProjectedRelevantTest = { testId: test.id };
    const index = projection.sections.B.relevantTests.length;
    const observation: { testName?: string; testResult?: string } = {};
    for (const field of ["testName", "testResult"] as const) {
      assign(projection, `sections.B.relevantTests.${index}.testResult`, `${field === "testName" ? "test identity" : "test result"} for ${test.id}`, `test:${test.id}:${field}`, test.facts[field], observation, field, value => value, true);
    }
    // FDA B6 has a single identity/result cell. Compose only reviewed facts and
    // explicit missing-detail labels; never derive identity from result text.
    result.testResult = `${observation.testName ?? "Test identity not recorded"}: ${observation.testResult ?? "Result not recorded"}`;
    projection.sourceTrace[`sections.B.relevantTests.${index}.testResult`] = [...new Set([
      ...(known(test.facts.testName)?.sourceIds ?? []), ...(known(test.facts.testResult)?.sourceIds ?? []),
    ])];
    for (const field of ["lowRange", "highRange", "date"] as const) {
      assign(projection, `sections.B.relevantTests.${index}.${field}`, `${field} for ${test.id}`, `test:${test.id}:${field}`, test.facts[field], result, field, value => value, true);
    }
    projection.sections.B.relevantTests.push(result);
  }
  const testContext = relevantTestContextEntries(caseState);
  if (testContext.length) {
    projection.sections.B.relevantTestContext = testContext.map(entry => entry.text).join("\n");
    projection.sourceTrace["sections.B.relevantTestContext"] = [...new Set(testContext.flatMap(entry => entry.sourceIds))];
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

  // B5 can contain the other narrative facts even when one of these is not
  // carried. Disclose that individual omission, including unresolved conflict.
  for (const [field, concept] of [["symptoms", "symptoms"], ["problemDescription", "product problem"], ["treatments", "treatment"], ["outcome", "event outcome"], ["dischargeDate", "discharge date"]] as const) {
    const fact = caseState.event.facts[field];
    if (!known<unknown>(fact)) projection.omissions.push({ concept, target: `event:event:${field}`, reason: omissionReason(fact), sourceIds: fact.sourceIds });
  }
  for (const product of caseState.products.filter(({ state }) => state === "resolved")) {
    if (known(product.facts.name) && known(product.facts.stopped)?.value === true) {
      recordQualifierOmission(projection, `product:${product.id}:stopped`, `stopped for ${product.id}`, product.facts.stopped);
    }
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
    if (!productType) {
      projection.omissions.push({
        concept: `product type for ${productLabel(caseState, product)}`,
        target: `product:${product.id}:productType`,
        reason: omissionReason(product.facts.productType),
        sourceIds: product.facts.productType.sourceIds,
      });
      continue;
    }
    const reductionNotice = doseReductionDateNotice(product.facts);
    if (reductionNotice) projection.notIncluded.push(`${productLabel(caseState, product)} — ${reductionNotice}`);
    const ongoingNotice = ongoingTherapyNotice(product.facts);
    if (ongoingNotice) projection.notIncluded.push(`${productLabel(caseState, product)} — ${ongoingNotice}`);
    if (role.value === "suspect") {
      if (productType.value === "device") {
        if (!projection.sections.E.suspectDevice) {
          projection.sections.E.suspectDevice = projectDevice(product, projection);
          recordNonCarriedProductFacts(caseState, product, sectionEProductFields, "Section E", projection);
        } else {
          projection.notIncluded.push(`${productLabel(caseState, product)} is not included because this bounded path supports one suspect medical device.`);
        }
      } else {
        const target = projection.sections.D.suspectProducts;
        target.push(projectProduct(product, projection, target.length, productLabel(caseState, product)));
        recordNonCarriedProductFacts(caseState, product, [...sectionDProductFields, "doseReduced", "restarted", "improvedAfterChange", "recurred"], "Section D", projection);
      }
    } else {
      if (productType.value === "device") {
        projection.notIncluded.push(`${productLabel(caseState, product)} is a concomitant medical device and is not included because that reporting path is unsupported.`);
        recordNonCarriedProductFacts(caseState, product, [], "the unsupported concomitant-device path", projection);
        continue;
      }
      const target = projection.sections.F.concomitantProducts;
      target.push(projectConcomitantProduct(product, projection, target.length));
      recordNonCarriedProductFacts(caseState, product, sectionFProductFields, "Section F", projection);
    }
  }

  const quantityContext = quantityContextEntries(projection.sections.D.suspectProducts);
  if (quantityContext.length) {
    projection.sections.B.eventDescription = [projection.sections.B.eventDescription, ...quantityContext.map(entry => entry.text)].filter(Boolean).join("\n");
    projection.sourceTrace["sections.B.eventDescription"] = [...new Set([
      ...(projection.sourceTrace["sections.B.eventDescription"] ?? []),
      ...quantityContext.flatMap(entry => projection.sourceTrace[entry.path] ?? []),
    ])];
  }

  for (const field of ["lastName", "firstName", "address", "city", "state", "postalCode", "country", "phone", "email", "healthProfessional", "occupation", "reportedTo", "doNotDiscloseIdentity"] as const) {
    assign<unknown>(projection, `sections.G.reporter.${field}`, `reporter ${field}`, `reporter:reporter:${field}`, caseState.reporter.facts[field] as Fact<unknown>, projection.sections.G.reporter, field);
  }

  // Completeness boundary: selectors, prerequisites and unsupported whole facts
  // can bypass assign(). Their current context must still never disappear.
  const carriedQualifierTargets = new Set(["event:event:symptoms", "event:event:problemDescription", "event:event:treatments", "event:event:outcome", "event:event:dischargeDate", "event:event:relevantHistory"]);
  for (const product of projection.sections.D.suspectProducts) {
    for (const field of ["dose", "strength"]) carriedQualifierTargets.add(`product:${product.productId}:${field}`);
  }
  for (const entry of relevantTestContextEntries(caseState)) carriedQualifierTargets.add(entry.target);
  const disclosed = new Set(projection.omissions.filter(({ reason }) => reason === "qualifier-not-included").map(({ target }) => target));
  for (const { target, fact } of allFacts(caseState)) {
    const active = target.entity === "product" ? caseState.products.some(p => p.id === target.entityId && p.state === "resolved")
      : target.entity === "test" ? caseState.relevantTests.some(t => t.id === target.entityId && t.state === "resolved")
        : target.entity === "patient" ? caseState.patient.state === "resolved"
          : target.entity === "event" ? caseState.event.state === "resolved" : true;
    const key = targetKey(target);
    if (active && known(fact)?.qualifier && !carriedQualifierTargets.has(key) && !disclosed.has(key)) {
      recordQualifierOmission(projection, key, "reviewed context", fact, false);
    }
  }
  return projection;
}

function projectProduct(
  product: ProductEntity,
  projection: Form3500Projection,
  index: number,
  label: string,
): ProjectedProduct {
  const result: ProjectedProduct = { productId: product.id };
  const prefix = `sections.D.suspectProducts.${index}`;
  for (const field of sectionDProductFields) {
    assign<unknown>(projection, `${prefix}.${field}`, `${field} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field] as Fact<unknown>, result, field, (value) => field === "medicationType" ? ["brand", "generic-biosimilar", "otc", "compounded"].filter((label) => (value as string[]).includes(label))
      : field === "dose" || field === "strength" ? { value: String(value), ...(known(product.facts[field])?.qualifier !== undefined ? { qualifier: known(product.facts[field])!.qualifier } : {}) }
        : value, field === "dose" || field === "strength");
  }
  const choice = known(product.facts.d3Value);
  if (choice) {
    projection.sourceTrace[`${prefix}.d3Value`] = choice.sourceIds;
    for (const field of choice.value === "duration" ? d3DateFields : ["treatmentDuration"] as const) {
      delete result[field]; delete projection.sourceTrace[`${prefix}.${field}`];
      const fact = product.facts[field];
      if (known(fact as Fact<unknown>)) projection.omissions.push({concept:`${field} for ${product.id}`,target:`product:${product.id}:${field}`,reason:"d3-alternative-not-selected",sourceIds:fact.resolvedValue!.sourceIds});
      for (const item of projection.omissions) if (item.target === `product:${product.id}:${field}` && item.reason === "qualifier-not-included") item.baseValueIncluded = false;
    }
  }
  for (const [field, applies, prerequisites] of [
    ["improvedAfterChange", withdrawalApplicability(product.facts), [product.facts.stopped, product.facts.doseReduced]],
    ["recurred", restartApplicability(product.facts), [product.facts.restarted]],
  ] as const) {
    const outcome = product.facts[field];
    const path = `${prefix}.${field}`;
    const sources = [...new Set([...prerequisites.flatMap((fact) => fact.resolvedValue?.sourceIds ?? []), ...(outcome.resolvedValue?.sourceIds ?? [])])];
    if (field === "improvedAfterChange" && applies === false && known(product.facts.doseReductionDate)) {
      const conflictSources = [...new Set([...sources, ...product.facts.doseReductionDate.resolvedValue!.sourceIds])];
      projection.omissions.push({ concept: `D7 applicability for ${product.id}`, target: `product:${product.id}:improvedAfterChange`, reason: "reduction-date-conflict", sourceIds: conflictSources });
      projection.notIncluded.push(`${label} — D7 is left blank because the supplied dose-reduction date conflicts with the explicit no-stop/no-reduction answers. Wilson has not derived Does not apply or chosen an interpretation.`);
      continue;
    }
    if (applies === false) {
      result[field] = "inapplicable";
      projection.sourceTrace[path] = sources;
    } else if (applies === true && isSettled(outcome) && outcome.resolvedValue?.value.kind === "known") {
      result[field] = outcome.resolvedValue.value.value;
      recordQualifierOmission(projection, `product:${product.id}:${field}`, `${field} for ${product.id}`, outcome);
      projection.sourceTrace[path] = sources;
    } else {
      const unresolved = prerequisites.find((fact) => !isSettled(fact) || fact.resolvedValue?.value.kind !== "known");
      projection.omissions.push({ concept: `${field === "recurred" ? "Event recurrence after restart" : "Improvement after stopping or reducing"} for ${product.id}`,
        target: `product:${product.id}:${field}`, reason: omissionReason(applies === undefined && unresolved ? unresolved : outcome), sourceIds: sources });
      if (outcome.resolvedValue?.value.kind === "known") projection.notIncluded.push(`${product.id}: the reviewed ${field === "recurred" ? "recurrence" : "improvement"} answer is not included because its applicability is unresolved.`);
    }
  }
  return result;
}

function recordNonCarriedProductFacts(
  caseState: SemanticCase,
  product: ProductEntity,
  carried: readonly ProductFactKey[],
  destination: string,
  projection: Form3500Projection,
): void {
  const carriedFields = new Set<ProductFactKey>(carried);
  for (const [field, fact] of Object.entries(product.facts) as Array<[ProductFactKey, Fact<unknown>]>) {
    if (carriedFields.has(field) || productSelectorOrSharedFields.has(field) || !hasAcceptedKnowledge(fact)) continue;
    projection.notIncluded.push(
      `${productLabel(caseState, product)} — ${humanizeProductField(field)} remains in reviewed knowledge but is not included in ${destination} for the current product type and role.`,
    );
  }
}

function hasAcceptedKnowledge(fact: Fact<unknown>): boolean {
  return fact.state === "resolved" || fact.state === "conflicted" || fact.supersededValues.length > 0;
}

function productLabel(caseState: SemanticCase, product: ProductEntity): string {
  return productDisplayLabel(
    known(product.facts.name)?.value,
    caseState.products.findIndex(({ id }) => id === product.id) + 1,
  );
}

function humanizeProductField(field: ProductFactKey): string {
  if (field === "ndcOrUniqueId") return "NDC number or Unique ID";
  if (field === "udi") return "UDI";
  if (field === "procode") return "Procode";
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return `${spaced[0].toUpperCase()}${spaced.slice(1)}`;
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
  carriesQualifier = false,
): void {
  const resolved = known(fact);
  if (resolved) {
    (output as Record<string, unknown>)[key] = transform(resolved.value);
    projection.sourceTrace[path] = resolved.sourceIds;
    if (!carriesQualifier) recordQualifierOmission(projection, target, concept, fact);
    return;
  }
  projection.omissions.push({ concept, target, reason: omissionReason(fact), sourceIds: fact.sourceIds });
}

/** Partial output: keep the accepted qualifier distinct from a missing base value. */
function recordQualifierOmission(projection: Form3500Projection, target: string, concept: string, fact: Fact<unknown>, baseValueIncluded = true): void {
  const resolved = known(fact);
  if (resolved?.qualifier) projection.omissions.push({
    concept, target, reason: "qualifier-not-included", qualifier: resolved.qualifier, baseValueIncluded, sourceIds: resolved.sourceIds,
  });
}

function known<T>(fact: Fact<T>): { value: T; qualifier?: string; sourceIds: string[] } | undefined {
  return fact.state === "resolved" && fact.resolvedValue?.value.kind === "known"
    ? { value: fact.resolvedValue.value.value, qualifier: fact.resolvedValue.value.qualifier, sourceIds: fact.resolvedValue.sourceIds }
    : undefined;
}

function qualifiedText(text: string, qualifier?: string): string {
  return qualifier ? `${text} (${qualifier})` : text;
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
  append(caseState.event.facts.problemDescription, (value) => `Problem detail: ${qualifiedText(value, known(caseState.event.facts.problemDescription)?.qualifier)}.`);
  append(caseState.event.facts.symptoms, (value) => `Symptoms: ${qualifiedText(value.join(" and "), known(caseState.event.facts.symptoms)?.qualifier)}.`);
  append(caseState.event.facts.treatments, (value) => `Treatment: ${qualifiedText(value.join("; "), known(caseState.event.facts.treatments)?.qualifier)}.`);
  append(caseState.event.facts.outcome, (value) => `Outcome: ${qualifiedText(value, known(caseState.event.facts.outcome)?.qualifier)}.`);
  append(caseState.event.facts.dischargeDate, (value) => `Discharged ${qualifiedText(displayDate(value), known(caseState.event.facts.dischargeDate)?.qualifier)}.`);
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

/** Formatting only: full accepted quantities/context linked to actual suspect slots. */
export function quantityContextEntries(products: ProjectedProduct[]) {
  return products.flatMap((product, index) => (["dose", "strength"] as const).flatMap(field => {
    const quantity = product[field];
    return quantity?.qualifier !== undefined ? [{
      text: `Suspect product #${index + 1} ${field}: ${quantity.value} (${quantity.qualifier}).`,
      path: `sections.D.suspectProducts.${index}.${field}`,
      target: `product:${product.productId}:${field}`,
    }] : [];
  }));
}

/** Quantity context alone must not satisfy the existing event-description gate. */
export function hasBaseEventDescription(caseState: SemanticCase): boolean {
  return buildEventDescription(caseState).value !== undefined;
}

export function baseEventDescription(caseState: SemanticCase): string | undefined {
  return buildEventDescription(caseState).value;
}

/** Exact contributors to the existing base narrative, independent of quantity notes. */
export function baseEventDescriptionTargets(caseState: SemanticCase): string[] {
  return [
    ...(["problemDescription", "symptoms", "treatments", "outcome", "dischargeDate"] as const)
      .filter(field => known<unknown>(caseState.event.facts[field]) !== undefined)
      .map(field => `event:event:${field}`),
    ...caseState.products.filter(product => product.state === "resolved" && known(product.facts.name) !== undefined && known(product.facts.stopped)?.value === true)
      .flatMap(product => [`product:${product.id}:name`, `product:${product.id}:stopped`]),
  ];
}

/** Native B6 table row order, not display ordinals or inferred test identity. */
export function relevantTestContextEntries(caseState: SemanticCase) {
  const labels = { testName: "Test name", testResult: "Result and stated units", lowRange: "Lower reference limit", highRange: "Upper reference limit", date: "Test date" } as const;
  return caseState.relevantTests.filter(test => test.state === "resolved").flatMap((test, index) =>
    (Object.keys(labels) as Array<keyof typeof labels>).flatMap(field => {
      const fact = known(test.facts[field]);
      return fact?.qualifier ? [{ text: `B6 table row ${index + 1} - ${labels[field]} context: ${fact.qualifier}`, target: `test:${test.id}:${field}`, sourceIds: fact.sourceIds, testId: test.id }] : [];
    }));
}
