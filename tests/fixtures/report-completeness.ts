// Independently specified synthetic evaluation cases; never imported by runtime code.
export const reportCompletenessCases = [
  {
    id: "dose-only",
    text: "Fictional patient Q1 is a 45-year-old woman. She took amoxicillin 500 mg by mouth twice daily for sinusitis starting September 1, 2026. A rash began September 3, 2026. Amoxicillin was stopped and she recovered. I suspect amoxicillin. The product strength is not known.",
    expected: { name: "amoxicillin", dose: "500 mg", strength: null, startDate: "2026-09-01", onsetDate: "2026-09-03" },
  },
  {
    id: "distinct-strength-dose",
    text: "Fictional patient Q2 is a 52-year-old man. His naproxen tablets are 250 mg each. He took two tablets, a total dose of 500 mg, by mouth twice daily for back pain. He started on September 2, 2026 and developed abdominal pain on September 4, 2026. Naproxen is the suspected product.",
    expected: { name: "naproxen", dose: "500 mg", strength: "250 mg", startDate: "2026-09-02", onsetDate: "2026-09-04" },
  },
  {
    id: "liquid-concentration",
    text: "Fictional patient Q3 is a 36-year-old woman. The amoxicillin liquid label states 250 mg/5 mL. She took 10 mL by mouth twice daily for sinusitis starting September 1, 2026. She developed a rash on September 3, 2026. I suspect amoxicillin. No tablet strength or calculated dose in milligrams was provided.",
    expected: { name: "amoxicillin", dose: "10 mL", strength: "250 mg/5 mL", startDate: "2026-09-01", onsetDate: "2026-09-03" },
  },
] as const;
