import { writeFile } from "node:fs/promises";
import type { ModelProposalOutput } from "../../src/domain/case/model-boundary.ts";
import type { ProductFactKey } from "../../src/domain/case/types.ts";

export const richOpening = "Patient TEST-68 is a 68-year-old man. He began cephalexin 500 mg by mouth twice daily on 01-Aug-2026 for cellulitis. On 04-Aug-2026 he developed diffuse hives and facial swelling and was hospitalized. Cephalexin was stopped, he was treated with epinephrine and diphenhydramine, and he recovered and was discharged on 05-Aug-2026. I suspect cephalexin.";
export const adaptiveRichOpening = "Patient TEST-72 is a 72-year-old woman weighing 64 kg. She began amoxicillin 500 mg by mouth twice daily on 01-Sep-2026 for sinusitis. On 03-Sep-2026 she developed a generalized rash and wheezing; the event was life-threatening and she was hospitalized. Serum tryptase was 18 ng/mL (reference range 0 to 11.4) on 03-Sep-2026. Her relevant history is a penicillin allergy. Amoxicillin was stopped, she received epinephrine, and she recovered. I suspect amoxicillin.";
export const adaptiveSparseOpening = "Patient TEST-26 is a 26-year-old man. He developed severe dizziness while taking propranolol. I suspect propranolol.";
export const layer1DeathOpening = "Patient TEST-63 is a 63-year-old man. He began trimethoprim-sulfamethoxazole 160/800 mg by mouth twice daily on 01-Sep-2026 for a urinary tract infection. On 06-Sep-2026 he developed a widespread blistering rash and died. A skin biopsy on 06-Sep-2026 showed full-thickness epidermal necrosis. No other relevant medical history applies. Trimethoprim-sulfamethoxazole was stopped. I suspect trimethoprim-sulfamethoxazole.";
export const layer1TestsOpening = "Patient TEST-51 is a 51-year-old woman. She began atorvastatin 40 mg by mouth daily on 01-Aug-2026 for hyperlipidemia. On 05-Sep-2026 she developed muscle pain and weakness. ALT was 132 U/L (reference range 7 to 56) on 05-Sep-2026; AST was 118 U/L (reference range 10 to 40) on 05-Sep-2026; total bilirubin was 2.1 mg/dL on 05-Sep-2026. No serious outcomes applied. No other relevant medical history applies. Atorvastatin was stopped, and she was improving. I suspect atorvastatin.";
export const layer1TestsUpdate = "Correction: the ALT result was 123 U/L, not 132 U/L.";
export const layer1RoleOpening = "Patient TEST-47 is a 47-year-old man. He began warfarin 5 mg by mouth daily on 01-Aug-2026 for atrial fibrillation and acetaminophen 650 mg by mouth every six hours on 02-Aug-2026. Warfarin is suspect; acetaminophen is concomitant. On 08-Aug-2026 he developed epistaxis and easy bruising. INR was 4.8 on 08-Aug-2026. No serious outcomes applied. No other relevant medical history applies. Warfarin was stopped and the symptoms resolved.";
export const layer1RoleUpdate = "Correction: acetaminophen should be treated as a suspect product, not a concomitant product.";
export const layer2DeviceOpening = "Patient TEST-74 is a 74-year-old woman. On 08-Sep-2026, an Acme FlowGuard IV infusion pump delivered fluid too rapidly after its alarm failed; she developed hypotension and was hospitalized. The pump was stopped, she received intravenous fluids, and she recovered. No other serious outcomes applied. No relevant tests or medical history apply. The suspect device is an Acme FlowGuard, common name infusion pump, manufactured by Acme Medical in Reno, Nevada, model FG-200, lot L-904, serial SN-7721, UDI (01)00812345000017(21)SN7721. It was operated by a registered nurse, was not implanted, was not a reprocessed single-use device, and was never serviced by a third party. The device is available for evaluation.";
export const layer2ProductQualityOpening = "An unopened bottle of Cardiovex 20 mg tablets, lot CV-442, contained visible brown particles under the seal. The product was not administered to a patient, and no adverse event occurred. The bottle is available for evaluation. I am reporting Cardiovex as the suspect product.";
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

const known = <T extends string | number | boolean | string[] | { value: number; unit: "kg" | "lb" }>(value: T) => ({ kind: "known" as const, value });
const product = (productReference: string, field: ProductFactKey) => ({ entity: "product" as const, productReference, field });
const test = (testReference: string, field: "testResult" | "lowRange" | "highRange" | "date") => ({ entity: "test" as const, testReference, field });

function adaptiveRichResponse(): ModelProposalOutput {
  const patient = "Patient TEST-72 is a 72-year-old woman weighing 64 kg.";
  const regimen = "She began amoxicillin 500 mg by mouth twice daily on 01-Sep-2026 for sinusitis.";
  const event = "On 03-Sep-2026 she developed a generalized rash and wheezing; the event was life-threatening and she was hospitalized.";
  const testEvidence = "Serum tryptase was 18 ng/mL (reference range 0 to 11.4) on 03-Sep-2026.";
  const result = "Amoxicillin was stopped, she received epinephrine, and she recovered.";
  return {
    products: [{ productReference: "p1", groupReference: "g1" }],
    tests: [{ testReference: "t1", groupReference: "gt1" }],
    proposals: [
      proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-72"), patient),
      proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(72), patient),
      proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("female"), patient),
      proposal("patient-weight", "patient", { entity: "patient", field: "weight" }, known({ value: 64, unit: "kg" }), patient),
      proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["generalized rash", "wheezing"]), event),
      proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-09-03"), event),
      proposal("event-life-threatening", "event", { entity: "event", field: "lifeThreatening" }, known(true), event),
      proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(true), event),
      proposal("event-history", "event", { entity: "event", field: "relevantHistory" }, known("Penicillin allergy"), "Her relevant history is a penicillin allergy."),
      proposal("event-treatment", "event", { entity: "event", field: "treatments" }, known(["epinephrine"]), result),
      proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
      proposal("test-result", "gt1", test("t1", "testResult"), known("Serum tryptase: 18 ng/mL"), testEvidence),
      proposal("test-low", "gt1", test("t1", "lowRange"), known("0 ng/mL"), testEvidence),
      proposal("test-high", "gt1", test("t1", "highRange"), known("11.4 ng/mL"), testEvidence),
      proposal("test-date", "gt1", test("t1", "date"), known("2026-09-03"), testEvidence),
      proposal("product-name", "g1", product("p1", "name"), known("amoxicillin"), regimen),
      proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), regimen),
      proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect amoxicillin"),
      proposal("product-dose", "g1", product("p1", "dose"), known("500 mg"), regimen),
      proposal("product-frequency", "g1", product("p1", "frequency"), known("twice daily"), regimen),
      proposal("product-route", "g1", product("p1", "route"), known("oral"), regimen),
      proposal("product-start", "g1", product("p1", "startDate"), known("2026-09-01"), regimen),
      proposal("product-indication", "g1", product("p1", "indication"), known("sinusitis"), regimen),
      proposal("product-stopped", "g1", product("p1", "stopped"), known(true), result),
    ],
  };
}

function adaptiveSparseResponse(): ModelProposalOutput {
  const patient = "Patient TEST-26 is a 26-year-old man.";
  const event = "He developed severe dizziness while taking propranolol.";
  return { products: [{ productReference: "p1", groupReference: "g1" }], proposals: [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-26"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(26), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("male"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["severe dizziness"]), event),
    proposal("product-name", "g1", product("p1", "name"), known("propranolol"), event),
    proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), event),
    proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect propranolol"),
  ] };
}

function layer1DeathResponse(): ModelProposalOutput {
  const patient = "Patient TEST-63 is a 63-year-old man.";
  const regimen = "He began trimethoprim-sulfamethoxazole 160/800 mg by mouth twice daily on 01-Sep-2026 for a urinary tract infection.";
  const event = "On 06-Sep-2026 he developed a widespread blistering rash and died.";
  const biopsy = "A skin biopsy on 06-Sep-2026 showed full-thickness epidermal necrosis.";
  const stopped = "Trimethoprim-sulfamethoxazole was stopped.";
  return {
    products: [{ productReference: "p1", groupReference: "g1" }],
    tests: [{ testReference: "biopsy", groupReference: "gt1" }],
    proposals: [
      proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-63"), patient),
      proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(63), patient),
      proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("male"), patient),
      proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["widespread blistering rash"]), event),
      proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-09-06"), event),
      proposal("event-death", "event", { entity: "event", field: "death" }, known(true), event),
      proposal("event-history", "event", { entity: "event", field: "relevantHistory" }, { kind: "explicitly-absent" }, "No other relevant medical history applies."),
      proposal("test-result", "gt1", test("biopsy", "testResult"), known("Skin biopsy: full-thickness epidermal necrosis"), biopsy),
      proposal("test-date", "gt1", test("biopsy", "date"), known("2026-09-06"), biopsy),
      proposal("product-name", "g1", product("p1", "name"), known("trimethoprim-sulfamethoxazole"), regimen),
      proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), regimen),
      proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect trimethoprim-sulfamethoxazole"),
      proposal("product-dose", "g1", product("p1", "dose"), known("160/800 mg"), regimen),
      proposal("product-frequency", "g1", product("p1", "frequency"), known("twice daily"), regimen),
      proposal("product-route", "g1", product("p1", "route"), known("oral"), regimen),
      proposal("product-start", "g1", product("p1", "startDate"), known("2026-09-01"), regimen),
      proposal("product-indication", "g1", product("p1", "indication"), known("urinary tract infection"), regimen),
      proposal("product-stopped", "g1", product("p1", "stopped"), known(true), stopped),
    ],
  };
}

const noSeriousOutcomes = ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"] as const;

function layer2DeviceResponse(): ModelProposalOutput {
  const patient = "Patient TEST-74 is a 74-year-old woman.";
  const event = "On 08-Sep-2026, an Acme FlowGuard IV infusion pump delivered fluid too rapidly after its alarm failed; she developed hypotension and was hospitalized.";
  const result = "The pump was stopped, she received intravenous fluids, and she recovered.";
  const context = "No relevant tests or medical history apply.";
  const device = "The suspect device is an Acme FlowGuard, common name infusion pump, manufactured by Acme Medical in Reno, Nevada, model FG-200, lot L-904, serial SN-7721, UDI (01)00812345000017(21)SN7721.";
  const operation = "It was operated by a registered nurse, was not implanted, was not a reprocessed single-use device, and was never serviced by a third party.";
  const proposals: ModelProposalOutput["proposals"] = [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-74"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(74), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("female"), patient),
    proposal("event-problem", "event", { entity: "event", field: "problemDescription" }, known("Acme FlowGuard IV infusion pump delivered fluid too rapidly after its alarm failed"), event),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["hypotension"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-09-08"), event),
    proposal("event-hospitalized", "event", { entity: "event", field: "hospitalized" }, known(true), event),
    proposal("event-treatment", "event", { entity: "event", field: "treatments" }, known(["intravenous fluids"]), result),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
    proposal("tests-none", "event", { entity: "event", field: "relevantTestsAvailable" }, known(false), context),
    proposal("history-none", "event", { entity: "event", field: "relevantHistory" }, { kind: "explicitly-absent" }, context),
    proposal("availability", "event", { entity: "event", field: "productAvailability" }, known("available"), "The device is available for evaluation."),
    proposal("device-name", "g1", product("device", "name"), known("Acme FlowGuard"), device),
    proposal("device-type", "g1", product("device", "productType"), known("device"), device),
    proposal("device-role", "g1", product("device", "role"), known("suspect"), device),
    proposal("device-common", "g1", product("device", "commonName"), known("infusion pump"), device),
    proposal("device-manufacturer", "g1", product("device", "manufacturer"), known("Acme Medical, Reno, Nevada"), device),
    proposal("device-model", "g1", product("device", "modelNumber"), known("FG-200"), device),
    proposal("device-lot", "g1", product("device", "lotNumber"), known("L-904"), device),
    proposal("device-serial", "g1", product("device", "serialNumber"), known("SN-7721"), device),
    proposal("device-udi", "g1", product("device", "udi"), known("(01)00812345000017(21)SN7721"), device),
    proposal("device-operator", "g1", product("device", "deviceOperator"), known("health-professional"), operation),
    proposal("device-implant", "g1", product("device", "implantDate"), { kind: "inapplicable" }, operation),
    proposal("device-reprocessed", "g1", product("device", "reprocessedSingleUse"), known(false), operation),
    proposal("device-serviced", "g1", product("device", "servicedByThirdParty"), known("no"), operation),
  ];
  for (const field of noSeriousOutcomes.filter((field) => field !== "hospitalized")) {
    proposals.push(proposal(`event-${field}`, "event", { entity: "event", field }, known(false), "No other serious outcomes applied."));
  }
  return { products: [{ productReference: "device", groupReference: "g1" }], proposals };
}

function layer2ProductQualityResponse(): ModelProposalOutput {
  const problem = "An unopened bottle of Cardiovex 20 mg tablets, lot CV-442, contained visible brown particles under the seal.";
  const noEvent = "The product was not administered to a patient, and no adverse event occurred.";
  const suspect = "I am reporting Cardiovex as the suspect product.";
  return { products: [{ productReference: "cardiovex", groupReference: "g1" }], proposals: [
    proposal("problem", "event", { entity: "event", field: "problemDescription" }, known("Unopened Cardiovex 20 mg tablets contained visible brown particles under the seal"), problem),
    proposal("symptoms-none", "event", { entity: "event", field: "symptoms" }, { kind: "explicitly-absent" }, noEvent),
    proposal("availability", "event", { entity: "event", field: "productAvailability" }, known("available"), "The bottle is available for evaluation."),
    proposal("product-name", "g1", product("cardiovex", "name"), known("Cardiovex 20 mg tablets"), problem),
    proposal("product-type", "g1", product("cardiovex", "productType"), known("drug-or-biologic"), problem),
    proposal("product-lot", "g1", product("cardiovex", "lotNumber"), known("CV-442"), problem),
    proposal("product-role", "g1", product("cardiovex", "role"), known("suspect"), suspect),
  ] };
}

function layer1TestsResponse(): ModelProposalOutput {
  const patient = "Patient TEST-51 is a 51-year-old woman.";
  const regimen = "She began atorvastatin 40 mg by mouth daily on 01-Aug-2026 for hyperlipidemia.";
  const event = "On 05-Sep-2026 she developed muscle pain and weakness.";
  const tests = [
    ["alt", "gt1", "ALT: 132 U/L", "7 U/L", "56 U/L", "ALT was 132 U/L (reference range 7 to 56) on 05-Sep-2026"],
    ["ast", "gt2", "AST: 118 U/L", "10 U/L", "40 U/L", "AST was 118 U/L (reference range 10 to 40) on 05-Sep-2026"],
    ["bilirubin", "gt3", "Total bilirubin: 2.1 mg/dL", "", "", "total bilirubin was 2.1 mg/dL on 05-Sep-2026"],
  ] as const;
  const proposals: ModelProposalOutput["proposals"] = [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-51"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(51), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("female"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["muscle pain", "weakness"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-09-05"), event),
    proposal("event-history", "event", { entity: "event", field: "relevantHistory" }, { kind: "explicitly-absent" }, "No other relevant medical history applies."),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("improving"), "Atorvastatin was stopped, and she was improving."),
    proposal("product-name", "g1", product("p1", "name"), known("atorvastatin"), regimen),
    proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), regimen),
    proposal("product-role", "g1", product("p1", "role"), known("suspect"), "I suspect atorvastatin"),
    proposal("product-dose", "g1", product("p1", "dose"), known("40 mg"), regimen),
    proposal("product-frequency", "g1", product("p1", "frequency"), known("daily"), regimen),
    proposal("product-route", "g1", product("p1", "route"), known("oral"), regimen),
    proposal("product-start", "g1", product("p1", "startDate"), known("2026-08-01"), regimen),
    proposal("product-indication", "g1", product("p1", "indication"), known("hyperlipidemia"), regimen),
    proposal("product-stopped", "g1", product("p1", "stopped"), known(true), "Atorvastatin was stopped, and she was improving."),
  ];
  noSeriousOutcomes.forEach((field) => proposals.push(
    proposal(`event-${field}`, "event", { entity: "event", field }, known(false), "No serious outcomes applied."),
  ));
  for (const [reference, group, result, low, high, evidence] of tests) {
    proposals.push(
      proposal(`${reference}-result`, group, test(reference, "testResult"), known(result), evidence),
      proposal(`${reference}-date`, group, test(reference, "date"), known("2026-09-05"), evidence),
    );
    if (low) proposals.push(proposal(`${reference}-low`, group, test(reference, "lowRange"), known(low), evidence));
    if (high) proposals.push(proposal(`${reference}-high`, group, test(reference, "highRange"), known(high), evidence));
  }
  return {
    products: [{ productReference: "p1", groupReference: "g1" }],
    tests: tests.map(([testReference, groupReference]) => ({ testReference, groupReference })),
    proposals,
  };
}

function layer1TestsCorrectionResponse(): ModelProposalOutput {
  return { products: [], proposals: [
    proposal("alt-correction", "u1", test("test-layer1-tests-alt", "testResult"), known("ALT: 123 U/L"), layer1TestsUpdate, "correction"),
  ] };
}

function layer1RoleResponse(): ModelProposalOutput {
  const patient = "Patient TEST-47 is a 47-year-old man.";
  const regimens = "He began warfarin 5 mg by mouth daily on 01-Aug-2026 for atrial fibrillation and acetaminophen 650 mg by mouth every six hours on 02-Aug-2026.";
  const roles = "Warfarin is suspect; acetaminophen is concomitant.";
  const event = "On 08-Aug-2026 he developed epistaxis and easy bruising.";
  const inr = "INR was 4.8 on 08-Aug-2026.";
  const result = "Warfarin was stopped and the symptoms resolved.";
  const proposals: ModelProposalOutput["proposals"] = [
    proposal("patient-id", "patient", { entity: "patient", field: "identifier" }, known("TEST-47"), patient),
    proposal("patient-age", "patient", { entity: "patient", field: "ageYears" }, known(47), patient),
    proposal("patient-sex", "patient", { entity: "patient", field: "sex" }, known("male"), patient),
    proposal("event-symptoms", "event", { entity: "event", field: "symptoms" }, known(["epistaxis", "easy bruising"]), event),
    proposal("event-onset", "event", { entity: "event", field: "onsetDate" }, known("2026-08-08"), event),
    proposal("event-history", "event", { entity: "event", field: "relevantHistory" }, { kind: "explicitly-absent" }, "No other relevant medical history applies."),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("resolved"), result),
    proposal("inr-result", "gt1", test("inr", "testResult"), known("INR: 4.8"), inr),
    proposal("inr-date", "gt1", test("inr", "date"), known("2026-08-08"), inr),
    proposal("warfarin-name", "g1", product("warfarin", "name"), known("warfarin"), regimens),
    proposal("warfarin-type", "g1", product("warfarin", "productType"), known("drug-or-biologic"), regimens),
    proposal("warfarin-role", "g1", product("warfarin", "role"), known("suspect"), roles),
    proposal("warfarin-dose", "g1", product("warfarin", "dose"), known("5 mg"), regimens),
    proposal("warfarin-frequency", "g1", product("warfarin", "frequency"), known("daily"), regimens),
    proposal("warfarin-route", "g1", product("warfarin", "route"), known("oral"), regimens),
    proposal("warfarin-start", "g1", product("warfarin", "startDate"), known("2026-08-01"), regimens),
    proposal("warfarin-indication", "g1", product("warfarin", "indication"), known("atrial fibrillation"), regimens),
    proposal("warfarin-stopped", "g1", product("warfarin", "stopped"), known(true), result),
    proposal("acetaminophen-name", "g2", product("acetaminophen", "name"), known("acetaminophen"), regimens),
    proposal("acetaminophen-type", "g2", product("acetaminophen", "productType"), known("drug-or-biologic"), regimens),
    proposal("acetaminophen-role", "g2", product("acetaminophen", "role"), known("concomitant"), roles),
    proposal("acetaminophen-dose", "g2", product("acetaminophen", "dose"), known("650 mg"), regimens),
    proposal("acetaminophen-frequency", "g2", product("acetaminophen", "frequency"), known("every six hours"), regimens),
    proposal("acetaminophen-route", "g2", product("acetaminophen", "route"), known("oral"), regimens),
    proposal("acetaminophen-start", "g2", product("acetaminophen", "startDate"), known("2026-08-02"), regimens),
  ];
  noSeriousOutcomes.forEach((field) => proposals.push(
    proposal(`event-${field}`, "event", { entity: "event", field }, known(false), "No serious outcomes applied."),
  ));
  return {
    products: [
      { productReference: "warfarin", groupReference: "g1" },
      { productReference: "acetaminophen", groupReference: "g2" },
    ],
    tests: [{ testReference: "inr", groupReference: "gt1" }],
    proposals,
  };
}

function layer1RoleCorrectionResponse(): ModelProposalOutput {
  return { products: [], proposals: [
    proposal("role-correction", "u1", product("product-layer1-role-acetaminophen", "role"), known("suspect"), layer1RoleUpdate, "correction"),
  ] };
}

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
    proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), regimen),
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
    proposal("product-type", "g1", product("p1", "productType"), known("drug-or-biologic"), event),
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
      proposal(`${ref}-type`, ref === "p1" ? "g1" : "g2", product(ref, "productType"), known("drug-or-biologic"), regimens),
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
    proposal("test-hemoglobin", "test-hemoglobin", test("hemoglobin", "testResult"), known("Hemoglobin: 7.8 g/dL"), "Her hemoglobin was 7.8 g/dL"),
    proposal("event-treatment", "event", { entity: "event", field: "treatments" }, known(["two units of packed red cells"]), result),
    proposal("event-outcome", "event", { entity: "event", field: "outcome" }, known("recovered"), result),
    proposal("event-discharge", "event", { entity: "event", field: "dischargeDate" }, known("2026-08-21"), result),
  ];
  for (const [ref, group, name, dose, frequency, regimen, dateEvidence, startDate, role] of regimens) {
    proposals.push(
      proposal(`${ref}-name`, group, product(ref, "name"), known(name), regimen),
      proposal(`${ref}-type`, group, product(ref, "productType"), known("drug-or-biologic"), regimen),
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
    tests: [{ testReference: "hemoglobin", groupReference: "test-hemoglobin" }],
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
  { identityScope: "layer2-device", turn: "opening", output: layer2DeviceResponse() },
  { identityScope: "layer2-product-quality", turn: "opening", output: layer2ProductQualityResponse() },
  { identityScope: "layer1-death", turn: "opening", output: layer1DeathResponse() },
  { identityScope: "layer1-tests", turn: "opening", output: layer1TestsResponse() },
  { identityScope: "layer1-tests-update", turn: "correction", output: layer1TestsCorrectionResponse() },
  { identityScope: "layer1-role", turn: "opening", output: layer1RoleResponse() },
  { identityScope: "layer1-role-update", turn: "correction", output: layer1RoleCorrectionResponse() },
  { identityScope: "adaptive-rich", turn: "opening", output: adaptiveRichResponse() },
  { identityScope: "adaptive-sparse", turn: "opening", output: adaptiveSparseResponse() },
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
