import {
  parseModelProposalEnvelope,
  type ModelBoundaryIdentityFactory,
} from "../../src/domain/case/model-boundary";
import type { CaseValue, FactTarget } from "../../src/domain/case/types";
import {
  correctionAccount,
  fixedRecordedAt,
  openingAccount,
} from "./fixed-inputs";
import type { JourneyModel } from "../../src/server/model/journey-model";

function known<T>(value: T): CaseValue<T> {
  return { kind: "known", value };
}

function proposal(
  text: string,
  proposalId: string,
  groupId: string,
  target: FactTarget,
  value: CaseValue<unknown>,
  excerpt: string,
  intent: "fact" | "correction" | "alternative" = "fact",
) {
  if (!text.includes(excerpt)) throw new Error(`Fixed response excerpt is missing: ${excerpt}`);
  const modelTarget = target.entity === "product"
    ? { entity: "product" as const, productReference: target.entityId, field: target.field }
    : target.entity === "test"
      ? { entity: "test" as const, testReference: target.entityId, field: target.field }
      : { entity: target.entity, field: target.field };
  return {
    proposalReference: proposalId,
    groupReference: groupId,
    intent,
    target: modelTarget,
    value,
    evidenceQuote: excerpt,
  };
}

function productProposals(
  productId: string,
  name: string,
  dose: string,
  startDate: string | undefined,
  regimenExcerpt: string,
  dateExcerpt: string | undefined,
  role: "suspect" | "concomitant",
) {
  const target = (field: "name" | "productType" | "role" | "dose" | "frequency" | "route" | "startDate") => ({
    entity: "product" as const,
    entityId: productId,
    field,
  });
  const values = [
    proposal(openingAccount, `${name}-name`, productId, target("name"), known(name), regimenExcerpt),
    proposal(openingAccount, `${name}-type`, productId, target("productType"), known("drug-or-biologic"), regimenExcerpt),
    proposal(
      openingAccount,
      `${name}-role`,
      productId,
      target("role"),
      known(role),
      role === "suspect"
        ? "I suspect apixaban and naproxen"
        : `${regimenExcerpt} as a concomitant medicine`,
    ),
    proposal(openingAccount, `${name}-dose`, productId, target("dose"), known(dose), regimenExcerpt),
    proposal(
      openingAccount,
      `${name}-frequency`,
      productId,
      target("frequency"),
      known(name === "lisinopril" ? "daily" : "twice daily"),
      regimenExcerpt,
    ),
    proposal(openingAccount, `${name}-route`, productId, target("route"), known("oral"), regimenExcerpt),
  ];
  if (startDate && dateExcerpt) {
    values.push(proposal(openingAccount, `${name}-start`, productId, target("startDate"), known(startDate), dateExcerpt));
  }
  return values;
}

export function parseFixedOpeningResponse(text: string) {
  if (text !== openingAccount) {
    throw new Error("This experiment accepts only the displayed fictional opening account");
  }
  return parseModelProposalEnvelope({
    turn: "opening",
    input: { id: "input-opening", type: "narrative", text, recordedAt: fixedRecordedAt },
    output: {
      products: [
        { productReference: "product-apixaban", groupReference: "product-apixaban" },
        { productReference: "product-naproxen", groupReference: "product-naproxen" },
        { productReference: "product-lisinopril", groupReference: "product-lisinopril" },
      ],
      tests: [{ testReference: "test-hemoglobin", groupReference: "test-hemoglobin" }],
      proposals: [
      proposal(text, "patient-id", "patient", { entity: "patient", entityId: "patient", field: "identifier" }, known("TEST-57"), "Patient TEST-57"),
      proposal(text, "patient-age", "patient", { entity: "patient", entityId: "patient", field: "ageYears" }, known(57), "57-year-old"),
      proposal(text, "patient-sex", "patient", { entity: "patient", entityId: "patient", field: "sex" }, known("female"), "woman"),
      proposal(text, "event-symptoms", "event", { entity: "event", entityId: "event", field: "symptoms" }, known(["melena", "dizziness"]), "melena and dizziness"),
      proposal(text, "event-onset", "event", { entity: "event", entityId: "event", field: "onsetDate" }, known("2026-08-18"), "On 18-Aug-2026"),
      proposal(text, "event-hospitalized", "event", { entity: "event", entityId: "event", field: "hospitalized" }, known(true), "was hospitalized"),
      proposal(text, "test-hemoglobin", "test-hemoglobin", { entity: "test", entityId: "test-hemoglobin", field: "testResult" }, known("Hemoglobin: 7.8 g/dL"), "hemoglobin was 7.8 g/dL"),
      proposal(text, "event-treatment", "event", { entity: "event", entityId: "event", field: "treatments" }, known(["two units of packed red cells"]), "received two units of packed red cells"),
      proposal(text, "event-outcome", "event", { entity: "event", entityId: "event", field: "outcome" }, known("recovered"), "she recovered"),
      proposal(text, "event-discharge", "event", { entity: "event", entityId: "event", field: "dischargeDate" }, known("2026-08-21"), "discharged on 21-Aug-2026"),
      ...productProposals("product-apixaban", "apixaban", "5 mg", "2026-08-12", "apixaban 5 mg by mouth twice daily", "start as 12-Aug-2026", "suspect"),
      ...productProposals("product-naproxen", "naproxen", "500 mg", "2026-08-10", "naproxen 500 mg by mouth twice daily", "starting 10-Aug-2026", "suspect"),
      ...productProposals("product-lisinopril", "lisinopril", "10 mg", undefined, "lisinopril 10 mg by mouth daily", undefined, "concomitant"),
      proposal(text, "apixaban-stopped", "product-apixaban", { entity: "product", entityId: "product-apixaban", field: "stopped" }, known(true), "Apixaban and naproxen were stopped"),
      proposal(text, "naproxen-stopped", "product-naproxen", { entity: "product", entityId: "product-naproxen", field: "stopped" }, known(true), "Apixaban and naproxen were stopped"),
      ],
    },
  }, fixedIdentity);
}

export function parseFixedCorrectionResponse(text: string) {
  if (text !== correctionAccount) {
    throw new Error("This experiment accepts only the displayed fictional correction account");
  }
  return parseModelProposalEnvelope({
    turn: "correction",
    input: { id: "input-correction", type: "correction", text, recordedAt: fixedRecordedAt },
    existingProductIds: ["product-apixaban", "product-naproxen", "product-lisinopril"],
    output: {
      products: [],
      tests: [],
      proposals: [
        proposal(text, "naproxen-dose-correction", "naproxen-dose-correction", { entity: "product", entityId: "product-naproxen", field: "dose" }, known("250 mg"), "naproxen dose was 250 mg twice daily, not 500 mg twice daily", "correction"),
        proposal(text, "apixaban-date-alternative", "apixaban-date-conflict", { entity: "product", entityId: "product-apixaban", field: "startDate" }, known("2026-08-13"), "medication administration record lists apixaban starting 13-Aug-2026", "alternative"),
      ],
    },
  }, fixedIdentity);
}

const fixedIdentity: ModelBoundaryIdentityFactory = (kind, reference) => {
  if (kind === "product" || kind === "test" || kind === "group" || kind === "proposal") return reference;
  if (kind === "source") return `source-${reference}`;
  return `input-${reference}`;
};

export const fixedJourneyModel: JourneyModel = {
  async propose(turn, text) {
    return {
      envelope: turn === "opening"
        ? parseFixedOpeningResponse(text)
        : parseFixedCorrectionResponse(text),
    };
  },
};
