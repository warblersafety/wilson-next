import {eventDateLabels,deviceDateFields,productDateFields,productDateLabels,isPartialDate,suppliedDateText,type ProductDateField} from "./date-precision";
import {isPartialExpiration,expirationText,type PartialExpiration} from "./expiration";
import { isCalendarDateTarget, knownValueMismatch } from "./value-contract";
import { formatCompleteCalendarDate, isCompleteCalendarDate } from "./calendar-date";
import { otherProductTypeValues, type OtherProductType } from "./other-product-types";
import { listWithContext } from "./list-context";
import { noPatientConflictingTargets, noPatientOutcomeConflictingTargets } from "./patient-involvement";
import {purchaseDetailFields,purchaseDetailLabels,purchaseCountryLabel} from "./purchase-details";
import { d3DateFields, type TreatmentDuration } from "./duration";
import { raceEthnicityOptions, type RaceEthnicity } from "./race-ethnicity";
import type { PatientAge } from "./age";
import { allFacts, targetKey } from "./facts";
import { doseReductionDateNotice, ongoingTherapyNotice, isSettled, restartApplicability, withdrawalApplicability } from "./medication";
import { productDisplayLabel } from "./product-label";
import type { Fact, ProductEntity, ProductFactKey, ReportType, SemanticCase } from "./types";

const sectionDProductFields = ["name", "manufacturer", "lotNumber", "ndcOrUniqueId", "expirationDate", "purchaseDate", ...purchaseDetailFields, "dose", "strength", "frequency", "route", "startDate", "stopDate", "therapyOngoing", "doseReductionDate", "treatmentDuration", "indication", "medicationType", "cosmeticUse", "otherProductTypes"] as const satisfies readonly ProductFactKey[];
const sectionEProductFields = ["name", "commonName", "procode", "manufacturer", "modelNumber", "lotNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"] as const satisfies readonly ProductFactKey[];
const sectionFProductFields = ["name", "startDate", "stopDate"] as const satisfies readonly ProductFactKey[];
/** Existing medication facts retained as exact Section F supplement text, never inferred. */
export const concomitantMedicationFields = ["dose", "strength", "frequency", "route", "indication", "therapyOngoing", "doseReductionDate", "treatmentDuration", "stopped", "doseReduced", "improvedAfterChange", "restarted", "recurred"] as const satisfies readonly ProductFactKey[];
export type ConcomitantMedicationField = typeof concomitantMedicationFields[number];
export const concomitantMedicationLabels: Record<ConcomitantMedicationField,string> = {dose:"Dose",strength:"Strength",frequency:"Frequency",route:"Route",indication:"Indication",therapyOngoing:"Therapy/usage still ongoing",doseReductionDate:"Dose reduction date",treatmentDuration:"Stated duration",stopped:"Stopped",doseReduced:"Dose reduced",improvedAfterChange:"Improved after stopping or reducing",restarted:"Restarted",recurred:"Event returned after restarting"};
const productSelectorOrSharedFields = new Set<ProductFactKey>(["productType", "role", "stopped"]);

export interface ProjectionOmission {
  concept: string;
  target: string;
  reason: "empty" | "unknown" | "explicitly-absent" | "inapplicable" | "declined" | "conflicted" | "qualifier-not-included" | "a2-alternative-not-selected" | "reduction-date-conflict" | "d3-alternative-not-selected";
  qualifier?: string;
  baseValueIncluded?: boolean;
  sourceIds: string[];
}

export interface Form3500Projection {
  /** Export metadata for linking detached continuation pages; never a clinical assertion. */
  caseId: string;
  revision: number;
  sections: {
    A: { patientIdentifier?: string; ageYears?: PatientAge; dateOfBirth?: string; dateOfBirthInComments?: boolean; raceEthnicity?: RaceEthnicity[]; sex?: "female" | "male" | "intersex"; sexContext?: string; weight?: { value: number; unit: "kg" | "lb" } };
    B: {
      reportType?: ReportType;
      reportDate?: string;
      eventDate?: string;
      eventDateInDescription?: boolean;
      eventDescription?: string;
      hospitalized?: boolean;
      death?: boolean;
      deathDate?: string;
      deathDateInDescription?: boolean;
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
      productReturnDateInComments?: boolean;
    };
    D: { suspectProducts: ProjectedProduct[] };
    E: { suspectDevices: ProjectedDevice[] };
    F: { concomitantProducts: ProjectedConcomitantProduct[] };
    G: { reporter: ProjectedReporter };
  };
  concomitantMedicationNotes?: {productId:string;ordinal:number;field:ConcomitantMedicationField;text:string;sourceIds:string[]}[];
  productDateNotes?: {productId:string;field:ProductDateField;block:"D1"|"D3"|"E6a"|"E6b"|"F1";ordinal:number;text:string;sourceIds:string[]}[];
  expirationNotes?: {productId:string;block:"D6"|"E4"|"F1";ordinal:number;text:string;sourceIds:string[]}[];
  invalidCalendarDates?: { target: string; value: string }[];
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
  dateInComments?: boolean;
}

export const reporterTextFields = ["lastName","firstName","address","city","state","postalCode","country","phone","email"] as const;
export type ReporterTextField = typeof reporterTextFields[number];
export interface ProjectedReporter {
  fieldContext?: {field:ReporterTextField;text:string}[];
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
  purchaseDate?: string;
  purchaseSellerName?: string;
  purchaseSellerAddress?: string;
  purchaseSellerCity?: string;
  purchaseSellerRegion?: string;
  purchaseSellerPostalCode?: string;
  purchaseSellerCountry?: string;
  purchaseWebsite?: string;

  expirationDate?: string;
  dose?: ProjectedQuantity;
  strength?: ProjectedQuantity;
  d2Context?: Array<{ field: "route" | "frequency"; text: string }>;
  frequency?: string;
  route?: string;
  startDate?: string;
  stopDate?: string;
  therapyOngoing?: boolean;
  doseReductionDate?: string;
  treatmentDuration?: TreatmentDuration;
  durationContext?: string;
  indication?: string;
  cosmeticUse?: "professional-use-only" | "retail";
  otherProductTypes?: OtherProductType[];
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
  /** Exact current field qualifiers; rendered in labelled Section F continuation. */
  fieldContext?: {field: "name" | "startDate" | "stopDate"; text: string}[];
  name?: string;
  startDate?: string;
  stopDate?: string;
}

export function projectForm3500(caseState: SemanticCase): Form3500Projection {
  const projection: Form3500Projection = {
    caseId: caseState.id,
    revision: caseState.revision,
    sections: { A: {}, B: { relevantTests: [] }, C: {}, D: { suspectProducts: [] }, E: { suspectDevices: [] }, F: { concomitantProducts: [] }, G: { reporter: {} } },
    invalidCalendarDates: allFacts(caseState).flatMap(({target, fact}) => {
      if (target.entity === "product" && !caseState.products.some(p => p.id === target.entityId && p.state === "resolved")) return [];
      if (target.entity === "test" && !caseState.relevantTests.some(t => t.id === target.entityId && t.state === "resolved")) return [];
      const value = known(fact)?.value;
      return isCalendarDateTarget(target) && value !== undefined && knownValueMismatch(target,{kind:"known",value})
        ? [{target: targetKey(target), value: String(value)}] : [];
    }),
    expirationNotes: [],
    productDateNotes: [],
    sourceTrace: {},
    omissions: [],
    notIncluded: [
      "Patient fractional or compound ages and partial date of birth",
      "Patient race/ethnicity detail outside the seven A5 categories",
      "Section C product pictures",
      "Expiration precision outside complete dates or explicit month/year and year-only wording; purchase wording outside supported precision and native country/glyph/line/capacity limits",
      "Product date wording outside complete dates or explicit month/year/year-only precision",
    ],
  };

  assign(projection, "sections.A.patientIdentifier", "patient identifier", "patient:patient:identifier", caseState.patient.facts.identifier, projection.sections.A, "patientIdentifier");
  const involvement: { value?: "present" | "none" } = {};
  assign(projection, "sections.A.patientInvolvement", "patient involvement", "patient:patient:involvement", caseState.patient.facts.involvement, involvement, "value");
  if (involvement.value === "none" && noPatientConflictingTargets(caseState).length === 0
    && noPatientOutcomeConflictingTargets(caseState).length === 0) {
    // FDA A1: literal none only from accepted explicit no-patient participation.
    projection.sections.A.patientIdentifier = "none";
    projection.sourceTrace["sections.A.patientIdentifier"] = known(caseState.patient.facts.involvement)!.sourceIds;
  }
  assign(projection, "sections.A.ageYears", "patient age", "patient:patient:ageYears", caseState.patient.facts.ageYears, projection.sections.A, "ageYears");
  const dob = known(caseState.patient.facts.dateOfBirth);
  if(dob && isPartialDate(dob.value)){projection.sections.A.dateOfBirthInComments=true;projection.sourceTrace["sections.A.dateOfBirthInComments"]=dob.sourceIds;}
  else assign(projection, "sections.A.dateOfBirth", "patient date of birth", "patient:patient:dateOfBirth", caseState.patient.facts.dateOfBirth, projection.sections.A, "dateOfBirth",value=>value as string,true);
  const a2Choice = known(caseState.patient.facts.a2Value);
  if (a2Choice) {
    projection.sourceTrace["sections.A.a2Value"] = a2Choice.sourceIds;
    const unselected = a2Choice.value === "age" ? "dateOfBirth" : "ageYears";
    const omitted = known<unknown>(caseState.patient.facts[unselected]);
    delete projection.sections.A[unselected];
    if(unselected === "dateOfBirth"){delete projection.sections.A.dateOfBirthInComments;delete projection.sourceTrace["sections.A.dateOfBirthInComments"];}
    delete projection.sourceTrace[`sections.A.${unselected}`];
    if (omitted) projection.omissions.push({ concept: unselected === "ageYears" ? "patient age" : "patient date of birth", target: `patient:patient:${unselected}`, reason: "a2-alternative-not-selected", sourceIds: omitted.sourceIds });
    for (const item of projection.omissions) if (item.target === `patient:patient:${unselected}` && item.reason === "qualifier-not-included") item.baseValueIncluded = false;
  }
  assign(projection, "sections.A.raceEthnicity", "patient race and/or ethnicity", "patient:patient:raceEthnicity", caseState.patient.facts.raceEthnicity, projection.sections.A, "raceEthnicity", values => raceEthnicityOptions.filter(option => values.includes(option.value)).map(option => option.value));
  assign(projection, "sections.A.sex", "patient sex", "patient:patient:sex", caseState.patient.facts.sex, projection.sections.A, "sex", value => value, true);
  const suppliedSex = known(caseState.patient.facts.sex);
  if (suppliedSex?.qualifier) projection.sections.A.sexContext = suppliedSex.qualifier;
  assign(projection, "sections.A.weight", "patient weight", "patient:patient:weight", caseState.patient.facts.weight, projection.sections.A, "weight");
  assign(projection, "sections.B.reportType", "report type", "event:event:reportType", caseState.event.facts.reportType, projection.sections.B, "reportType");
  const onset=known(caseState.event.facts.onsetDate);
  if(onset&&isPartialDate(onset.value)) projection.sections.B.eventDateInDescription=true;
  else assign(projection, "sections.B.eventDate", "event date", "event:event:onsetDate", caseState.event.facts.onsetDate, projection.sections.B, "eventDate", value=>value as string);
  assign(projection, "sections.B.reportDate", "date of this report", "event:event:reportDate", caseState.event.facts.reportDate, projection.sections.B, "reportDate");
  assign(projection, "sections.B.hospitalized", "hospitalization outcome", "event:event:hospitalized", caseState.event.facts.hospitalized, projection.sections.B, "hospitalized");
  for (const field of ["death", "lifeThreatening", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    assign(projection, `sections.B.${field}`, `${field} outcome`, `event:event:${field}`, caseState.event.facts[field], projection.sections.B, field);
  }
  if (known(caseState.event.facts.death)?.value === true) {
    const deathDate=known(caseState.event.facts.deathDate);
    if(deathDate&&isPartialDate(deathDate.value))projection.sections.B.deathDateInDescription=true;
    else assign(projection, "sections.B.deathDate", "death date", "event:event:deathDate", caseState.event.facts.deathDate, projection.sections.B, "deathDate", value=>value as string);
  }
  if(known(caseState.event.facts.death)?.value!==true && known(caseState.event.facts.deathDate)){projection.notIncluded.push("Death date remains in the case but is not printed because B2 death is not explicitly selected.");projection.omissions.push({concept:"death date",target:"event:event:deathDate",reason:"inapplicable",sourceIds:caseState.event.facts.deathDate.sourceIds});}
  assign(projection, "sections.B.relevantHistory", "relevant medical history", "event:event:relevantHistory", caseState.event.facts.relevantHistory, projection.sections.B, "relevantHistory", value => known(caseState.event.facts.relevantHistory)?.qualifier ? `${value}\nHistory context: ${known(caseState.event.facts.relevantHistory)!.qualifier}` : value, true);
  assign(projection, "sections.C.productAvailability", "product availability", "event:event:productAvailability", caseState.event.facts.productAvailability, projection.sections.C, "productAvailability");
  if (known(caseState.event.facts.productAvailability)?.value === "returned-to-manufacturer") {
    const date=known(caseState.event.facts.productReturnDate);
    if(date&&isPartialDate(date.value))projection.sections.C.productReturnDateInComments=true;
    else assign(projection, "sections.C.productReturnDate", "product return date", "event:event:productReturnDate", caseState.event.facts.productReturnDate, projection.sections.C, "productReturnDate",value=>value as string,true);
  }
  if(known(caseState.event.facts.productAvailability)?.value!=="returned-to-manufacturer"&&known(caseState.event.facts.productReturnDate)){
    projection.notIncluded.push("Product return date remains in the case but is not printed because return to manufacturer is not explicitly selected.");
    projection.omissions.push({concept:"product return date",target:"event:event:productReturnDate",reason:"inapplicable",sourceIds:caseState.event.facts.productReturnDate.sourceIds});
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
    for (const field of ["lowRange", "highRange"] as const) {
      assign(projection, `sections.B.relevantTests.${index}.${field}`, `${field} for ${test.id}`, `test:${test.id}:${field}`, test.facts[field], result, field, value => value, true);
    }
    const date=known(test.facts.date);
    if(date && isPartialDate(date.value)) result.dateInComments=true;
    else assign(projection,`sections.B.relevantTests.${index}.date`,`date for ${test.id}`,`test:${test.id}:date`,test.facts.date,result,"date",value=>value as string,true);
    projection.sections.B.relevantTests.push(result);
  }
  const testContext = additionalCommentsEntries(caseState);
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

  // Narrative boxes can contain other facts even when one of these is not
  // carried. Disclose that individual omission, including unresolved conflict.
  for (const [field, concept] of [["symptoms", "symptoms"], ["problemDescription", "product problem"], ["treatments", "treatment"], ["outcome", "event outcome"], ["dischargeDate", "discharge date"], ["additionalComments", "additional comments"]] as const) {
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
        projection.sections.E.suspectDevices.push(projectDevice(product, projection, projection.sections.E.suspectDevices.length));
        recordNonCarriedProductFacts(caseState, product, sectionEProductFields, "Section E", projection);
      } else {
        const target = projection.sections.D.suspectProducts;
        target.push(projectProduct(product, projection, target.length, productLabel(caseState, product)));
        recordNonCarriedProductFacts(caseState, product, [...sectionDProductFields, "d3Value", "doseReduced", "restarted", "improvedAfterChange", "recurred"], "Section D", projection);
      }
    } else {
      const target = projection.sections.F.concomitantProducts;
      const projected = projectConcomitantProduct(product, projection, target.length);
      target.push(projected);
      recordNonCarriedProductFacts(caseState, product, [...sectionFProductFields,...(projection.concomitantMedicationNotes??[]).filter(d=>d.productId===product.id).map(d=>d.field)], "Section F", projection);
    }
  }

  for(const product of caseState.products.filter(p=>p.state==="resolved")) {
    const value=known(product.facts.expirationDate);if(!value||!isPartialExpiration(value.value))continue;
    const d=projection.sections.D.suspectProducts.findIndex(p=>p.productId===product.id),e=projection.sections.E.suspectDevices.findIndex(p=>p.productId===product.id),f=projection.sections.F.concomitantProducts.findIndex(p=>p.productId===product.id);
    const block:"D6"|"E4"|"F1"|undefined=d>=0?"D6":e>=0?"E4":f>=0?"F1":undefined;if(!block)continue;
    const note={productId:product.id,block,ordinal:(d>=0?d:e>=0?e:f)+1,text:expirationText(value.value,value.qualifier),sourceIds:value.sourceIds};
    const index=projection.expirationNotes!.push(note)-1;projection.sourceTrace[`expirationNotes.${index}`]=value.sourceIds;
    projection.omissions=projection.omissions.filter(o=>o.target!==`product:${product.id}:expirationDate`);
    if(d>=0){delete projection.sections.D.suspectProducts[d].expirationDate;delete projection.sourceTrace[`sections.D.suspectProducts.${d}.expirationDate`];}
    if(e>=0){delete projection.sections.E.suspectDevices[e].expirationDate;delete projection.sourceTrace[`sections.E.suspectDevices.${e}.expirationDate`];}
  }
  for(const product of caseState.products.filter(p=>p.state==="resolved")) {
    const e=projection.sections.E.suspectDevices.findIndex(p=>p.productId===product.id),d=projection.sections.D.suspectProducts.findIndex(p=>p.productId===product.id),f=projection.sections.F.concomitantProducts.findIndex(p=>p.productId===product.id);
    for(const field of [...productDateFields,...deviceDateFields]) {
      const value=known(product.facts[field]);if(!value||!isPartialDate(value.value))continue;
      const destination=e>=0?projection.sections.E.suspectDevices[e]:d>=0?projection.sections.D.suspectProducts[d]:f>=0?projection.sections.F.concomitantProducts[f]:undefined;
      // The native projection already applied D3 print-choice/applicability. Never restore a suppressed alternative.
      if(!destination || !(field in destination))continue;
      const block=e>=0?(field==='implantDate'?'E6a':'E6b'):d>=0?(field==='purchaseDate'?'D1':'D3'):'F1',ordinal=(e>=0?e:d>=0?d:f)+1;
      const note={productId:product.id,field,block: block as "D1"|"D3"|"E6a"|"E6b"|"F1",ordinal,text:suppliedDateText(value.value,productDateLabels[field].toLowerCase(),value.qualifier),sourceIds:value.sourceIds};
      const i=projection.productDateNotes!.push(note)-1;projection.sourceTrace[`productDateNotes.${i}`]=value.sourceIds;
      delete (destination as unknown as Record<string,unknown>)[field];delete projection.sourceTrace[`sections.${e>=0?'E.suspectDevices':d>=0?'D.suspectProducts':'F.concomitantProducts'}.${e>=0?e:d>=0?d:f}.${field}`];
      projection.omissions=projection.omissions.filter(o=>o.target!==`product:${product.id}:${field}`);
      if(f>=0) projection.sections.F.concomitantProducts[f].fieldContext=projection.sections.F.concomitantProducts[f].fieldContext?.filter(c=>c.field!==field);
    }
  }
  const quantityContext = [...quantityContextEntries(projection.sections.D.suspectProducts), ...d5OtherTypeContextEntries(caseState, projection), ...deviceContextEntries(caseState, projection), ...eventDateContextEntries(caseState)];
  if (quantityContext.length) {
    projection.sections.B.eventDescription = [projection.sections.B.eventDescription, ...quantityContext.map(entry => entry.text)].filter(Boolean).join("\n");
    projection.sourceTrace["sections.B.eventDescription"] = [...new Set([
      ...(projection.sourceTrace["sections.B.eventDescription"] ?? []),
      ...quantityContext.flatMap(entry => "path" in entry ? projection.sourceTrace[entry.path] ?? [] : entry.sourceIds),
    ])];
  }

  for (const field of ["lastName", "firstName", "address", "city", "state", "postalCode", "country", "phone", "email", "healthProfessional", "occupation", "reportedTo", "doNotDiscloseIdentity"] as const) {
    assign<unknown>(projection, `sections.G.reporter.${field}`, `reporter ${field}`, `reporter:reporter:${field}`, caseState.reporter.facts[field] as Fact<unknown>, projection.sections.G.reporter, field, value=>value, (reporterTextFields as readonly string[]).includes(field));
    if ((reporterTextFields as readonly string[]).includes(field)) { const value=known(caseState.reporter.facts[field] as Fact<unknown>); if(value?.qualifier)(projection.sections.G.reporter.fieldContext??=[]).push({field:field as ReporterTextField,text:value.qualifier}); }
  }

  // Completeness boundary: selectors, prerequisites and unsupported whole facts
  // can bypass assign(). Their current context must still never disappear.
  const carriedQualifierTargets = new Set(["patient:patient:sex", "event:event:symptoms", "event:event:problemDescription", "event:event:treatments", "event:event:outcome", "event:event:dischargeDate", "event:event:relevantHistory", "event:event:additionalComments"]);
  for (const product of projection.sections.D.suspectProducts) {
    for (const field of ["dose", "strength", "route", "frequency"]) carriedQualifierTargets.add(`product:${product.productId}:${field}`);
    if(product.treatmentDuration)carriedQualifierTargets.add(`product:${product.productId}:treatmentDuration`);
  }
  for (const entry of d5OtherTypeContextEntries(caseState, projection)) carriedQualifierTargets.add(entry.target);
  for (const entry of deviceContextEntries(caseState, projection)) carriedQualifierTargets.add(entry.target);
  for (const product of projection.sections.F.concomitantProducts) for (const context of product.fieldContext ?? []) carriedQualifierTargets.add(`product:${product.productId}:${context.field}`);
  for(const detail of projection.concomitantMedicationNotes??[])carriedQualifierTargets.add(`product:${detail.productId}:${detail.field}`);
  for (const context of projection.sections.G.reporter.fieldContext??[]) carriedQualifierTargets.add(`reporter:reporter:${context.field}`);
  for (const entry of eventDateContextEntries(caseState))carriedQualifierTargets.add(entry.target);
  for (const entry of birthDateContextEntries(caseState))carriedQualifierTargets.add(entry.target);
  for (const entry of returnDateContextEntries(caseState))carriedQualifierTargets.add(entry.target);
  for (const entry of relevantTestContextEntries(caseState)) carriedQualifierTargets.add(entry.target);
  for(const note of projection.productDateNotes??[])carriedQualifierTargets.add(`product:${note.productId}:${note.field}`);
  for(const note of projection.expirationNotes??[])carriedQualifierTargets.add(`product:${note.productId}:expirationDate`);
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
      : field === "otherProductTypes" ? otherProductTypeValues.filter(label => (value as string[]).includes(label))
      : field === "purchaseSellerCountry" ? purchaseCountryLabel(String(value)) ?? value
      : field === "dose" || field === "strength" ? { value: String(value), ...(known(product.facts[field])?.qualifier !== undefined ? { qualifier: known(product.facts[field])!.qualifier } : {}) }
        : value, field === "dose" || field === "strength" || field === "otherProductTypes" || field === "route" || field === "frequency" || field === "treatmentDuration");
  }
  for (const field of ["route", "frequency"] as const) {
    const value = known(product.facts[field]);
    if (value?.qualifier) (result.d2Context ??= []).push({ field, text: value.qualifier });
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
  if(result.treatmentDuration) {const value=known(product.facts.treatmentDuration);if(value?.qualifier)result.durationContext=value.qualifier;}
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
    if (field === "expirationDate" && isPartialExpiration(known(fact)?.value)) continue;
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
  if ((purchaseDetailFields as readonly string[]).includes(field)) return purchaseDetailLabels[field as keyof typeof purchaseDetailLabels];
  if (field === "otherProductTypes") return "Other D5 product types";
  if (field === "cosmeticUse") return "Cosmetic product type";
  if (field === "udi") return "UDI";
  if (field === "procode") return "Procode";
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return `${spaced[0].toUpperCase()}${spaced.slice(1)}`;
}

function projectDevice(product: ProductEntity, projection: Form3500Projection, index: number): ProjectedDevice {
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
    assign<unknown>(projection, `sections.E.suspectDevices.${index}.${output}`, `${output} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field] as Fact<unknown>, result, output, value => value, true);
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
    assign(projection, `${prefix}.${field}`, `${field} for ${product.id}`, `product:${product.id}:${field}`, product.facts[field], result, field, value => value, true);
    const value = known(product.facts[field]);
    if (value?.qualifier) (result.fieldContext ??= []).push({field, text:value.qualifier});
  }
  if(known(product.facts.productType)?.value === "drug-or-biologic") {
    for(const field of concomitantMedicationFields) {
      const fact=product.facts[field];
      if(fact.state!=="resolved" || !fact.resolvedValue)continue;
      // Labels for temporal outcomes require the same explicit prerequisites as D7/D8.
      // Withheld answers remain reviewed knowledge with the existing non-carried disclosure.
      if(field === "improvedAfterChange" && withdrawalApplicability(product.facts) !== true)continue;
      if(field === "recurred" && restartApplicability(product.facts) !== true)continue;
      const value=fact.resolvedValue.value;
      let text:string;
      if(value.kind!=="known")text=({unknown:"Unknown",declined:"Declined","explicitly-absent":"Explicitly absent",inapplicable:"Does not apply"} as const)[value.kind];
      else {
        const raw=value.value;
        if(field === "doseReductionDate" && isPartialDate(raw))text=suppliedDateText(raw,concomitantMedicationLabels[field]);
        else if(field === "doseReductionDate" && isCompleteCalendarDate(raw))text=formatCompleteCalendarDate(raw);
        else if(typeof raw==="boolean")text=raw?"Yes":"No";
        else if(typeof raw==="string"||typeof raw==="number")text=String(raw);
        else if(raw && typeof raw==="object" && "wording" in raw)text=String(raw.wording);
        else if(raw && typeof raw==="object" && "value" in raw && "unit" in raw)text=`${raw.value} ${raw.unit}`;
        else throw new Error("Unsupported accepted concomitant medication value");
        if(value.qualifier)text+=`\nContext: ${value.qualifier}`;
      }
      const sourceIds=[...fact.resolvedValue.sourceIds];
      (projection.concomitantMedicationNotes??=[]).push({productId:product.id,ordinal:index+1,field,text,sourceIds});
      projection.sourceTrace[`concomitantMedicationNotes.${projection.concomitantMedicationNotes.length-1}`]=sourceIds;
    }
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
  append(caseState.event.facts.symptoms, (value) => `Symptoms: ${listWithContext(value.join(" and "), known(caseState.event.facts.symptoms)?.qualifier, "Symptoms list context")}.`);
  append(caseState.event.facts.treatments, (value) => `Treatment: ${listWithContext(value.join("; "), known(caseState.event.facts.treatments)?.qualifier, "Treatment list context")}.`);
  append(caseState.event.facts.outcome, (value) => `Outcome: ${qualifiedText(value, known(caseState.event.facts.outcome)?.qualifier)}.`);
  append(caseState.event.facts.dischargeDate, (value) => isPartialDate(value)?`B5 discharge date wording:\n${suppliedDateText(value,"discharge date",known(caseState.event.facts.dischargeDate)?.qualifier)}`:`Discharged ${qualifiedText(displayDate(value), known(caseState.event.facts.dischargeDate)?.qualifier)}.`);
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
  if (!isCompleteCalendarDate(value)) return value;
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
      if(field==="date" && fact && isPartialDate(fact.value))return [{text:`B6 table row ${index+1} - Test date wording:\n${suppliedDateText(fact.value,"test date",fact.qualifier)}`,target:`test:${test.id}:date`,sourceIds:fact.sourceIds,testId:test.id}];
      return fact?.qualifier ? [{ text: `B6 table row ${index + 1} - ${labels[field]} context: ${fact.qualifier}`, target: `test:${test.id}:${field}`, sourceIds: fact.sourceIds, testId: test.id }] : [];
    }));
}

/** Native AdditionalComments combines labelled general comments with independent test context. */
export function additionalCommentsEntries(caseState: SemanticCase) {
  const comment = known(caseState.event.facts.additionalComments);
  return [
    ...relevantTestContextEntries(caseState),
    ...returnDateContextEntries(caseState),
    ...birthDateContextEntries(caseState),
    ...(comment ? [{ text: `Additional comments: ${comment.value}${comment.qualifier ? `\nAdditional comments context: ${comment.qualifier}` : ""}`, target: "event:event:additionalComments", sourceIds: comment.sourceIds, testId: undefined }] : []),
  ];
}

/** Exact accepted D5 list context, linked to the current stable product/native slot. */
export function d5OtherTypeContextEntries(caseState: SemanticCase, projection: Form3500Projection) {
  return projection.sections.D.suspectProducts.flatMap((product, index) => {
    const fact = caseState.products.find(p => p.id === product.productId)?.facts.otherProductTypes;
    const value = fact && known(fact);
    return product.otherProductTypes && value?.qualifier ? [{
      text: `Suspect product #${index + 1} D5 Other product types context: ${value.qualifier}`,
      target: `product:${product.productId}:otherProductTypes`, sourceIds: value.sourceIds,
    }] : [];
  });
}

/** Exact field-linked context for current native E devices; never a clinical inference. */
export function deviceContextEntries(caseState: SemanticCase, projection: Form3500Projection) {
  return projection.sections.E.suspectDevices.flatMap((device, index) => {
    const product = caseState.products.find(p => p.id === device.productId);
    return product ? sectionEProductFields.flatMap(field => {
      const value = known(product.facts[field] as Fact<unknown>);
      if(value && isPartialExpiration(value.value) && (field === "expirationDate" || deviceDateFields.includes(field as typeof deviceDateFields[number]))) return [];
      return value?.qualifier ? [{ text: `Suspect device #${index+1} Section E ${humanizeProductField(field)} context: ${value.qualifier}`, target: `product:${product.id}:${field}`, sourceIds: value.sourceIds }] : [];
    }) : [];
  });
}

/** Supplemental date wording does not replace substantive event description. */
export function eventDateContextEntries(caseState:SemanticCase){
 return (["onsetDate","deathDate"] as const).flatMap(field=>{const fact=known(caseState.event.facts[field]);if(!fact||(field==="deathDate"&&known(caseState.event.facts.death)?.value!==true))return [];const block=field==="onsetDate"?"B3":"B2";return isPartialDate(fact.value)||fact.qualifier?[{text:isPartialDate(fact.value)?`${block} ${eventDateLabels[field].toLowerCase()} wording:\n${suppliedDateText(fact.value,eventDateLabels[field].toLowerCase(),fact.qualifier)}`:`${block} ${eventDateLabels[field].toLowerCase()} context: ${fact.qualifier}`,target:`event:event:${field}`,sourceIds:fact.sourceIds}]:[];});
}

/** C1 date alone does not establish return or individual-product attribution. */
export function returnDateContextEntries(caseState: SemanticCase) {
  const date = known(caseState.event.facts.productReturnDate);
  if (!date || known(caseState.event.facts.productAvailability)?.value !== "returned-to-manufacturer") return [];
  const text = isPartialDate(date.value)
    ? `C1 product return date wording:\n${suppliedDateText(date.value, "product return date", date.qualifier)}`
    : date.qualifier ? `C1 product return date context: ${date.qualifier}` : undefined;
  return text ? [{ text, target: "event:event:productReturnDate", sourceIds: date.sourceIds, testId: undefined }] : [];
}

/** A2 selection suppresses the unselected DOB, without deriving age or erasing facts. */
export function birthDateContextEntries(caseState: SemanticCase) {
  const date = known(caseState.patient.facts.dateOfBirth);
  if (!date || known(caseState.patient.facts.a2Value)?.value === "age") return [];
  const text = isPartialDate(date.value)
    ? `A2 date of birth wording:\n${suppliedDateText(date.value, "date of birth", date.qualifier)}`
    : date.qualifier ? `A2 date of birth context: ${date.qualifier}` : undefined;
  return text ? [{ text, target: "patient:patient:dateOfBirth", sourceIds: date.sourceIds, testId: undefined }] : [];
}
