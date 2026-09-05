import { createHash } from "node:crypto";
import { PDFDocument } from "@cantoo/pdf-lib";
import type {
  Form3500Projection,
  ProjectedConcomitantProduct,
  ProjectedProduct,
} from "../../domain/case/projection";

export const FORM_3500_VERSION = "09/2025";
export const FORM_3500_PAGE_COUNT = 8;
export const FORM_3500_SHA256 =
  "1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c";

const fields = {
  patientIdentifier:
    "topmostSubform[0].Page1[0].SecA_Patient[0].PatientIdentifier[0]",
  ageValue: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeValue[0]",
  ageYears: "topmostSubform[0].Page1[0].SecA_Patient[0].AgeYears[0]",
  sexMale: "topmostSubform[0].Page1[0].SecA_Patient[0].SexM[0]",
  sexFemale: "topmostSubform[0].Page1[0].SecA_Patient[0].SexF[0]",
  adverseEvent: "topmostSubform[0].Page1[0].SecA_Patient[0].RepAdverse[0]",
  hospitalized: "topmostSubform[0].Page1[0].SecA_Patient[0].Hospital[0]",
  eventDate: "topmostSubform[0].Page1[0].SecA_Patient[0].EventDate[0]",
  eventNarrative:
    "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]",
  relevantTests: "topmostSubform[0].Page3[0].TestDataTable[0].Row1[0].TestData1[0]",
  productOneName: "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]",
  productOneDose: "topmostSubform[0].Page4[0].Prod1[0].Prod1Dose[0]",
  productOneFrequency: "topmostSubform[0].Page4[0].Prod1[0].Prod1Freq[0]",
  productOneRoute: "topmostSubform[0].Page4[0].Prod1[0].Prod1Route[0]",
  productOneStartDate: "topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStartDate[0]",
  productOneStopDate: "topmostSubform[0].Page4[0].Prod1[0].Prod1TherapyStopDate[0]",
  productOneIndication: "topmostSubform[0].Page4[0].Prod1[0].Prod1Diagnosis[0]",
  productTwoName: "topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]",
  productTwoDose: "topmostSubform[0].Page5[0].Prod2[0].Prod2Dose[0]",
  productTwoFrequency: "topmostSubform[0].Page5[0].Prod2[0].Prod2Freq[0]",
  productTwoRoute: "topmostSubform[0].Page5[0].Prod2[0].Prod2Route[0]",
  productTwoStartDate: "topmostSubform[0].Page5[0].Prod2[0].Prod2TherapyStartDate[0]",
  productTwoStopDate: "topmostSubform[0].Page5[0].Prod2[0].Prod2TherapyStopDate[0]",
  productTwoIndication: "topmostSubform[0].Page5[0].Prod2[0].Prod2Diagnosis[0]",
  concomitantOneName: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Prod1[0]",
  concomitantOneStartDate: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].Start1[0]",
  concomitantOneStopDate: "topmostSubform[0].Page6[0].SecF_Other[0].Table1[0].Row1[0].End1[0]",
} as const;

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
  if (projection.sections.D.suspectProducts.length > 2) {
    throw new Error("The approved Form 3500 adapter supports at most two suspect products");
  }
  if (projection.sections.F.concomitantProducts.length > 1) {
    throw new Error("Experiment 1 supports one concomitant product");
  }

  const document = await loadForm(source);
  const form = document.getForm();
  const { A, B, D, F } = projection.sections;

  setText(form, fields.patientIdentifier, A.patientIdentifier);
  setText(form, fields.ageValue, A.ageYears?.toString());
  setChecked(form, fields.ageYears, A.ageYears !== undefined);
  if (A.sex === "intersex") throw new Error("The fixed Form 3500 adapter does not support intersex sex projection");
  setChecked(form, fields.sexMale, A.sex === "male");
  setChecked(form, fields.sexFemale, A.sex === "female");
  setChecked(form, fields.adverseEvent, B.reportType === "adverse-event");
  setChecked(form, fields.hospitalized, B.hospitalized === true);
  setText(form, fields.eventDate, B.eventDate ? formatDate(B.eventDate) : undefined);
  setText(form, fields.eventNarrative, B.eventDescription);
  setText(form, fields.relevantTests, B.relevantTests);

  const suspectFields = [
    {
      name: fields.productOneName,
      dose: fields.productOneDose,
      frequency: fields.productOneFrequency,
      route: fields.productOneRoute,
      startDate: fields.productOneStartDate,
      stopDate: fields.productOneStopDate,
      indication: fields.productOneIndication,
    },
    {
      name: fields.productTwoName,
      dose: fields.productTwoDose,
      frequency: fields.productTwoFrequency,
      route: fields.productTwoRoute,
      startDate: fields.productTwoStartDate,
      stopDate: fields.productTwoStopDate,
      indication: fields.productTwoIndication,
    },
  ];
  D.suspectProducts.forEach((product, index) => writeSuspectProduct(form, suspectFields[index], product));

  const concomitant = F.concomitantProducts[0];
  if (concomitant) {
    setText(form, fields.concomitantOneName, concomitant.name);
    setText(form, fields.concomitantOneStartDate, concomitant.startDate ? formatDate(concomitant.startDate) : undefined);
    setText(form, fields.concomitantOneStopDate, concomitant.stopDate ? formatDate(concomitant.stopDate) : undefined);
  }

  form.updateFieldAppearances();
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
  names: { name: string; dose: string; frequency: string; route: string; startDate: string; stopDate: string; indication: string },
  product: ProjectedProduct,
): void {
  setText(form, names.name, product.name);
  setText(form, names.dose, product.dose);
  if (product.frequency) form.getDropdown(names.frequency).select(encodeFrequency(product.frequency));
  if (product.route) form.getDropdown(names.route).select(encodeRoute(product.route));
  setText(form, names.startDate, product.startDate ? formatDate(product.startDate) : undefined);
  setText(form, names.stopDate, product.stopDate ? formatDate(product.stopDate) : undefined);
  setText(form, names.indication, product.indication);
}

function readProjectionForm(document: PDFDocument, projection: Form3500Projection): Form3500ProjectionReadback {
  const form = document.getForm();
  const readSuspect = (
    expected: ProjectedProduct,
    names: { name: string; dose: string; frequency: string; route: string; startDate: string; stopDate: string; indication: string },
  ): ProjectedProduct => compact({
    productId: expected.productId,
    name: form.getTextField(names.name).getText(),
    dose: form.getTextField(names.dose).getText(),
    frequency: decodeFrequency(form.getDropdown(names.frequency).getSelected()[0]),
    route: decodeRoute(form.getDropdown(names.route).getSelected()[0]),
    startDate: parseDate(form.getTextField(names.startDate).getText()),
    stopDate: parseDate(form.getTextField(names.stopDate).getText()),
    indication: form.getTextField(names.indication).getText(),
  });
  const suspectNames = [
    { name: fields.productOneName, dose: fields.productOneDose, frequency: fields.productOneFrequency, route: fields.productOneRoute, startDate: fields.productOneStartDate, stopDate: fields.productOneStopDate, indication: fields.productOneIndication },
    { name: fields.productTwoName, dose: fields.productTwoDose, frequency: fields.productTwoFrequency, route: fields.productTwoRoute, startDate: fields.productTwoStartDate, stopDate: fields.productTwoStopDate, indication: fields.productTwoIndication },
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
        ageYears: form.getCheckBox(fields.ageYears).isChecked()
          ? Number(form.getTextField(fields.ageValue).getText())
          : undefined,
        sex: form.getCheckBox(fields.sexFemale).isChecked()
          ? "female"
          : form.getCheckBox(fields.sexMale).isChecked() ? "male" : undefined,
      }),
      B: compact({
        reportType: form.getCheckBox(fields.adverseEvent).isChecked() ? "adverse-event" : undefined,
        eventDate: parseDate(form.getTextField(fields.eventDate).getText()),
        eventDescription: form.getTextField(fields.eventNarrative).getText(),
        hospitalized: form.getCheckBox(fields.hospitalized).isChecked() || undefined,
        relevantTests: form.getTextField(fields.relevantTests).getText(),
      }),
      D: {
        suspectProducts: projection.sections.D.suspectProducts.map((product, index) => readSuspect(product, suspectNames[index])),
      },
      F: { concomitantProducts },
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

function encodeFrequency(value: string): string {
  if (value === "twice daily") return "BID";
  if (value === "daily") return "Daily";
  throw new Error(`Unsupported Form 3500 frequency ${value}`);
}

function decodeFrequency(value: string | undefined): string | undefined {
  if (!value || value === " ") return undefined;
  if (value === "BID") return "twice daily";
  if (value === "Daily") return "daily";
  throw new Error(`Unreadable Form 3500 frequency ${value}`);
}

function encodeRoute(value: string): string {
  if (value === "oral") return "Oral";
  throw new Error(`Unsupported Form 3500 route ${value}`);
}

function decodeRoute(value: string | undefined): string | undefined {
  if (!value || value === " ") return undefined;
  if (value === "Oral") return "oral";
  throw new Error(`Unreadable Form 3500 route ${value}`);
}
