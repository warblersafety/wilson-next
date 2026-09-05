import { createHash } from "node:crypto";
import { PDFDocument } from "@cantoo/pdf-lib";

export const FORM_3500_VERSION = "09/2025";
export const FORM_3500_PAGE_COUNT = 8;
export const FORM_3500_SHA256 =
  "1147d7c86bb002cba7fb9352ca8e3402524d8fa0236916b7bf7e5dcdcf88bf9c";

const fields = {
  patientIdentifier:
    "topmostSubform[0].Page1[0].SecA_Patient[0].PatientIdentifier[0]",
  hospitalized: "topmostSubform[0].Page1[0].SecA_Patient[0].Hospital[0]",
  eventNarrative:
    "topmostSubform[0].Page2[0].SecB_Adverse[0].DescEvent[0]",
  productOneName: "topmostSubform[0].Page4[0].Prod1[0].Prod1Name[0]",
  productOneRoute: "topmostSubform[0].Page4[0].Prod1[0].Prod1Route[0]",
  productTwoName: "topmostSubform[0].Page5[0].Prod2[0].Prod2Name[0]",
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
