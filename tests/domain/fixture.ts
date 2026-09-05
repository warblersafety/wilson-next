import { applyCaseCommand } from "../../src/domain/case/commands";
import { createSemanticCase } from "../../src/domain/case/create";
import { parseModelProposalEnvelope } from "../../src/domain/case/model-boundary";
import type {
  CaseValue,
  FactTarget,
  SemanticCase,
  Source,
} from "../../src/domain/case/types";

export const openingAccount =
  "Patient TEST-57 is a 57-year-old woman. She was taking apixaban 5 mg by mouth twice daily; I recorded the start as 12-Aug-2026. She also took naproxen 500 mg by mouth twice daily starting 10-Aug-2026, and lisinopril 10 mg by mouth daily as a concomitant medicine. On 18-Aug-2026 she developed melena and dizziness and was hospitalized. Her hemoglobin was 7.8 g/dL. Apixaban and naproxen were stopped, she received two units of packed red cells, and she recovered and was discharged on 21-Aug-2026. I suspect apixaban and naproxen.";

export const correctionAccount =
  "Correction: the naproxen dose was 250 mg twice daily, not 500 mg twice daily. Also, the medication administration record lists apixaban starting 13-Aug-2026, but my note says 12-Aug-2026. I can't resolve that yet.";

const at = "2026-09-05T20:00:00.000Z";

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
  const start = text.indexOf(excerpt);
  if (start === -1) throw new Error(`Missing fixture excerpt: ${excerpt}`);
  return {
    proposalId,
    groupId,
    intent,
    target,
    value,
    source: { id: `source-${proposalId}`, start, end: start + excerpt.length },
  };
}

export function createOpeningCase(): SemanticCase {
  const parsed = parseModelProposalEnvelope({
    input: { id: "input-opening", type: "narrative", text: openingAccount, recordedAt: at },
    products: [
      { id: "product-apixaban", groupId: "product-apixaban" },
      { id: "product-naproxen", groupId: "product-naproxen" },
      { id: "product-lisinopril", groupId: "product-lisinopril" },
    ],
    proposals: [
      proposal(openingAccount, "patient-id", "patient", { entity: "patient", entityId: "patient", field: "identifier" }, known("TEST-57"), "Patient TEST-57"),
      proposal(openingAccount, "patient-age", "patient", { entity: "patient", entityId: "patient", field: "ageYears" }, known(57), "57-year-old"),
      proposal(openingAccount, "patient-sex", "patient", { entity: "patient", entityId: "patient", field: "sex" }, known("female"), "woman"),
      proposal(openingAccount, "event-symptoms", "event", { entity: "event", entityId: "event", field: "symptoms" }, known(["melena", "dizziness"]), "melena and dizziness"),
      proposal(openingAccount, "event-onset", "event", { entity: "event", entityId: "event", field: "onsetDate" }, known("2026-08-18"), "On 18-Aug-2026"),
      proposal(openingAccount, "event-hospitalized", "event", { entity: "event", entityId: "event", field: "hospitalized" }, known(true), "was hospitalized"),
      proposal(openingAccount, "event-hemoglobin", "event", { entity: "event", entityId: "event", field: "hemoglobin" }, known("7.8 g/dL"), "hemoglobin was 7.8 g/dL"),
      proposal(openingAccount, "event-treatment", "event", { entity: "event", entityId: "event", field: "treatments" }, known(["two units of packed red cells"]), "received two units of packed red cells"),
      proposal(openingAccount, "event-outcome", "event", { entity: "event", entityId: "event", field: "outcome" }, known("recovered"), "she recovered"),
      proposal(openingAccount, "event-discharge", "event", { entity: "event", entityId: "event", field: "dischargeDate" }, known("2026-08-21"), "discharged on 21-Aug-2026"),
      ...productProposals("product-apixaban", "apixaban", "5 mg", "2026-08-12", "apixaban 5 mg by mouth twice daily", "start as 12-Aug-2026", "suspect"),
      ...productProposals("product-naproxen", "naproxen", "500 mg", "2026-08-10", "naproxen 500 mg by mouth twice daily", "starting 10-Aug-2026", "suspect"),
      ...productProposals("product-lisinopril", "lisinopril", "10 mg", undefined, "lisinopril 10 mg by mouth daily", undefined, "concomitant"),
      proposal(openingAccount, "apixaban-stopped", "product-apixaban", { entity: "product", entityId: "product-apixaban", field: "stopped" }, known(true), "Apixaban and naproxen were stopped"),
      proposal(openingAccount, "naproxen-stopped", "product-naproxen", { entity: "product", entityId: "product-naproxen", field: "stopped" }, known(true), "Apixaban and naproxen were stopped"),
    ],
  });

  return applyCaseCommand(createSemanticCase("case-test-57"), {
    type: "attach-grounded-proposals",
    commandId: "command-attach-opening",
    expectedRevision: 0,
    ...parsed,
  }).case;
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
  const groupId = productId;
  const target = (field: "name" | "role" | "dose" | "frequency" | "route" | "startDate") => ({
    entity: "product" as const,
    entityId: productId,
    field,
  });
  const values = [
    proposal(openingAccount, `${name}-name`, groupId, target("name"), known(name), regimenExcerpt),
    proposal(openingAccount, `${name}-role`, groupId, target("role"), known(role), role === "suspect" ? "I suspect apixaban and naproxen" : "as a concomitant medicine"),
    proposal(openingAccount, `${name}-dose`, groupId, target("dose"), known(dose), regimenExcerpt),
    proposal(openingAccount, `${name}-frequency`, groupId, target("frequency"), known(name === "lisinopril" ? "daily" : "twice daily"), regimenExcerpt),
    proposal(openingAccount, `${name}-route`, groupId, target("route"), known("oral"), regimenExcerpt),
  ];
  if (startDate && dateExcerpt) {
    values.push(proposal(openingAccount, `${name}-start`, groupId, target("startDate"), known(startDate), dateExcerpt));
  }
  return values;
}

export function acceptOpeningCase(caseState = createOpeningCase()): SemanticCase {
  return applyCaseCommand(caseState, {
    type: "review-proposal-groups",
    commandId: "command-review-opening",
    expectedRevision: caseState.revision,
    decisions: [
      { groupId: "patient", action: "accept" },
      { groupId: "event", action: "accept" },
      { groupId: "product-apixaban", action: "accept" },
      { groupId: "product-naproxen", action: "accept" },
      { groupId: "product-lisinopril", action: "accept" },
    ],
  }).case;
}

export function answerIndications(caseState: SemanticCase): SemanticCase {
  const question = applyCaseCommand(caseState, {
    type: "record-asked-need",
    commandId: "command-ask-indications",
    expectedRevision: caseState.revision,
    key: "suspect-product-indications",
    productIds: ["product-apixaban", "product-naproxen"],
  }).case;
  const text = "Apixaban was for postoperative VTE prophylaxis after knee replacement. Naproxen was for postoperative pain.";
  const source: Source = {
    id: "source-indication-answer",
    inputId: "input-indication-answer",
    inputType: "answer",
    excerpt: text,
    start: 0,
    end: text.length,
    actor: "clinician",
    recordedAt: at,
  };
  return applyCaseCommand(question, {
    type: "record-clinician-facts",
    commandId: "command-answer-indications",
    expectedRevision: question.revision,
    source,
    answersNeed: "suspect-product-indications",
    facts: [
      {
        id: "answer-apixaban-indication",
        target: { entity: "product", entityId: "product-apixaban", field: "indication" },
        intent: "fact",
        value: known("postoperative VTE prophylaxis after knee replacement"),
      },
      {
        id: "answer-naproxen-indication",
        target: { entity: "product", entityId: "product-naproxen", field: "indication" },
        intent: "fact",
        value: known("postoperative pain"),
      },
    ],
  }).case;
}

export function attachCorrectionAndContradiction(caseState: SemanticCase): SemanticCase {
  const parsed = parseModelProposalEnvelope({
    input: { id: "input-correction", type: "correction", text: correctionAccount, recordedAt: at },
    products: [],
    proposals: [
      proposal(correctionAccount, "naproxen-dose-correction", "naproxen-dose-correction", { entity: "product", entityId: "product-naproxen", field: "dose" }, known("250 mg"), "naproxen dose was 250 mg twice daily, not 500 mg twice daily", "correction"),
      proposal(correctionAccount, "apixaban-date-alternative", "apixaban-date-conflict", { entity: "product", entityId: "product-apixaban", field: "startDate" }, known("2026-08-13"), "medication administration record lists apixaban starting 13-Aug-2026", "alternative"),
    ],
  });
  return applyCaseCommand(caseState, {
    type: "attach-grounded-proposals",
    commandId: "command-attach-correction",
    expectedRevision: caseState.revision,
    ...parsed,
  }).case;
}

export function acceptCorrectionAndConflict(caseState: SemanticCase): SemanticCase {
  return applyCaseCommand(caseState, {
    type: "review-proposal-groups",
    commandId: "command-review-correction",
    expectedRevision: caseState.revision,
    decisions: [
      { groupId: "naproxen-dose-correction", action: "accept" },
      { groupId: "apixaban-date-conflict", action: "accept" },
    ],
  }).case;
}

export function resolveApixabanDate(caseState: SemanticCase): SemanticCase {
  const text = "Use 13-Aug-2026 as the apixaban start date.";
  return applyCaseCommand(caseState, {
    type: "resolve-conflict",
    commandId: "command-resolve-apixaban-date",
    expectedRevision: caseState.revision,
    target: { entity: "product", entityId: "product-apixaban", field: "startDate" },
    chosenValueId: "apixaban-date-alternative",
    source: {
      id: "source-date-resolution",
      inputId: "input-date-resolution",
      inputType: "resolution",
      excerpt: text,
      start: 0,
      end: text.length,
      actor: "clinician",
      recordedAt: at,
    },
  }).case;
}

export function completeResolvedCase(): SemanticCase {
  return resolveApixabanDate(
    acceptCorrectionAndConflict(
      attachCorrectionAndContradiction(
        answerIndications(acceptOpeningCase()),
      ),
    ),
  );
}
