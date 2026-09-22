import { useState } from "react";
import { applicableMedicationFields, type MedicationAnswerField } from "../src/domain/case/medication";
import type { CaseValue } from "../src/domain/case/types";
import type { JourneyAction, JourneySnapshot } from "../src/server/journey/service";
import styles from "./page.module.css";

const labels: Record<MedicationAnswerField, string> = {
  stopped: "Was this medication stopped?",
  doseReduced: "Was its dose reduced?",
  stopDate: "When was it stopped?",
  improvedAfterChange: "Did the event improve after stopping or reducing it?",
  restarted: "Was this medication restarted?",
  recurred: "Did the event return after restarting it?",
};
type Answers = Extract<JourneyAction, { action: "answer-medication-history" }>["answers"];

export function MedicationTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const question = snapshot.clarification;
  if (question?.kind !== "medication-history") return null;
  const product = snapshot.understanding.products.find(({ id }) => id === question.productId)!;
  const boolean = (field: "stopped" | "doseReduced" | "restarted"): boolean | undefined => {
    const value: CaseValue<unknown> | undefined = answers[field] ?? product.facts[field].resolved;
    return value?.kind === "known" && typeof value.value === "boolean" ? value.value : undefined;
  };
  const fields = applicableMedicationFields(boolean("stopped"), boolean("doseReduced"), boolean("restarted"))
    .filter((field) => product.facts[field].state === "empty");
  const submit = (disposition?: "unknown" | "declined") => {
    const selected = Object.fromEntries(fields.map((field) => {
      const value = answers[field];
      const answered = value && !(field === "stopDate" && value.kind === "known" && !value.value);
      return [field, answered ? value : disposition ? { kind: disposition } : undefined];
    })) as Answers;
    void act({ action: "answer-medication-history", productId: product.id, answers: selected });
  };
  return <>
    <h1 id="task-title">{question.question}</h1>
    <p>Use these short answers, or describe what happened in Clinical update below. Unknown or declined details can remain blank on the form.</p>
    {fields.map((field) => {
      const value = answers[field];
      const choice = value?.kind === "known" ? field === "stopDate" ? "known" : String(value.value) : value?.kind ?? "";
      return <fieldset className={styles.answerGroup} key={field} disabled={busy}>
        <legend>{labels[field]}</legend>
        <select aria-label={labels[field]} value={choice} onChange={(event) => {
          const selected = event.target.value;
          const next = selected === "" ? undefined : selected === "unknown" || selected === "declined"
            ? { kind: selected } : { kind: "known", value: field === "stopDate" ? "" : selected === "true" };
          const updated = { ...answers, [field]: next } as Answers;
          // A changed prerequisite invalidates its unsaved dependent answers too.
          // Toggling back must require a fresh observation, just like accepted corrections.
          const dependents = field === "stopped" ? ["stopDate", "improvedAfterChange", "restarted", "recurred"]
            : field === "doseReduced" ? ["improvedAfterChange"] : field === "restarted" ? ["recurred"] : [];
          for (const dependent of dependents) delete updated[dependent as keyof Answers];
          setAnswers(updated);
        }}>
          <option value="">Select an answer</option>
          {field === "stopDate" ? <option value="known">Known date</option> : <><option value="true">Yes</option><option value="false">No</option></>}
          <option value="unknown">Unknown</option>
          <option value="declined">Prefer not to answer</option>
        </select>
        {field === "stopDate" && value?.kind === "known" && <label>Stop date<input type="date" value={String(value.value)} onChange={(event) => setAnswers({ ...answers, stopDate: { kind: "known", value: event.target.value } })} /></label>}
      </fieldset>;
    })}
    <button disabled={busy || fields.some((field) => !answers[field] || (field === "stopDate" && answers.stopDate?.kind === "known" && !answers.stopDate.value))} onClick={() => submit()}>Add medication answers</button>
    <button disabled={busy} onClick={() => submit("unknown")}>These remaining details are unknown</button>
    <button disabled={busy} onClick={() => submit("declined")}>Prefer not to answer these details</button>
  </>;
}
