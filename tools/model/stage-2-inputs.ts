export const STAGE_2_CALL_SLOTS = [
  "rich-opening",
  "repeated-opening",
  "repeated-update",
] as const;

export type Stage2CallSlot = typeof STAGE_2_CALL_SLOTS[number];

export interface Stage2CallInput {
  slot: Stage2CallSlot;
  turn: "opening" | "correction";
  text: string;
}

const richOpening = `Patient TEST-68 is a 68-year-old man. He began cephalexin 500 mg by mouth twice daily on 01-Aug-2026 for cellulitis. On 04-Aug-2026 he developed diffuse hives and facial swelling and was hospitalized. Cephalexin was stopped, he was treated with epinephrine and diphenhydramine, and he recovered and was discharged on 05-Aug-2026. I suspect cephalexin.`;

const repeatedOpening = `Patient TEST-44 is a 44-year-old man. He began acetaminophen (Tylenol) 1,000 mg by mouth twice daily on 01-Jul-2026 for back pain and ibuprofen 400 mg by mouth twice daily on 03-Jul-2026 for back pain. On 05-Jul-2026 he developed nausea and right upper abdominal pain and was hospitalized. Tylenol and ibuprofen were stopped, he received intravenous fluids, and he recovered and was discharged on 07-Jul-2026. I suspect acetaminophen and ibuprofen.`;

const repeatedUpdate = `Correction: the ibuprofen dose was 200 mg twice daily, not 400 mg twice daily. My medication list says acetaminophen began 02-Jul-2026 rather than 01-Jul-2026. I cannot resolve which date is correct.`;

const inputs: Record<Stage2CallSlot, Stage2CallInput> = {
  "rich-opening": { slot: "rich-opening", turn: "opening", text: richOpening },
  "repeated-opening": { slot: "repeated-opening", turn: "opening", text: repeatedOpening },
  "repeated-update": { slot: "repeated-update", turn: "correction", text: repeatedUpdate },
};

export function stage2Input(slot: Stage2CallSlot): Stage2CallInput {
  return inputs[slot];
}
