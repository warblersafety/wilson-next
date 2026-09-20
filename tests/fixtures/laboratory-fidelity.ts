// Synthetic source inputs and independently specified observations for issue #91.
// Runtime code must not import this file.
export const laboratoryCases = [
  {
    id: "tryptase", text: "Patient LAB-1 is a 45-year-old woman. She took amoxicillin for sinusitis and developed wheezing on 03-Sep-2026. I suspect amoxicillin. Serum tryptase was 18 ng/mL (reference range 0 to 11.4) on 03-Sep-2026.",
    observations: [{ testName: "Serum tryptase", testResult: "18 ng/mL", lowRange: "0", highRange: "11.4", date: "2026-09-03" }],
    correction: "Correction: the serum tryptase result was 17 ng/mL, not 18 ng/mL. Its date and reference range are unchanged.",
  },
  {
    id: "demo24", text: "Patient DEMO-24 is a 54-year-old woman. She took ibuprofen for back pain and developed melena on 11-Sep-2026. I suspect ibuprofen. Her hemoglobin was 9.1 g/dL (reference range 12 to 16) on 11-Sep-2026, and a stool test was positive for occult blood on 11-Sep-2026.",
    observations: [{ testName: "hemoglobin", testResult: "9.1 g/dL", lowRange: "12", highRange: "16", date: "2026-09-11" }, { testName: "stool test", testResult: "positive for occult blood", date: "2026-09-11" }],
  },
  {
    id: "contrasting", text: "Patient LAB-3 is a 63-year-old man. He took nitrofurantoin for a urinary infection and developed fever on 12-Sep-2026. I suspect nitrofurantoin. Urine culture showed no growth; its collection date is unknown. Platelet count was 82; I do not know the units or test date. A skin biopsy was performed, but its result is unknown.",
    observations: [{ testName: "Urine culture", testResult: "no growth", date: null }, { testName: "Platelet count", testResult: "82", date: null }, { testName: "skin biopsy", testResult: null }],
  },
  {
    id: "garbled-partial", text: "Patient LAB-4 is a 39-year-old woman. She took cefalexin for cellulitis and developed a rash on 15-Sep-2026. I suspect cefalexin. The dictated test name is exactly 'serum trip tase'; the result was 6.2, with no unit or test date available. Separately, an unidentified test was negative; I do not know its name or date. Do not guess or repair either test name.",
    observations: [{ testName: "serum trip tase", testResult: "6.2" }, { testName: null, testResult: "negative", date: null }],
  },
] as const;

export const laboratoryRepairOpening = "Patient LAB-REPAIR is a 54-year-old woman. She took ibuprofen for back pain and developed melena on 11-Sep-2026. I suspect ibuprofen. Her hemoglobin was 9.1 g/dL (reference range 12 to 16) on 11-Sep-2026, and a stool test was positive for occult blood on 11-Sep-2026.";
