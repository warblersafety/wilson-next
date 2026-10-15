import { isTreatmentDuration, durationNativeUnits, durationNativeLabels } from "../../domain/case/duration";
import { durationLimitation } from "./duration";
import { isCompleteCalendarDate } from "../../domain/case/calendar-date";
import { raceEthnicityOptions, isRaceEthnicitySelections } from "../../domain/case/race-ethnicity";
import { isCompleteBirthDate } from "../../domain/case/birth-date";
import { patientAgeParts, type PatientAge } from "../../domain/case/age";
import { patientAgeLimitation } from "./patient-age";
import { createHash } from "node:crypto";
import { maximumForm3500ConcomitantProducts, maximumForm3500SuspectProducts } from "../../domain/case/limits";
import { PDFDocument, PDFName } from "@cantoo/pdf-lib";
import { encodeForm3500Frequency, encodeForm3500Route, productTextLimitation } from "./product-text";
import { testHistoryLimitations } from "./test-history";
import { quantityParts, quantityLimitation, eventNarrativeLimitation } from "./quantity";
import type {
  Form3500Projection,
  ProjectedConcomitantProduct,
  ProjectedProduct,
  ProjectedQuantity,
} from "../../domain/case/projection";

export const FORM_3500_VERSION = "09/2025";
export const FORM_3500_PAGE_COUNT = 8;
export const FORM_3500_SHA256 =
  "1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c";

const fields = {
  reportDate: "topmostSubform[0].Page1[0].SecA_Patient[0].ReportDate[0]",
  patientIdentifier:
    "topmostSubform[0].Page1[0].SecA_Patient[0].PatientIdentifier[0]",
  dateOfBirth: "topmostSubform[0].Page1[0].SecA_Patient[0].DateBirth[0]",
  ageValue: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeValue[0]",
  ageYears: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeYears[0]",
  ageMonths: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeMonths[0]",
  ageWeeks: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeWeeks[0]",
  ageDays: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeDays[0]",
  sexMale: "topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]",
  sexFemale: "topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]",
  weightValue: "topmostSubform[0].Page1[0].SecA_Patient[0].WeightValue[0]",
  weightLb: "topmostSubform[0].Page1[0].SecA_Patient[0].WeightLB[0]",
  weightKg: "topmostSubform[0].Page1[0].SecA_Patient[0].WeightKG[0]",
  adverseEvent: "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]",
  productProblem: "topmostSubform[0].Page1[0].SecA_Patient[0].Defects[0]",
  hospitalized: "topmostSubform[0].Page1[0].SecA_Patient[0].Hospital[0]",
  death: "topmostSubform[0].Page1[0].SecA_Patient[0].Death[0]",
  deathDate: "topmostSubform[0].Page1[0].SecA_Patient[0].DeathDate[0]",
  lifeThreatening: "topmostSubform[0].Page1[0].SecA_Patient[0].LifeThreaten[0]",
  disability: "topmostSubform[0].Page1[0].SecA_Patient[0].Disability[0]",
  requiredIntervention: "topmostSubform[0].Page1[0].SecA_Patient[0].ReqdInter[0]",
  congenitalAnomaly: "topmostSubform[0].Page1[0].SecA_Patient[0].Congenital[0]",
  otherSerious: "topmostSubform[0].Page1[0].SecA_Patient[0].OtherEvents[0]",
  eventDate: "topmostSubform[0].Page1[0].SecA_Patient[0].EventDate[0]",
  eventNarrative:
    "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]",
  relevantTestContext: "topmostSubform[0].Page3[0].AdditionalComments[0]",
  relevantHistory: "topmostSubform[0].Page3[0].Sec6Data[0].OtherHistory[0]",
  productAvailableYes: "topmostSubform[0].Page3[0].TestDataTable[0].EvalYes[0]",
  productAvailableNo: "topmostSubform[0].Page3[0].TestDataTable[0].EvalNo[0]",
  productReturned: "topmostSubform[0].Page3[0].TestDataTable[0].EvalRetd[0]",
  productReturnDate: "topmostSubform[0].Page3[0].TestDataTable[0].ReturnDate[0]",
  productOneName: "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]",
  productOneManufacturer: "topmostSubform[0].Page4[0].Prod1[0].Prod1ManuComp[0]",
  productOneLot: "topmostSubform[0].Page4[0].Prod1[0].Prod1LotNum[0]",
  productOneIdentifier: "topmostSubform[0].Page4[0].Prod1[0].Prod1NDC_ID[0]",
  productOneExpiration: "topmostSubform[0].Page4[0].Prod1[0].Prod1ExpDate[0]",
  productOneDose: "topmostSubform[0].Page4[0].Prod1[0].Prod1Dose[0]",
  productOneDoseUnit: "topmostSubform[0].Page4[0].Prod1[0].Prod1DoseUnit[0]",
  productOneStrength: "topmostSubform[0].Page4[0].Prod1[0].Prod1Strength[0]",
  productOneStrengthUnit: "topmostSubform[0].Page4[0].Prod1[0].Prod1StrengthUnit[0]",
  productOneFrequency: "topmostSubform[0].Page4[0].Prod1[0].Prod1Freq[0]",
  productOneOtherFrequency: "topmostSubform[0].Page4[0].Prod1[0].Prod1FreqOther[0]",
  productOneRoute: "topmostSubform[0].Page4[0].Prod1[0].Prod1Route[0]",
  productOneOtherRoute: "topmostSubform[0].Page4[0].Prod1[0].Prod1RouteOther[0]",
  productOneStartDate: "topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStartDate[0]",
  productOneStopDate: "topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStopDate[0]",
  productOneIndication: "topmostSubform[0].Page4[0].Prod1[0].Prod1Diagnosis[0]",
  productTwoName: "topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]",
  productTwoManufacturer: "topmostSubform[0].Page5[0].Prod2[0].Prod2ManuComp[0]",
  productTwoLot: "topmostSubform[0].Page5[0].Prod2[0].Prod2LotNum[0]",
  productTwoIdentifier: "topmostSubform[0].Page5[0].Prod2[0].Prod2NDC_ID[0]",
  productTwoExpiration: "topmostSubform[0].Page5[0].Prod2[0].Prod2ExpDate[0]",
  productTwoDose: "topmostSubform[0].Page5[0].Prod2[0].Prod2Dose[0]",
  productTwoDoseUnit: "topmostSubform[0].Page5[0].Prod2[0].Prod2DoseUnit[0]",
  productTwoStrength: "topmostSubform[0].Page5[0].Prod2[0].Prod2Strength[0]",
  productTwoStrengthUnit: "topmostSubform[0].Page5[0].Prod2[0].Prod2StrengthUnit[0]",
  productTwoFrequency: "topmostSubform[0].Page5[0].Prod2[0].Prod2Freq[0]",
  productTwoOtherFrequency: "topmostSubform[0].Page5[0].Prod2[0].Prod2FreqOther[0]",
  productTwoRoute: "topmostSubform[0].Page5[0].Prod2[0].Prod2Route[0]",
  productTwoOtherRoute: "topmostSubform[0].Page5[0].Prod2[0].Prod2RouteOther[0]",
  productTwoStartDate: "topmostSubform[0].Page5[0].Prod2[0].Prod2TherapyStartDate[0]",
  productTwoStopDate: "topmostSubform[0].Page5[0].Prod2[0].Prod2TherapyStopDate[0]",
  productTwoIndication: "topmostSubform[0].Page5[0].Prod2[0].Prod2Diagnosis[0]",
  deviceBrandName: "topmostSubform[0].Page6[0].SecE_Device[0].BrandName[0]",
  deviceCommonName: "topmostSubform[0].Page6[0].SecE_Device[0].CommName[0]",
  deviceProcode: "topmostSubform[0].Page6[0].SecE_Device[0].Procode[0]",
  deviceManufacturer: "topmostSubform[0].Page6[0].SecE_Device[0].ManuName[0]",
  deviceModel: "topmostSubform[0].Page6[0].SecE_Device[0].ModelNum[0]",
  deviceLot: "topmostSubform[0].Page6[0].SecE_Device[0].LotNum[0]",
  deviceCatalog: "topmostSubform[0].Page6[0].SecE_Device[0].CatNum[0]",
  deviceExpiration: "topmostSubform[0].Page6[0].SecE_Device[0].ExpDate[0]",
  deviceSerial: "topmostSubform[0].Page6[0].SecE_Device[0].SerialNum[0]",
  deviceUdi: "topmostSubform[0].Page6[0].SecE_Device[0].UDInum[0]",
  deviceOperatorProfessional: "topmostSubform[0].Page6[0].SecE_Device[0].HealthPro[0]",
  deviceOperatorPatient: "topmostSubform[0].Page6[0].SecE_Device[0].PatientCons[0]",
  deviceOperatorOther: "topmostSubform[0].Page6[0].SecE_Device[0].OperatorOther[0]",
  deviceImplantDate: "topmostSubform[0].Page6[0].SecE_Device[0].ImplantDate[0]",
  deviceExplantDate: "topmostSubform[0].Page6[0].SecE_Device[0].ExplantDate[0]",
  deviceReprocessedYes: "topmostSubform[0].Page6[0].SecE_Device[0].ReuseYes[0]",
  deviceReprocessedNo: "topmostSubform[0].Page6[0].SecE_Device[0].ReuseNo[0]",
  deviceReprocessor: "topmostSubform[0].Page6[0].SecE_Device[0].ReprocInfo[0]",
  deviceServicedYes: "topmostSubform[0].Page6[0].SecE_Device[0].ServicedYes[0]",
  deviceServicedNo: "topmostSubform[0].Page6[0].SecE_Device[0].ServicedNo[0]",
  deviceServicedUnknown: "topmostSubform[0].Page6[0].SecE_Device[0].ServiceUnk[0]",
  concomitantOneName: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]",
  concomitantOneStartDate: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Start1[0]",
  concomitantOneStopDate: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].End1[0]",
  reporterLastName: "topmostSubform[0].Page7[0].SecG_Reporter[0].LastName[0]",
  reporterFirstName: "topmostSubform[0].Page7[0].SecG_Reporter[0].FirstName[0]",
  reporterAddress: "topmostSubform[0].Page7[0].SecG_Reporter[0].Address[0]",
  reporterCity: "topmostSubform[0].Page7[0].SecG_Reporter[0].City[0]",
  reporterState: "topmostSubform[0].Page7[0].SecG_Reporter[0].State[0]",
  reporterPostalCode: "topmostSubform[0].Page7[0].SecG_Reporter[0].ZipCode[0]",
  reporterCountry: "topmostSubform[0].Page7[0].SecG_Reporter[0].Country[0]",
  reporterPhone: "topmostSubform[0].Page7[0].SecG_Reporter[0].PhoneNum[0]",
  reporterEmail: "topmostSubform[0].Page7[0].SecG_Reporter[0].Email[0]",
  reporterProfessionalYes: "topmostSubform[0].Page7[0].SecG_Reporter[0].ProYes[0]",
  reporterProfessionalNo: "topmostSubform[0].Page7[0].SecG_Reporter[0].ProNo[0]",
  reporterOccupation: "topmostSubform[0].Page7[0].SecG_Reporter[0].Occupation[0]",
  reporterManufacturer: "topmostSubform[0].Page7[0].SecG_Reporter[0].ManuComp[0]",
  reporterUserFacility: "topmostSubform[0].Page7[0].SecG_Reporter[0].UserFac[0]",
  reporterDistributorImporter: "topmostSubform[0].Page7[0].SecG_Reporter[0].DistImp[0]",
  reporterPacker: "topmostSubform[0].Page7[0].SecG_Reporter[0].Packer[0]",
  reporterIdentityNo: "topmostSubform[0].Page7[0].SecG_Reporter[0].IdentityNo[0]",
} as const;

// Visual B6 rows, verified from the source PDF widget rectangles. Native field
// suffixes 5/8 are crossed; using the same suffix for every column misattributes
// ranges/dates. Keep source bytes intact and map each visible row explicitly.
const relevantTestFields = [
  [1, 1], [2, 2], [3, 3], [4, 4], [8, 5], [5, 8], [6, 6], [7, 7],
].map(([result, details]) => {
  const prefix = "topmostSubform[0].Page3[0].TestDataTable[0]";
  return {
    testResult: `${prefix}.Row${result}[0].TestData${result}[0]`,
    lowRange: `${prefix}.Row${details}[0].TLowRange${details}[0]`,
    highRange: `${prefix}.Row${details === 7 ? 8 : details}[0].THighRange${details}[0]`,
    date: `${prefix}.Row${details <= 2 ? details : 8}[0].TDate${details}[0]`,
  };
});

export interface RepresentativeFormValues {
  patientIdentifier: string;
  eventNarrative: string;
  hospitalized: boolean;
  productOneName: string;
  productOneRoute: string;
  productTwoName: string;
}

export interface RepresentativeReadback extends RepresentativeFormValues {
  pageCount: number;
}

export interface RepresentativeFillResult {
  output: Uint8Array;
  readback: RepresentativeReadback;
}

export interface CantooReloadResult {
  status: "ok" | "residual-encryption-marker";
  message?: string;
}

export interface Form3500ProjectionReadback {
  pageCount: number;
  sections: Form3500Projection["sections"];
}

export interface Form3500ProjectionFillResult {
  output: Uint8Array;
  readback: Form3500ProjectionReadback;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireReadback(value: string | undefined, field: string): string {
  if (value === undefined) {
    throw new Error(`Representative field ${field} had no readable value`);
  }
  return value;
}

async function loadForm(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { password: "", updateMetadata: false });
}

export async function assertApprovedFormSource(
  source: Uint8Array,
): Promise<void> {
  const actualChecksum = sha256(source);
  if (actualChecksum !== FORM_3500_SHA256) {
    throw new Error(
      `Unsupported Form FDA 3500 source: expected ${FORM_3500_VERSION} checksum ${FORM_3500_SHA256}, received ${actualChecksum}`,
    );
  }

  const document = await loadForm(source);
  if (document.getPageCount() !== FORM_3500_PAGE_COUNT) {
    throw new Error(
      `Unsupported Form FDA 3500 identity: expected FORM FDA 3500 ${FORM_3500_VERSION} with ${FORM_3500_PAGE_COUNT} pages`,
    );
  }
}

export async function fillRepresentativeForm(
  source: Uint8Array,
  values: RepresentativeFormValues,
): Promise<RepresentativeFillResult> {
  await assertApprovedFormSource(source);

  const document = await loadForm(source);
  const form = document.getForm();

  form.getTextField(fields.patientIdentifier).setText(values.patientIdentifier);
  form.getTextField(fields.eventNarrative).setText(values.eventNarrative);

  const hospitalized = form.getCheckBox(fields.hospitalized);
  if (values.hospitalized) {
    hospitalized.check();
  } else {
    hospitalized.uncheck();
  }

  form.getTextField(fields.productOneName).setText(values.productOneName);
  form.getDropdown(fields.productOneRoute).select(values.productOneRoute);
  form.getTextField(fields.productTwoName).setText(values.productTwoName);

  form.updateFieldAppearances();
  return {
    output: await document.save(),
    readback: readRepresentativeForm(document),
  };
}

export async function fillForm3500Projection(
  source: Uint8Array,
  projection: Form3500Projection,
): Promise<Form3500ProjectionFillResult> {
  await assertApprovedFormSource(source);
  const narrativeLimitation = await eventNarrativeLimitation(projection);
  if (narrativeLimitation) throw new Error(`The reviewed B5 event description ${narrativeLimitation}`);
  const testHistoryIssues = await testHistoryLimitations(projection);
  if (testHistoryIssues.length) throw new Error(`The reviewed B6/B7 text ${testHistoryIssues[0].limitation}`);
  if (projection.sections.D.suspectProducts.length > maximumForm3500SuspectProducts) {
    throw new Error(`The approved Form 3500 adapter supports at most ${maximumForm3500SuspectProducts} suspect products`);
  }
  if (projection.sections.F.concomitantProducts.length > maximumForm3500ConcomitantProducts) {
    throw new Error(`The approved Form 3500 adapter supports at most ${maximumForm3500ConcomitantProducts} concomitant product`);
  }
  if (projection.sections.B.relevantTests.length > relevantTestFields.length) {
    throw new Error("The approved Form 3500 adapter supports at most eight relevant tests");
  }

  const document = await loadForm(source);
  const form = document.getForm();
  const { A, B, C, D, E, F } = projection.sections;

  setText(form, fields.patientIdentifier, A.patientIdentifier);
  if (A.raceEthnicity !== undefined && !isRaceEthnicitySelections(A.raceEthnicity)) throw new Error("A5 requires supported nonempty unique race/ethnicity selections");
  for (const option of raceEthnicityOptions) {
    const name = `topmostSubform[0].Page1[0].SecA_Patient[0].${option.widget}[0]`;
    const selected = A.raceEthnicity?.includes(option.value) ?? false;
    if (selected || form.getCheckBox(name).isChecked()) setChecked(form, name, selected);
  }
  if (A.ageYears !== undefined && A.dateOfBirth !== undefined) throw new Error("A2 requires an explicit age or date-of-birth print choice");
  if (A.dateOfBirth !== undefined && !isCompleteBirthDate(A.dateOfBirth)) throw new Error("Date of birth requires a complete valid calendar date");
  if (A.dateOfBirth !== undefined || form.getTextField(fields.dateOfBirth).getText()) setText(form, fields.dateOfBirth, A.dateOfBirth ? formatDate(A.dateOfBirth) : "");
  const ageLimit = patientAgeLimitation(A.ageYears);
  if (ageLimit) throw new Error(`The reviewed patient age ${ageLimit}`);
  const age = A.ageYears !== undefined ? patientAgeParts(A.ageYears) : undefined;
  setText(form, fields.ageValue, age?.value.toString());
  setChecked(form, fields.ageYears, age?.unit === "years");
  // Preserve unset native controls on the legacy years path; still clear any
  // previously selected unit rather than allowing contradictory marks.
  if (age?.unit === "months" || form.getCheckBox(fields.ageMonths).isChecked()) setChecked(form, fields.ageMonths, age?.unit === "months");
  if (age?.unit === "days" || form.getCheckBox(fields.ageDays).isChecked()) setChecked(form, fields.ageDays, age?.unit === "days");
  if (age?.unit === "weeks" || form.getCheckBox(fields.ageWeeks).isChecked()) setChecked(form, fields.ageWeeks, age?.unit === "weeks");
  if (A.sex === "intersex") throw new Error("The fixed Form 3500 adapter does not support intersex sex projection");
  setChecked(form, fields.sexMale, A.sex === "male");
  setChecked(form, fields.sexFemale, A.sex === "female");
  setText(form, fields.weightValue, A.weight?.value.toString());
  setChecked(form, fields.weightLb, A.weight?.unit === "lb");
  setChecked(form, fields.weightKg, A.weight?.unit === "kg");
  setChecked(form, fields.adverseEvent, B.reportType === "adverse-event" || B.reportType === "adverse-event-and-product-problem");
  setChecked(form, fields.productProblem, B.reportType === "product-problem" || B.reportType === "adverse-event-and-product-problem");
  setChecked(form, fields.hospitalized, B.hospitalized === true);
  for (const field of ["death", "lifeThreatening", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const) {
    setChecked(form, fields[field], B[field] === true);
  }
  setText(form, fields.deathDate, B.deathDate ? formatDate(B.deathDate) : undefined);
  setText(form, fields.reportDate, B.reportDate ? formatDate(B.reportDate) : undefined);
  setText(form, fields.eventDate, B.eventDate ? formatDate(B.eventDate) : undefined);
  setText(form, fields.eventNarrative, B.eventDescription);
  setText(form, fields.relevantHistory, B.relevantHistory);
  setText(form, fields.relevantTestContext, B.relevantTestContext);
  B.relevantTests.forEach((test, index) => {
    const names = relevantTestFields[index];
    setText(form, names.testResult, test.testResult);
    setText(form, names.lowRange, test.lowRange);
    setText(form, names.highRange, test.highRange);
    setText(form, names.date, test.date ? formatDate(test.date) : undefined);
  });
  setChecked(form, fields.productAvailableYes, C.productAvailability === "available");
  setChecked(form, fields.productAvailableNo, C.productAvailability === "not-available");
  setChecked(form, fields.productReturned, C.productAvailability === "returned-to-manufacturer");
  setText(form, fields.productReturnDate, C.productReturnDate ? formatDate(C.productReturnDate) : undefined);

  const durationUnitWrites = new Set<string>();
  const suspectFields = [
    {
      name: fields.productOneName,
      manufacturer: fields.productOneManufacturer,
      lotNumber: fields.productOneLot,
      ndcOrUniqueId: fields.productOneIdentifier,
      expirationDate: fields.productOneExpiration,
      dose: fields.productOneDose, doseUnit: fields.productOneDoseUnit, strength: fields.productOneStrength, strengthUnit: fields.productOneStrengthUnit,
      frequency: fields.productOneFrequency,
      otherFrequency: fields.productOneOtherFrequency,
      route: fields.productOneRoute,
      otherRoute: fields.productOneOtherRoute,
      startDate: fields.productOneStartDate,
      stopDate: fields.productOneStopDate,
      indication: fields.productOneIndication,
    },
    {
      name: fields.productTwoName,
      manufacturer: fields.productTwoManufacturer,
      lotNumber: fields.productTwoLot,
      ndcOrUniqueId: fields.productTwoIdentifier,
      expirationDate: fields.productTwoExpiration,
      dose: fields.productTwoDose, doseUnit: fields.productTwoDoseUnit, strength: fields.productTwoStrength, strengthUnit: fields.productTwoStrengthUnit,
      frequency: fields.productTwoFrequency,
      otherFrequency: fields.productTwoOtherFrequency,
      route: fields.productTwoRoute,
      otherRoute: fields.productTwoOtherRoute,
      startDate: fields.productTwoStartDate,
      stopDate: fields.productTwoStopDate,
      indication: fields.productTwoIndication,
    },
  ];
  D.suspectProducts.forEach((product, index) => {
    writeSuspectProduct(form, suspectFields[index], product);
    const ordinal = index + 1;
    const prefix = `topmostSubform[0].Page${index + 4}[0].Prod${ordinal}[0].Prod${ordinal}`;
    if (product.treatmentDuration !== undefined && (!isTreatmentDuration(product.treatmentDuration) || durationLimitation(product.treatmentDuration))) throw new Error("Unsupported D3 treatment duration");
    if (product.treatmentDuration && [product.startDate,product.stopDate,product.doseReductionDate].some(v => v !== undefined)) throw new Error("D3 requires an explicit dates or duration print choice");
    const durationName = `${prefix}TherapyDuration[0]`, durationUnitName = `${prefix}TherapyDurUnit[0]`;
    if (product.treatmentDuration || form.getTextField(durationName).getText()) setText(form,durationName,product.treatmentDuration?.value ?? "");
    const durationUnit = form.getDropdown(durationUnitName);
    if (product.treatmentDuration) {
      durationUnit.select(durationNativeLabels[product.treatmentDuration.unit]);
      durationUnitWrites.add(durationUnitName);
    } else if (durationUnit.getSelected().some(v=>v!=="8" && v.trim()!=="")) {
      durationUnit.select(" ");
      durationUnitWrites.add(durationUnitName);
    }
    if (product.doseReductionDate !== undefined && !isCompleteCalendarDate(product.doseReductionDate)) throw new Error("D3 dose-reduction date requires a complete valid calendar date");
    const reductionDateName = `${prefix}TherapyReduceDate[0]`;
    if (product.doseReductionDate !== undefined || form.getTextField(reductionDateName).getText()) setText(form, reductionDateName, product.doseReductionDate ? formatDate(product.doseReductionDate) : "");
    if (product.therapyOngoing !== undefined && typeof product.therapyOngoing !== "boolean") throw new Error("D3 ongoing therapy requires an explicit boolean");
    for (const [answer, suffix] of [[true, "Yes"], [false, "No"]] as const) {
      const name = `${prefix}TherapyOngoing${suffix}[0]`;
      const selected = product.therapyOngoing === answer;
      if (selected || form.getCheckBox(name).isChecked()) setChecked(form, name, selected);
    }
    for (const [label, suffix] of [["brand", "Brand"], ["generic-biosimilar", "Generic"], ["otc", "OTC"], ["compounded", "Compounded"]] as const) {
      setChecked(form, `${prefix}${suffix}[0]`, product.medicationType?.includes(label) === true);
    }
    for (const [value, suffix] of [[product.improvedAfterChange, "Abated"], [product.recurred, "Reappear"]] as const) {
      setChecked(form, `${prefix}${suffix}Yes[0]`, value === true);
      setChecked(form, `${prefix}${suffix}No[0]`, value === false);
      setChecked(form, `${prefix}${suffix}NA[0]`, value === "inapplicable");
    }
  });

  const device = E.suspectDevice;
  if (device) {
    setText(form, fields.deviceBrandName, device.brandName);
    setText(form, fields.deviceCommonName, device.commonName);
    setText(form, fields.deviceProcode, device.procode);
    setText(form, fields.deviceManufacturer, device.manufacturer);
    setText(form, fields.deviceModel, device.modelNumber);
    setText(form, fields.deviceLot, device.lotNumber);
    setText(form, fields.deviceCatalog, device.catalogNumber);
    setText(form, fields.deviceExpiration, device.expirationDate ? formatDate(device.expirationDate) : undefined);
    setText(form, fields.deviceSerial, device.serialNumber);
    setText(form, fields.deviceUdi, device.udi);
    setChecked(form, fields.deviceOperatorProfessional, device.operator === "health-professional");
    setChecked(form, fields.deviceOperatorPatient, device.operator === "patient-consumer");
    setChecked(form, fields.deviceOperatorOther, device.operator === "other");
    setText(form, fields.deviceImplantDate, device.implantDate ? formatDate(device.implantDate) : undefined);
    setText(form, fields.deviceExplantDate, device.explantDate ? formatDate(device.explantDate) : undefined);
    setChecked(form, fields.deviceReprocessedYes, device.reprocessedSingleUse === true);
    setChecked(form, fields.deviceReprocessedNo, device.reprocessedSingleUse === false);
    setText(form, fields.deviceReprocessor, device.reprocessor);
    setChecked(form, fields.deviceServicedYes, device.servicedByThirdParty === "yes");
    setChecked(form, fields.deviceServicedNo, device.servicedByThirdParty === "no");
    setChecked(form, fields.deviceServicedUnknown, device.servicedByThirdParty === "unknown");
  }

  const concomitant = F.concomitantProducts[0];
  if (concomitant) {
    setText(form, fields.concomitantOneName, concomitant.name);
    setText(form, fields.concomitantOneStartDate, concomitant.startDate ? formatDate(concomitant.startDate) : undefined);
    setText(form, fields.concomitantOneStopDate, concomitant.stopDate ? formatDate(concomitant.stopDate) : undefined);
  }
  const reporter = projection.sections.G.reporter;
  setText(form, fields.reporterLastName, reporter.lastName);
  setText(form, fields.reporterFirstName, reporter.firstName);
  setText(form, fields.reporterAddress, reporter.address);
  setText(form, fields.reporterCity, reporter.city);
  setText(form, fields.reporterState, reporter.state);
  setText(form, fields.reporterPostalCode, reporter.postalCode);
  if (reporter.country) form.getDropdown(fields.reporterCountry).select(reporter.country);
  setText(form, fields.reporterPhone, reporter.phone);
  setText(form, fields.reporterEmail, reporter.email);
  setChecked(form, fields.reporterProfessionalYes, reporter.healthProfessional === true);
  setChecked(form, fields.reporterProfessionalNo, reporter.healthProfessional === false);
  if (reporter.occupation) form.getDropdown(fields.reporterOccupation).select(reporter.occupation);
  setChecked(form, fields.reporterManufacturer, reporter.reportedTo?.includes("manufacturer") === true);
  setChecked(form, fields.reporterUserFacility, reporter.reportedTo?.includes("user-facility") === true);
  setChecked(form, fields.reporterDistributorImporter, reporter.reportedTo?.includes("distributor-importer") === true);
  setChecked(form, fields.reporterPacker, reporter.reportedTo?.includes("packer") === true);
  setChecked(form, fields.reporterIdentityNo, reporter.doNotDiscloseIdentity === true);

  form.updateFieldAppearances();
  // pdf-lib selects display labels. Preserve the generated label appearance,
  // but store the original FDA option's export value for other PDF readers.
  for (const name of [fields.productOneDoseUnit, fields.productOneStrengthUnit, fields.productTwoDoseUnit, fields.productTwoStrengthUnit, ...durationUnitWrites]) {
    const dropdown = form.getDropdown(name);
    const selected = dropdown.getSelected()[0];
    if (!selected) continue;
    const option = dropdown.acroField.getOptions().find((option) => (option.display ?? option.value).decodeText() === selected || option.value.decodeText() === selected);
    if (!option) throw new Error("Unsupported Form 3500 quantity unit");
    dropdown.acroField.dict.set(PDFName.of("V"), option.value);
  }
  return {
    output: await document.save(),
    readback: readProjectionForm(document, projection),
  };
}

export async function inspectCantooReload(
  output: Uint8Array,
): Promise<CantooReloadResult> {
  try {
    await loadForm(output);
    return { status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "NEEDS PASSWORD") {
      return { status: "residual-encryption-marker", message };
    }
    throw error;
  }
}

function readRepresentativeForm(
  document: PDFDocument,
): RepresentativeReadback {
  const form = document.getForm();

  return {
    patientIdentifier: requireReadback(
      form.getTextField(fields.patientIdentifier).getText(),
      "patientIdentifier",
    ),
    eventNarrative: requireReadback(
      form.getTextField(fields.eventNarrative).getText(),
      "eventNarrative",
    ),
    hospitalized: form.getCheckBox(fields.hospitalized).isChecked(),
    productOneName: requireReadback(
      form.getTextField(fields.productOneName).getText(),
      "productOneName",
    ),
    productOneRoute: requireReadback(
      form.getDropdown(fields.productOneRoute).getSelected()[0],
      "productOneRoute",
    ),
    productTwoName: requireReadback(
      form.getTextField(fields.productTwoName).getText(),
      "productTwoName",
    ),
    pageCount: document.getPageCount(),
  };
}

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string | undefined): void {
  if (value !== undefined) form.getTextField(name).setText(value);
}

function setChecked(form: ReturnType<PDFDocument["getForm"]>, name: string, value: boolean): void {
  const checkbox = form.getCheckBox(name);
  if (value) checkbox.check();
  else checkbox.uncheck();
}

function writeSuspectProduct(
  form: ReturnType<PDFDocument["getForm"]>,
  names: { name: string; manufacturer: string; lotNumber: string; ndcOrUniqueId: string; expirationDate: string; dose: string; doseUnit: string; strength: string; strengthUnit: string; frequency: string; otherFrequency: string; route: string; otherRoute: string; startDate: string; stopDate: string; indication: string },
  product: ProjectedProduct,
): void {
  for (const field of ["route", "frequency", "dose", "strength", "ndcOrUniqueId"] as const) {
    const limitation = field === "dose" || field === "strength" ? quantityLimitation(field, product[field])
      : product[field] !== undefined ? productTextLimitation(field, product[field]!) : undefined;
    if (limitation) throw new Error(`The reviewed ${field === "ndcOrUniqueId" ? "NDC number or Unique ID" : field} ${limitation} for Form 3500`);
  }
  setText(form, names.name, product.name);
  setText(form, names.manufacturer, product.manufacturer);
  setText(form, names.lotNumber, product.lotNumber);
  setText(form, names.ndcOrUniqueId, product.ndcOrUniqueId);
  setText(form, names.expirationDate, product.expirationDate ? formatDate(product.expirationDate) : undefined);
  writeQuantity(form, names.dose, names.doseUnit, product.dose);
  writeQuantity(form, names.strength, names.strengthUnit, product.strength);
  if (product.frequency) {
    const encoded = encodeForm3500Frequency(product.frequency);
    form.getDropdown(names.frequency).select(encoded.option);
    setText(form, names.otherFrequency, encoded.other);
  }
  if (product.route !== undefined) {
    const dropdown = form.getDropdown(names.route);
    const encoded = encodeForm3500Route(product.route, dropdown.getOptions());
    dropdown.select(encoded.option);
    setText(form, names.otherRoute, encoded.other);
  }
  setText(form, names.startDate, product.startDate ? formatDate(product.startDate) : undefined);
  setText(form, names.stopDate, product.stopDate ? formatDate(product.stopDate) : undefined);
  setText(form, names.indication, product.indication);
}

function readProjectionForm(document: PDFDocument, projection: Form3500Projection): Form3500ProjectionReadback {
  const form = document.getForm();
  const { A, B, G } = projection.sections;
  const reporter = G.reporter;
  const readAge = (): PatientAge | undefined => {
    const units = (["years", "months", "weeks", "days"] as const).filter(unit => form.getCheckBox(unit === "years" ? fields.ageYears : unit === "months" ? fields.ageMonths : unit === "weeks" ? fields.ageWeeks : fields.ageDays).isChecked());
    if (units.length > 1) throw new Error("Form 3500 age has contradictory or unsupported units");
    if (!units.length) return undefined;
    const value = Number(form.getTextField(fields.ageValue).getText());
    return units[0] === "years" ? value : { value, unit: units[0] };
  };
  const readMedicationControls = (index: number): Pick<ProjectedProduct, "medicationType" | "improvedAfterChange" | "recurred"> => {
    const prefix = `topmostSubform[0].Page${index + 4}[0].Prod${index + 1}[0].Prod${index + 1}`;
    const medicationType = ([["brand", "Brand"], ["generic-biosimilar", "Generic"], ["otc", "OTC"], ["compounded", "Compounded"]] as const)
      .filter(([, suffix]) => form.getCheckBox(`${prefix}${suffix}[0]`).isChecked()).map(([label]) => label);
    const outcome = (suffix: string): boolean | "inapplicable" | undefined => {
      const selected = ["Yes", "No", "NA"].filter((answer) => form.getCheckBox(`${prefix}${suffix}${answer}[0]`).isChecked());
      if (selected.length > 1) throw new Error("Form 3500 medication outcome has contradictory selections");
      return selected[0] === "Yes" ? true : selected[0] === "No" ? false : selected[0] === "NA" ? "inapplicable" : undefined;
    };
    return { medicationType: medicationType.length ? medicationType : undefined,
      improvedAfterChange: outcome("Abated"), recurred: outcome("Reappear") };
  };
  const readOngoing = (index: number): boolean | undefined => {
    const prefix = `topmostSubform[0].Page${index + 4}[0].Prod${index + 1}[0].Prod${index + 1}TherapyOngoing`;
    const selected = ["Yes", "No"].filter(answer => form.getCheckBox(`${prefix}${answer}[0]`).isChecked());
    if (selected.length > 1) throw new Error("Form 3500 ongoing therapy has contradictory selections");
    return selected[0] === "Yes" ? true : selected[0] === "No" ? false : undefined;
  };
  const readDuration = (index:number) => {
    const prefix = `topmostSubform[0].Page${index+4}[0].Prod${index+1}[0].Prod${index+1}`;
    const value = form.getTextField(`${prefix}TherapyDuration[0]`).getText();
    const rawUnit = form.getDropdown(`${prefix}TherapyDurUnit[0]`).getSelected()[0];
    const unit = Object.entries(durationNativeUnits).find(([,v])=>v===rawUnit)?.[0];
    if (!value && !unit) return undefined;
    const result = {value:value ?? "",unit:unit ?? ""};
    if (!isTreatmentDuration(result)) throw new Error("Unreadable D3 duration pair");
    return result;
  };
  const readSuspect = (
    expected: ProjectedProduct,
    index: number,
    names: { name: string; manufacturer: string; lotNumber: string; ndcOrUniqueId: string; expirationDate: string; dose: string; doseUnit: string; strength: string; strengthUnit: string; frequency: string; otherFrequency: string; route: string; otherRoute: string; startDate: string; stopDate: string; indication: string },
  ): ProjectedProduct => compact({
    productId: expected.productId,
    therapyOngoing: readOngoing(index),
    treatmentDuration: readDuration(index),
    doseReductionDate: parseDate(form.getTextField(`topmostSubform[0].Page${index + 4}[0].Prod${index + 1}[0].Prod${index + 1}TherapyReduceDate[0]`).getText()),
    name: form.getTextField(names.name).getText(),
    manufacturer: form.getTextField(names.manufacturer).getText(),
    lotNumber: form.getTextField(names.lotNumber).getText(),
    ndcOrUniqueId: form.getTextField(names.ndcOrUniqueId).getText(),
    expirationDate: parseDate(form.getTextField(names.expirationDate).getText()),
    dose: readQuantity(form, names.dose, names.doseUnit, expected.dose),
    strength: readQuantity(form, names.strength, names.strengthUnit, expected.strength),
    frequency: decodeFrequency(
      form.getDropdown(names.frequency).getSelected()[0],
      form.getTextField(names.otherFrequency).getText(),
    ),
    route: decodeRoute(form.getDropdown(names.route).getSelected()[0], form.getTextField(names.otherRoute).getText(), form.getDropdown(names.route).getOptions()),
    startDate: parseDate(form.getTextField(names.startDate).getText()),
    stopDate: parseDate(form.getTextField(names.stopDate).getText()),
    indication: form.getTextField(names.indication).getText(),
    ...readMedicationControls(index),
  });
  const suspectNames = [
    { name: fields.productOneName, manufacturer: fields.productOneManufacturer, lotNumber: fields.productOneLot, ndcOrUniqueId: fields.productOneIdentifier, expirationDate: fields.productOneExpiration, dose: fields.productOneDose, doseUnit: fields.productOneDoseUnit, strength: fields.productOneStrength, strengthUnit: fields.productOneStrengthUnit, frequency: fields.productOneFrequency, otherFrequency: fields.productOneOtherFrequency, route: fields.productOneRoute, otherRoute: fields.productOneOtherRoute, startDate: fields.productOneStartDate, stopDate: fields.productOneStopDate, indication: fields.productOneIndication },
    { name: fields.productTwoName, manufacturer: fields.productTwoManufacturer, lotNumber: fields.productTwoLot, ndcOrUniqueId: fields.productTwoIdentifier, expirationDate: fields.productTwoExpiration, dose: fields.productTwoDose, doseUnit: fields.productTwoDoseUnit, strength: fields.productTwoStrength, strengthUnit: fields.productTwoStrengthUnit, frequency: fields.productTwoFrequency, otherFrequency: fields.productTwoOtherFrequency, route: fields.productTwoRoute, otherRoute: fields.productTwoOtherRoute, startDate: fields.productTwoStartDate, stopDate: fields.productTwoStopDate, indication: fields.productTwoIndication },
  ];
  const concomitantProducts = projection.sections.F.concomitantProducts.map((expected): ProjectedConcomitantProduct => compact({
    productId: expected.productId,
    name: form.getTextField(fields.concomitantOneName).getText(),
    startDate: parseDate(form.getTextField(fields.concomitantOneStartDate).getText()),
    stopDate: parseDate(form.getTextField(fields.concomitantOneStopDate).getText()),
  }));

  return {
    pageCount: document.getPageCount(),
    sections: {
      A: compact({
        patientIdentifier: form.getTextField(fields.patientIdentifier).getText(),
        ageYears: readAge(),
        dateOfBirth: parseDate(form.getTextField(fields.dateOfBirth).getText()),
        raceEthnicity: A.raceEthnicity !== undefined ? raceEthnicityOptions.filter(option => form.getCheckBox(`topmostSubform[0].Page1[0].SecA_Patient[0].${option.widget}[0]`).isChecked()).map(option => option.value) : undefined,
        sex: form.getCheckBox(fields.sexFemale).isChecked()
          ? "female"
          : form.getCheckBox(fields.sexMale).isChecked() ? "male" : undefined,
        weight: A.weight ? {
          value: Number(form.getTextField(fields.weightValue).getText()),
          unit: form.getCheckBox(fields.weightKg).isChecked() ? "kg" as const : "lb" as const,
        } : undefined,
      }),
      B: compact({
        reportType: form.getCheckBox(fields.adverseEvent).isChecked() && form.getCheckBox(fields.productProblem).isChecked()
          ? "adverse-event-and-product-problem"
          : form.getCheckBox(fields.adverseEvent).isChecked() ? "adverse-event"
            : form.getCheckBox(fields.productProblem).isChecked() ? "product-problem" : undefined,
        reportDate: parseDate(form.getTextField(fields.reportDate).getText()),
        eventDate: parseDate(form.getTextField(fields.eventDate).getText()),
        eventDescription: form.getTextField(fields.eventNarrative).getText(),
        hospitalized: B.hospitalized === undefined ? undefined : form.getCheckBox(fields.hospitalized).isChecked(),
        death: B.death === undefined ? undefined : form.getCheckBox(fields.death).isChecked(),
        deathDate: parseDate(form.getTextField(fields.deathDate).getText()),
        lifeThreatening: B.lifeThreatening === undefined ? undefined : form.getCheckBox(fields.lifeThreatening).isChecked(),
        disability: B.disability === undefined ? undefined : form.getCheckBox(fields.disability).isChecked(),
        requiredIntervention: B.requiredIntervention === undefined ? undefined : form.getCheckBox(fields.requiredIntervention).isChecked(),
        congenitalAnomaly: B.congenitalAnomaly === undefined ? undefined : form.getCheckBox(fields.congenitalAnomaly).isChecked(),
        otherSerious: B.otherSerious === undefined ? undefined : form.getCheckBox(fields.otherSerious).isChecked(),
        relevantTests: B.relevantTests.map((test, index) => compact({
          testId: test.testId,
          testResult: form.getTextField(relevantTestFields[index].testResult).getText(),
          lowRange: form.getTextField(relevantTestFields[index].lowRange).getText(),
          highRange: form.getTextField(relevantTestFields[index].highRange).getText(),
          date: parseDate(form.getTextField(relevantTestFields[index].date).getText()),
        })),
        relevantHistory: form.getTextField(fields.relevantHistory).getText(),
        relevantTestContext: form.getTextField(fields.relevantTestContext).getText(),
      }),
      C: compact({
        productAvailability: form.getCheckBox(fields.productReturned).isChecked() ? "returned-to-manufacturer"
          : form.getCheckBox(fields.productAvailableYes).isChecked() ? "available"
            : form.getCheckBox(fields.productAvailableNo).isChecked() ? "not-available" : undefined,
        productReturnDate: parseDate(form.getTextField(fields.productReturnDate).getText()),
      }),
      D: {
        suspectProducts: projection.sections.D.suspectProducts.map((product, index) => readSuspect(product, index, suspectNames[index])),
      },
      E: { suspectDevice: projection.sections.E.suspectDevice ? compact({
        productId: projection.sections.E.suspectDevice.productId,
        brandName: form.getTextField(fields.deviceBrandName).getText(),
        commonName: form.getTextField(fields.deviceCommonName).getText(),
        procode: form.getTextField(fields.deviceProcode).getText(),
        manufacturer: form.getTextField(fields.deviceManufacturer).getText(),
        modelNumber: form.getTextField(fields.deviceModel).getText(),
        lotNumber: form.getTextField(fields.deviceLot).getText(),
        catalogNumber: form.getTextField(fields.deviceCatalog).getText(),
        expirationDate: parseDate(form.getTextField(fields.deviceExpiration).getText()),
        serialNumber: form.getTextField(fields.deviceSerial).getText(),
        udi: form.getTextField(fields.deviceUdi).getText(),
        operator: form.getCheckBox(fields.deviceOperatorProfessional).isChecked() ? "health-professional" as const
          : form.getCheckBox(fields.deviceOperatorPatient).isChecked() ? "patient-consumer" as const
            : form.getCheckBox(fields.deviceOperatorOther).isChecked() ? "other" as const : undefined,
        implantDate: parseDate(form.getTextField(fields.deviceImplantDate).getText()),
        explantDate: parseDate(form.getTextField(fields.deviceExplantDate).getText()),
        reprocessedSingleUse: projection.sections.E.suspectDevice.reprocessedSingleUse === undefined ? undefined
          : form.getCheckBox(fields.deviceReprocessedYes).isChecked(),
        reprocessor: form.getTextField(fields.deviceReprocessor).getText(),
        servicedByThirdParty: form.getCheckBox(fields.deviceServicedYes).isChecked() ? "yes" as const
          : form.getCheckBox(fields.deviceServicedNo).isChecked() ? "no" as const
            : form.getCheckBox(fields.deviceServicedUnknown).isChecked() ? "unknown" as const : undefined,
      }) : undefined },
      F: { concomitantProducts },
      G: { reporter: compact({
        lastName: form.getTextField(fields.reporterLastName).getText(),
        firstName: form.getTextField(fields.reporterFirstName).getText(),
        address: form.getTextField(fields.reporterAddress).getText(), city: form.getTextField(fields.reporterCity).getText(),
        state: form.getTextField(fields.reporterState).getText(), postalCode: form.getTextField(fields.reporterPostalCode).getText(),
        country: form.getDropdown(fields.reporterCountry).getSelected()[0], phone: form.getTextField(fields.reporterPhone).getText(),
        email: form.getTextField(fields.reporterEmail).getText(),
        healthProfessional: reporter.healthProfessional === undefined ? undefined : form.getCheckBox(fields.reporterProfessionalYes).isChecked(),
        occupation: form.getDropdown(fields.reporterOccupation).getSelected()[0],
        reportedTo: reporter.reportedTo === undefined ? undefined : [
          ...(form.getCheckBox(fields.reporterManufacturer).isChecked() ? ["manufacturer" as const] : []),
          ...(form.getCheckBox(fields.reporterUserFacility).isChecked() ? ["user-facility" as const] : []),
          ...(form.getCheckBox(fields.reporterDistributorImporter).isChecked() ? ["distributor-importer" as const] : []),
          ...(form.getCheckBox(fields.reporterPacker).isChecked() ? ["packer" as const] : []),
        ],
        doNotDiscloseIdentity: reporter.doNotDiscloseIdentity === undefined ? undefined : form.getCheckBox(fields.reporterIdentityNo).isChecked(),
      }) },
    },
  };
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Unsupported Form 3500 date ${value}`);
  const month = months[Number(match[2]) - 1];
  if (!month) throw new Error(`Unsupported Form 3500 date ${value}`);
  return `${match[3]}-${month}-${match[1]}`;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(value);
  const month = match ? months.indexOf(match[2]) + 1 : 0;
  if (!match || month === 0) throw new Error(`Unreadable Form 3500 date ${value}`);
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1]}`;
}

function decodeFrequency(value: string | undefined, other: string | undefined): string | undefined {
  if (!value || value === " ") return undefined;
  if (value === "BID") return "twice daily";
  if (value === "Daily") return "daily";
  if (value === "TID") return "three times daily";
  if (value === "QID") return "four times daily";
  if (value === "HS") return "at bedtime";
  if (value === "PRN") return "as needed";
  if (value === "Other" && other) return other;
  throw new Error(`Unreadable Form 3500 frequency ${value}`);
}

function decodeRoute(value: string | undefined, other: string | undefined, options: string[]): string | undefined {
  if (!value?.trim()) return undefined;
  if (value === "Other") {
    if (!other?.trim()) throw new Error("Form 3500 Other route had no supplied wording");
    return other;
  }
  if (options.includes(value)) return value === "Oral" ? "oral" : value;
  throw new Error(`Unreadable Form 3500 route ${value}`);
}

function writeQuantity(form: ReturnType<PDFDocument["getForm"]>, textName: string, unitName: string, value?: ProjectedQuantity): void {
  if (value === undefined) return;
  const { amount, unit } = quantityParts(value, textName.includes("Strength") ? "strength" : "dose");
  setText(form, textName, amount);
  form.getDropdown(unitName).select(unit);
}

function readQuantity(form: ReturnType<PDFDocument["getForm"]>, textName: string, unitName: string, expected?: ProjectedQuantity): ProjectedQuantity | undefined {
  const amount = form.getTextField(textName).getText();
  const dropdown = form.getDropdown(unitName);
  const selected = dropdown.getSelected()[0];
  const option = dropdown.acroField.getOptions().find((candidate) => candidate.value.decodeText() === selected);
  const unit = option ? (option.display ?? option.value).decodeText() : selected ?? " ";
  if (expected === undefined) {
    if (amount || unit.trim()) throw new Error("Unexpected Form 3500 quantity");
    return undefined;
  }
  const parts = quantityParts(expected, textName.includes("Strength") ? "strength" : "dose");
  if (amount !== parts.amount || unit !== parts.unit) throw new Error("Form 3500 quantity failed readback");
  // Preserve the reviewed spelling only after checking both actual controls.
  return expected;
}
