import { writeFile } from "node:fs/promises";
import type { ModelProposalOutput } from "../../src/domain/case/model-boundary.ts";

export const richOpening = "Patient TEST-68 is a 68-year-old man. He began cephalexin 500 mg by mouth twice daily on 01-Aug-2026 for cellulitis. On 04-Aug-2026 he developed diffuse hives and facial swelling and was hospitalized. Cephalexin was stopped, he was treated with epinephrine and diphenhydramine, and he recovered and was discharged on 05-Aug-2026. I suspect cephalexin.";
export const sparseOpening = "Patient TEST-31 is a 31-year-old woman. She developed nausea and vomiting while taking metformin. I suspect metformin. She does not know the dose, when metformin began, or when the symptoms started. She was not hospitalized.";
export const repeatedOpening = "Patient TEST-44 is a 44-year-old man. He began acetaminophen (Tylenol) 1,000 mg by mouth twice daily on 01-Jul-2026 for back pain and ibuprofen 400 mg by mouth twice daily on 03-Jul-2026 for back pain. On 05-Jul-2026 he developed nausea and right upper abdominal pain and was hospitalized. Tylenol and ibuprofen were stopped, he received intravenous fluids, and he recovered and was discharged on 07-Jul-2026. I suspect acetaminophen and ibuprofen.";
export const repeatedUpdate = "Correction: the ibuprofen dose was 200 mg twice daily, not 400 mg twice daily. My medication list says acetaminophen began 02-Jul-2026 rather than 01-Jul-2026. I cannot resolve which date is correct.";
export const regressionOpening = "Patient TEST-57 is a 57-year-old woman. She was taking apixaban 5 mg by mouth twice daily; I recorded the start as 12-Aug-2026. She also took naproxen 500 mg by mouth twice daily starting 10-Aug-2026, and lisinopril 10 mg by mouth daily as a concomitant medicine. On 18-Aug-2026 she developed melena and dizziness and was hospitalized. Her hemoglobin was 7.8 g/dL. Apixaban and naproxen were stopped, she received two units of packed red cells, and she recovered and was discharged on 21-Aug-2026. I suspect apixaban and naproxen.";
export const regressionUpdate = "Correction: the naproxen dose was 250 mg twice daily, not 500 mg twice daily. Also, the medication administration record lists apixaban starting 13-Aug-2026, but my note says 12-Aug-2026. I can't resolve that yet.";

type Target = ModelProposalOutput["proposals"][number]["target"];
type Value = ModelProposalOutput["proposals"][number]["value"];

function proposal(
  proposalReference: string,
  groupReference: string,
  target: Target,
  value: Value,
  evidenceQuote: string,
  intent: "fact" | "correction" | "alternative" = "fact",
) {
  return { proposalReference, groupReference, intent, target, value, evidenceQuote };
}

const known = <T extends string | number | boolean | string[]>(value: T) => ({ kind: "known" as const, value });
const product = (productReference: string, field: "name" | "role" | "dose" | "frequency" | "route" | "startDate" | "stopDate" | "indication" | "stopped") => ({ entity: "product" as const, productReference, field });

function richResponse(): ModelProposalOutput {
  const patient = "Patient TEST-68 is a 68-year-old man.";
  const regimen = "He began cephalexin 500 mg by mouth twice daily on 01-Aug-2026 for cellulitis.";
  const event = "On 04-Aug-2026 he developed diffuse hives and facial swelling and was hospitalized.";
  const result = "Cephalexin was stopped, he was treated with epinephrine and diphenhydramine, and he recovered and was discharged on 05-Aug-2026.";
  return { products: [{ productReference: "p1", groupReference: "g1" }], proposals: [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-68"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(68), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("male"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["diffuse hives", "facial swelling"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-08-04"), event),
    proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(true), event),
    proposal("event-treatments", "event", { entity: "event", field: "treatments" }, known(["epinephrine", "diphenhydramine"]), result),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
    proposal("event-discharge", "event", { entity: "event", field: "dischargeDate" }, known("2026-08-05"), result),
    proposal("product-name", "g1", product("p1", "name"), known("cephalexin"), regimen),
    proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect cephalexin"),
    proposal("product-dose", "g1", product("p1", "dose"), known("500 mg"), regimen),
    proposal("product-frequency", "g1", product("p1", "frequency"), known("twice daily"), regimen),
    proposal("product-route", "g1", product("p1", "route"), known("oral"), regimen),
    proposal("product-start", "g1", product("p1", "startDate"), known("2026-08-01"), regimen),
    proposal("product-indication", "g1", product("p1", "indication"), known("cellulitis"), regimen),
    proposal("product-stopped", "g1", product("p1", "stopped"), known(true), result),
  ] };
}

function sparseResponse(): ModelProposalOutput {
  const patient = "Patient TEST-31 is a 31-year-old woman.";
  const event = "She developed nausea and vomiting while taking metformin.";
  const unknown = "She does not know the dose, when metformin began, or when the symptoms started.";
  return { products: [{ productReference: "p1", groupReference: "g1" }], proposals: [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-31"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(31), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("female"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["nausea", "vomiting"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, { kind: "unknown" }, unknown),
    proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(false), "She was not hospitalized"),
    proposal("product-name", "g1", product("p1", "name"), known("metformin"), event),
    proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect metformin"),
    proposal("product-dose", "g1", product("p1", "dose"), { kind: "unknown" }, unknown),
    proposal("product-start", "g1", product("p1", "startDate"), { kind: "unknown" }, unknown),
  ] };
}

function repeatedResponse(): ModelProposalOutput {
  const patient = "Patient TEST-44 is a 44-year-old man.";
  const regimens = "He began acetaminophen (Tylenol) 1,000 mg by mouth twice daily on 01-Jul-2026 for back pain and ibuprofen 400 mg by mouth twice daily on 03-Jul-2026 for back pain.";
  const event = "On 05-Jul-2026 he developed nausea and right upper abdominal pain and was hospitalized.";
  const result = "Tylenol and ibuprofen were stopped, he received intravenous fluids, and he recovered and was discharged on 07-Jul-2026.";
  const role = "I suspect acetaminophen and ibuprofen";
  const proposals = [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-44"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(44), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("male"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["nausea", "right upper abdominal pain"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-07-05"), event),
    proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(true), event),
    proposal("event-treatments", "event", { entity: "event", field: "treatments" }, known(["intravenous fluids"]), result),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
    proposal("event-discharge", "event", { entity: "event", field: "dischargeDate" }, known("2026-07-07"), result),
  ];
  for (const [ref, name, dose, start] of [["p1", "acetaminophen (Tylenol)", "1,000 mg", "2026-07-01"], ["p2", "ibuprofen", "400 mg", "2026-07-03"]] as const) {
    proposals.push(
      proposal(`${ref}-name`, ref === "p1" ? "g1" : "g2", product(ref, "name"), known(name), regimens),
      proposal(`${ref}-role`, ref === "p1" ? "g1" : "g2", product(ref, "role"), known("suspect"), role),
      proposal(`${ref}-dose`, ref === "p1" ? "g1" : "g2", product(ref, "dose"), known(dose), regimens),
      proposal(`${ref}-frequency`, ref === "p1" ? "g1" : "g2", product(ref, "frequency"), known("twice daily"), regimens),
      proposal(`${ref}-route`, ref === "p1" ? "g1" : "g2", product(ref, "route"), known("oral"), regimens),
      proposal(`${ref}-start`, ref === "p1" ? "g1" : "g2", product(ref, "startDate"), known(start), regimens),
      proposal(`${ref}-indication`, ref === "p1" ? "g1" : "g2", product(ref, "indication"), known("back pain"), regimens),
      proposal(`${ref}-stopped`, ref === "p1" ? "g1" : "g2", product(ref, "stopped"), known(true), result),
    );
  }
  return { products: [{ productReference: "p1", groupReference: "g1" }, { productReference: "p2", groupReference: "g2" }], proposals };
}

function repeatedCorrectionResponse(): ModelProposalOutput {
  return { products: [], proposals: [
    proposal("dose-correction", "u1", product("product-repeated-p2", "dose"), known("200 mg"), "Correction: the ibuprofen dose was 200 mg twice daily, not 400 mg twice daily.", "correction"),
    proposal("date-alternative", "u2", product("product-repeated-p1", "startDate"), known("2026-07-02"), "My medication list says acetaminophen began 02-Jul-2026 rather than 01-Jul-2026. I cannot resolve which date is correct.", "alternative"),
  ] };
}

function regressionResponses(): [ModelProposalOutput, ModelProposalOutput] {
  const patient = "Patient TEST-57 is a 57-year-old woman.";
  const event = "On 18-Aug-2026 she developed melena and dizziness and was hospitalized.";
  const result = "Apixaban and naproxen were stopped, she received two units of packed red cells, and she recovered and was discharged on 21-Aug-2026.";
  const regimens = [
    ["p1", "g1", "apixaban", "5 mg", "twice daily", "apixaban 5 mg by mouth twice daily", "I recorded the start as 12-Aug-2026", "2026-08-12", "suspect"],
    ["p2", "g2", "naproxen", "500 mg", "twice daily", "naproxen 500 mg by mouth twice daily starting 10-Aug-2026", "starting 10-Aug-2026", "2026-08-10", "suspect"],
    ["p3", "g3", "lisinopril", "10 mg", "daily", "lisinopril 10 mg by mouth daily as a concomitant medicine", "", "", "concomitant"],
  ] as const;
  const proposals = [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-57"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(57), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("female"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["melena", "dizziness"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-08-18"), event),
    proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(true), event),
    proposal("event-hemoglobin", "event", { entity: "event", field: "hemoglobin" }, known("7.8 g/dL"), "Her hemoglobin was 7.8 g/dL"),
    proposal("event-treatment", "event", { entity: "event", field: "treatments" }, known(["two units of packed red cells"]), result),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
    proposal("event-discharge", "event", { entity: "event", field: "dischargeDate" }, known("2026-08-21"), result),
  ];
  for (const [ref, group, name, dose, frequency, regimen, dateEvidence, startDate, role] of regimens) {
    proposals.push(
      proposal(`${ref}-name`, group, product(ref, "name"), known(name), regimen),
      proposal(`${ref}-role`, group, product(ref, "role"), known(role), role === "suspect" ? "I suspect apixaban and naproxen" : regimen),
      proposal(`${ref}-dose`, group, product(ref, "dose"), known(dose), regimen),
      proposal(`${ref}-frequency`, group, product(ref, "frequency"), known(frequency), regimen),
      proposal(`${ref}-route`, group, product(ref, "route"), known("oral"), regimen),
    );
    if (startDate) proposals.push(proposal(`${ref}-start`, group, product(ref, "startDate"), known(startDate), dateEvidence));
    if (role === "suspect") proposals.push(proposal(`${ref}-stopped`, group, product(ref, "stopped"), known(true), result));
  }
  const rawOpening: ModelProposalOutput = {
    products: regimens.map(([productReference, groupReference]) => ({ productReference, groupReference })),
    proposals,
  };
  const rawCorrection: ModelProposalOutput = { products: [], proposals: [
    proposal("dose-correction", "u1", product("product-experiment-1-p2", "dose"), known("250 mg"), "Correction: the naproxen dose was 250 mg twice daily, not 500 mg twice daily.", "correction"),
    proposal("date-alternative", "u2", product("product-experiment-1-p1", "startDate"), known("2026-08-13"), "the medication administration record lists apixaban starting 13-Aug-2026, but my note says 12-Aug-2026. I can't resolve that yet", "alternative"),
  ] };
  return [rawOpening, rawCorrection];
}

const [regressionOpeningResponse, regressionCorrectionResponse] = regressionResponses();
const responses = [
  { identityScope: "rich", turn: "opening", output: richResponse() },
  { identityScope: "sparse", turn: "opening", output: sparseResponse() },
  { identityScope: "repeated", turn: "opening", output: repeatedResponse() },
  { identityScope: "repeated-update", turn: "correction", output: repeatedCorrectionResponse() },
  { identityScope: "change-remove", turn: "opening", output: regressionOpeningResponse },
  { identityScope: "experiment-1", turn: "opening", output: regressionOpeningResponse },
  { identityScope: "experiment-1-update", turn: "correction", output: regressionCorrectionResponse },
];

if (process.argv[1]?.endsWith("build-predetermined-responses.ts")) {
  await writeFile("tests/e2e/predetermined-model-responses.json", `${JSON.stringify(responses, null, 2)}\n`);
}
