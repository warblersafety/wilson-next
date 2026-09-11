"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CaseValue, ReportType } from "../src/domain/case/types";
import type { FactView, ReviewAttentionItem } from "../src/domain/case/views";
import type { BrowserJourneyState, JourneyResponse } from "../src/server/case/browser-state";
import type { JourneyAction, JourneySnapshot } from "../src/server/journey/service";
import {
  clearJourneySession,
  JourneyRequestError,
  readStoredJourneyState,
  requestJourneyJson,
  requestJourneyPdf,
  storeJourneyState,
} from "./browser-diagnostics";
import styles from "./page.module.css";

const stageLabels: Record<JourneySnapshot["stage"], string> = {
  describe: "Describe",
  understanding: "Check understanding",
  clarify: "Clarify",
  "review-update": "Review update",
  output: "Inspect output",
};

export default function Journey() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [browserState, setBrowserState] = useState<BrowserJourneyState>();
  const [opening, setOpening] = useState("");
  const [update, setUpdate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [boundaryNotice, setBoundaryNotice] = useState<string>();

  useEffect(() => { void loadJourney(); }, []);

  function acceptResponse(response: JourneyResponse) {
    storeJourneyState(response.state);
    setBrowserState(response.state);
    setSnapshot(response.snapshot);
  }

  async function freshJourney(notice?: string) {
    const response = await requestJourneyJson<JourneyResponse>({}, "The temporary case could not be loaded");
    acceptResponse(response);
    if (notice) setBoundaryNotice(notice);
  }

  async function loadJourney() {
    try {
      const stored = readStoredJourneyState();
      if (stored === undefined) return await freshJourney();
      try {
        const response = await requestJourneyJson<JourneyResponse>({
          method: "POST",
          body: { operation: "resume", state: stored },
        }, "The saved synthetic preview could not be resumed");
        acceptResponse(response);
        setBoundaryNotice("Restored this tab’s disposable synthetic preview state.");
      } catch (caught) {
        if (caught instanceof JourneyRequestError
          && ["incompatible-browser-state", "malformed-browser-state", "stale-browser-state"].includes(caught.code ?? "")) {
          clearJourneySession();
          await freshJourney("The saved preview state was invalid or incompatible, so Wilson started over safely.");
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setError(displayError(caught, "The temporary case could not be loaded"));
    }
  }

  async function act(action: JourneyAction) {
    if (!snapshot || !browserState) return;
    setBusy(true);
    setError(undefined);
    setBoundaryNotice(undefined);
    try {
      const response = await requestJourneyJson<JourneyResponse>({
        method: "POST",
        body: { operation: "act", state: browserState, expectedRevision: snapshot.revision, action },
      }, "Wilson could not update the case");
      acceptResponse(response);
      if (action.action === "submit-update") setUpdate("");
    } catch (caught) {
      setError(displayError(caught, "Wilson could not update the case"));
    } finally {
      setBusy(false);
    }
  }

  async function resetJourney() {
    if (snapshot && snapshot.revision > 0
      && !window.confirm("Start a new synthetic case? The current tab’s case will be lost.")) return;
    setBusy(true);
    setError(undefined);
    setBoundaryNotice(undefined);
    clearJourneySession();
    setSnapshot(undefined);
    setBrowserState(undefined);
    setOpening("");
    setUpdate("");
    try {
      await freshJourney("Started a blank disposable synthetic case.");
    } catch (caught) {
      setError(displayError(caught, "The synthetic case could not be started"));
    } finally {
      setBusy(false);
    }
  }

  async function openPdf(mode: "preview" | "download") {
    if (!browserState) return;
    const previewWindow = mode === "preview" ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    setError(undefined);
    try {
      const { blob, filename } = await requestJourneyPdf(browserState, mode);
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        if (!previewWindow) throw new Error("The browser blocked the PDF preview window");
        previewWindow.document.title = "Wilson Form FDA 3500 preview";
        previewWindow.document.body.style.margin = "0";
        const embed = previewWindow.document.createElement("embed");
        embed.src = url;
        embed.type = "application/pdf";
        embed.style.width = "100vw";
        embed.style.height = "100vh";
        previewWindow.document.body.replaceChildren(embed);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (caught) {
      previewWindow?.close();
      setError(displayError(caught, "The official PDF could not be generated"));
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) return <main className={styles.loading}><p>{error ?? "Preparing a blank synthetic case…"}</p></main>;

  return (
    <main className={styles.appShell}>
      <header className={styles.header}>
        <div><span className={styles.wordmark}>Wilson</span><span className={styles.experiment}>Synthetic experiment</span></div>
        <div className={styles.headerActions}>
          <span className={styles.status}>{stageLabels[snapshot.stage]}</span>
          <button disabled={busy} onClick={() => void resetJourney()}>New case</button>
        </div>
      </header>
      <aside className={styles.boundary} aria-label="Experiment boundary">
        <strong>Fictional information only.</strong> This disposable operator preview supports bounded adult medication, single-device adverse-event and product-problem, and non-device product-quality facts. Do not use it for a real report or as a production system. Closing this tab or starting a new case clears its saved case.
      </aside>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {boundaryNotice && <div className={styles.notice} role="status">{boundaryNotice}</div>}
      {snapshot.unrepresented.length > 0 && <UnrepresentedNotice items={snapshot.unrepresented} />}
      {busy && <div className={styles.progress} role="status">Updating the reviewed case…</div>}
      {snapshot.stage === "output" ? (
        <OutputComposition snapshot={snapshot} update={update} setUpdate={setUpdate} busy={busy} act={act} openPdf={openPdf} />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.activeTask} aria-labelledby="task-title">
            {snapshot.stage === "describe" && <Describe opening={opening} setOpening={setOpening} busy={busy} act={act} />}
            {snapshot.stage === "understanding" && <UnderstandingTask snapshot={snapshot} busy={busy} act={act} />}
            {snapshot.stage === "clarify" && <CompletionTask key={snapshot.clarification?.key} snapshot={snapshot} busy={busy} act={act} />}
            {snapshot.stage === "review-update" && <UpdateReview snapshot={snapshot} busy={busy} act={act} />}
          </section>
          <section className={styles.casePanel} aria-labelledby="case-title">
            <div className={styles.panelHeading}>
              <div><p className={styles.eyebrow}>{snapshot.stage === "understanding" ? "Proposed case" : "Reviewed case"}</p><h2 id="case-title">Case so far</h2></div>
              <span>{snapshot.review.attention.length > 0 ? `${snapshot.review.attention.length} items need review` : "Reviewed"}</span>
            </div>
            <CaseCards snapshot={snapshot} busy={busy} act={act} />
          </section>
        </div>
      )}
    </main>
  );
}

function Describe({ opening, setOpening, busy, act }: {
  opening: string; setOpening: (value: string) => void; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const [adverseEvent, setAdverseEvent] = useState(true);
  const [productProblem, setProductProblem] = useState(false);
  const reportType: ReportType | undefined = adverseEvent && productProblem ? "adverse-event-and-product-problem"
    : adverseEvent ? "adverse-event" : productProblem ? "product-problem" : undefined;
  return <>
    <p className={styles.eyebrow}>Describe</p>
    <h1 id="task-title">Describe what happened</h1>
    <p>Paste or type a fictional clinical account. Wilson will propose case knowledge for review; it will not accept those proposals as truth.</p>
    <label htmlFor="opening-account">Clinical account</label>
    <textarea id="opening-account" rows={13} value={opening} onChange={(event) => setOpening(event.target.value)} />
    <fieldset className={styles.reportType}><legend>Report type</legend>
      <label><input type="checkbox" checked={adverseEvent} onChange={(event) => setAdverseEvent(event.target.checked)} /> Adverse event</label>
      <label><input type="checkbox" checked={productProblem} onChange={(event) => setProductProblem(event.target.checked)} /> Product problem</label>
    </fieldset>
    <p className={styles.hint}>You can also use device-native dictation. Wilson does not record audio.</p>
    <button disabled={busy || !opening.trim() || !reportType} onClick={() => reportType && void act({ action: "submit-opening", text: opening, reportType })}>
      {busy ? "Extracting case details…" : "Review Wilson’s understanding"}
    </button>
  </>;
}

function UnderstandingTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  return <>
    <p className={styles.eyebrow}>Check understanding</p>
    <h1 id="task-title">Check Wilson’s understanding</h1>
    <p>Review the proposed groups and their source evidence. Change a supported value or remove a product before accepting the remaining proposals.</p>
    <button disabled={busy} onClick={() => void act({ action: "accept-understanding" })}>Accept the remaining understanding</button>
  </>;
}

function UnrepresentedNotice({ items }: { items: JourneySnapshot["unrepresented"] }) {
  return <section className={styles.quarantine} role="status" aria-labelledby="unrepresented-title">
    <h2 id="unrepresented-title">Some details were left out</h2>
    <p>Wilson could not safely represent these suggestions, so they were not added to the case or Form FDA 3500. Review the cited text and add a correction later if the detail matters.</p>
    <ul>{items.map((item, index) => <li key={`${item.entity}-${item.field}-${item.evidenceQuote}-${index}`}>
      <strong>{unrepresentedTargetLabel(item.entity, item.field)}</strong>
      <span>{unrepresentedReason(item.reason)}</span>
      <blockquote>Text Wilson cited: “{item.evidenceQuote}”</blockquote>
    </li>)}</ul>
  </section>;
}

type IndicationChoice = "known" | "unknown" | "declined";

function CompletionTask(props: { snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void> }) {
  const question = props.snapshot.clarification;
  if (!question) return null;
  return <>
    <p className={styles.eyebrow}>Clarify · {question.reason}</p>
    {question.kind === "indications" && <IndicationTask {...props} />}
    {question.kind === "serious-outcomes" && <SeriousOutcomesTask {...props} />}
    {question.kind === "death-date" && <DeathDateTask {...props} />}
    {question.kind === "clinical-context" && <ClinicalContextTask {...props} />}
    {question.kind === "device-details" && <DeviceDetailsTask {...props} />}
    {question.kind === "reporter" && <ReporterTask {...props} />}
  </>;
}

function IndicationTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const productIds = snapshot.clarification?.kind === "indications" ? snapshot.clarification.productIds : [];
  const [choices, setChoices] = useState<Record<string, IndicationChoice>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const products = productIds.map((id) => snapshot.understanding.products.find((product) => product.id === id)).filter(Boolean);
  const complete = products.every((product) => {
    const choice = choices[product!.id];
    return choice === "unknown" || choice === "declined" || (choice === "known" && Boolean(texts[product!.id]?.trim()));
  });
  return <>
    <h1 id="task-title">{snapshot.clarification?.question}</h1>
    <p>Answer each labelled product separately, or record that the information is unknown or declined.</p>
    {products.map((product) => {
      const name = formatFact(activeValue(product!.facts.name));
      return <fieldset className={styles.answerGroup} key={product!.id}>
        <legend>{name}</legend>
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "known"} onChange={() => setChoices({ ...choices, [product!.id]: "known" })} /> Known</label>
        <input aria-label={`${name} indication`} value={texts[product!.id] ?? ""} onChange={(event) => { setChoices({ ...choices, [product!.id]: "known" }); setTexts({ ...texts, [product!.id]: event.target.value }); }} />
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "unknown"} onChange={() => setChoices({ ...choices, [product!.id]: "unknown" })} /> Unknown</label>
        <label><input type="radio" name={`choice-${product!.id}`} checked={choices[product!.id] === "declined"} onChange={() => setChoices({ ...choices, [product!.id]: "declined" })} /> Prefer not to answer</label>
      </fieldset>;
    })}
    <button disabled={busy || !complete} onClick={() => void act({
      action: "answer-indications",
      answers: products.map((product) => ({
        productId: product!.id,
        value: choices[product!.id] === "known"
          ? { kind: "known", value: texts[product!.id].trim() }
          : { kind: choices[product!.id] as "unknown" | "declined" },
      })),
    })}>Add these answers</button>
  </>;
}

const seriousOutcomeLabels = {
  death: "Death",
  lifeThreatening: "Life-threatening",
  hospitalized: "Hospitalization (initial or prolonged)",
  disability: "Disability or permanent damage",
  requiredIntervention: "Required intervention to prevent permanent impairment or damage",
  congenitalAnomaly: "Congenital anomaly or birth defect",
  otherSerious: "Other serious or important medical event",
} as const;
type SeriousOutcomeKey = keyof typeof seriousOutcomeLabels;

function SeriousOutcomesTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const question = snapshot.clarification;
  const missing = question?.kind === "serious-outcomes" ? new Set(question.targetIds.map((target) => target.split(":")[2])) : new Set<string>();
  const [selected, setSelected] = useState<SeriousOutcomeKey[]>([]);
  const existing = Object.fromEntries(Object.keys(seriousOutcomeLabels).map((field) => {
    const value = activeValue(snapshot.understanding.event[field]);
    return [field, value?.kind === "known" && value.value === true];
  }));
  return <>
    <h1 id="task-title">{question?.question}</h1>
    <p>Select every additional outcome that applies. Leaving an available outcome unchecked records that it did not apply. Accepted outcomes are shown and will not be asked again.</p>
    <fieldset className={styles.answerGroup}>
      <legend>Serious outcomes</legend>
      {(Object.entries(seriousOutcomeLabels) as Array<[SeriousOutcomeKey, string]>).map(([field, label]) => <label key={field}>
        <input type="checkbox" checked={Boolean(existing[field]) || selected.includes(field)} disabled={Boolean(existing[field]) || !missing.has(field)} onChange={(event) => setSelected(event.target.checked ? [...selected, field] : selected.filter((item) => item !== field))} /> {label}{existing[field] ? " — already recorded" : ""}
      </label>)}
    </fieldset>
    <div className={styles.decisionActions}>
      <button disabled={busy} onClick={() => void act({ action: "answer-serious-outcomes", selected, disposition: "known" })}>Confirm outcomes</button>
      <button disabled={busy} onClick={() => void act({ action: "answer-serious-outcomes", selected: [], disposition: "unknown" })}>I don’t know</button>
      <button disabled={busy} onClick={() => void act({ action: "answer-serious-outcomes", selected: [], disposition: "declined" })}>Prefer not to answer</button>
    </div>
  </>;
}

function DeathDateTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  return <>
    <h1 id="task-title">{snapshot.clarification?.question}</h1>
    <p>This detail is asked only because death is recorded as an outcome.</p>
    <label htmlFor="death-date">Date of death</label>
    <input id="death-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    <div className={styles.decisionActions}>
      <button disabled={busy || !date} onClick={() => void act({ action: "answer-death-date", value: { kind: "known", value: date } })}>Add date</button>
      <button disabled={busy} onClick={() => void act({ action: "answer-death-date", value: { kind: "unknown" } })}>Unknown</button>
      <button disabled={busy} onClick={() => void act({ action: "answer-death-date", value: { kind: "declined" } })}>Prefer not to answer</button>
    </div>
  </>;
}

type ContextChoice = "known" | "explicitly-absent" | "unknown" | "declined";
type ClinicalHistoryValue = Extract<JourneyAction, { action: "answer-clinical-context" }>["history"];

function ClinicalContextTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const question = snapshot.clarification?.kind === "clinical-context" ? snapshot.clarification : undefined;
  const [testChoice, setTestChoice] = useState<ContextChoice>();
  const [historyChoice, setHistoryChoice] = useState<ContextChoice>();
  const [testResult, setTestResult] = useState("");
  const [lowRange, setLowRange] = useState("");
  const [highRange, setHighRange] = useState("");
  const [testDate, setTestDate] = useState("");
  const [history, setHistory] = useState("");
  const testComplete = !question?.askTests || (testChoice && (testChoice !== "known" || Boolean(testResult.trim())));
  const historyComplete = !question?.askHistory || (historyChoice && (historyChoice !== "known" || Boolean(history.trim())));
  const contextValue = (choice: ContextChoice | undefined, text: string): ClinicalHistoryValue => choice === "known"
    ? { kind: "known", value: text.trim() }
    : choice ? { kind: choice } : undefined;
  return <>
    <h1 id="task-title">{question?.question}</h1>
    <p>Add only context that is relevant to understanding this event. Unknown, none, and refusal are retained and will not trigger the same question again.</p>
    {question?.askTests && <fieldset className={styles.answerGroup}>
      <legend>Relevant tests or laboratory results</legend>
      <label><input type="radio" name="test-choice" checked={testChoice === "known"} onChange={() => setTestChoice("known")} /> Add one relevant result</label>
      {testChoice === "known" && <>
        <label>Test and result <input aria-label="Test and result" value={testResult} onChange={(event) => setTestResult(event.target.value)} /></label>
        <label>Low range (optional) <input aria-label="Low range" value={lowRange} onChange={(event) => setLowRange(event.target.value)} /></label>
        <label>High range (optional) <input aria-label="High range" value={highRange} onChange={(event) => setHighRange(event.target.value)} /></label>
        <label>Date (optional) <input aria-label="Test date" type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} /></label>
      </>}
      <label><input type="radio" name="test-choice" checked={testChoice === "explicitly-absent"} onChange={() => setTestChoice("explicitly-absent")} /> No relevant tests to add</label>
      <label><input type="radio" name="test-choice" checked={testChoice === "unknown"} onChange={() => setTestChoice("unknown")} /> Unknown</label>
      <label><input type="radio" name="test-choice" checked={testChoice === "declined"} onChange={() => setTestChoice("declined")} /> Prefer not to answer</label>
    </fieldset>}
    {question?.askHistory && <fieldset className={styles.answerGroup}>
      <legend>Other relevant medical history</legend>
      <label><input type="radio" name="history-choice" checked={historyChoice === "known"} onChange={() => setHistoryChoice("known")} /> Add relevant history</label>
      {historyChoice === "known" && <textarea aria-label="Relevant medical history" rows={4} value={history} onChange={(event) => setHistory(event.target.value)} />}
      <label><input type="radio" name="history-choice" checked={historyChoice === "explicitly-absent"} onChange={() => setHistoryChoice("explicitly-absent")} /> No relevant history to add</label>
      <label><input type="radio" name="history-choice" checked={historyChoice === "unknown"} onChange={() => setHistoryChoice("unknown")} /> Unknown</label>
      <label><input type="radio" name="history-choice" checked={historyChoice === "declined"} onChange={() => setHistoryChoice("declined")} /> Prefer not to answer</label>
    </fieldset>}
    <button disabled={busy || !testComplete || !historyComplete} onClick={() => void act({
      action: "answer-clinical-context",
      test: question?.askTests ? testChoice === "known" ? { kind: "known", testResult: testResult.trim(), lowRange: lowRange.trim() || undefined, highRange: highRange.trim() || undefined, date: testDate || undefined } : { kind: testChoice as Exclude<ContextChoice, "known"> } : undefined,
      history: question?.askHistory ? contextValue(historyChoice, history) : undefined,
    })}>Add this context</button>
  </>;
}

type DeviceDetailChoice = "known" | "unknown" | "inapplicable" | "declined";
type DeviceDetailValue = Extract<JourneyAction, { action: "answer-device-details" }>["implantDate"];

function DeviceDetailsTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const question = snapshot.clarification?.kind === "device-details" ? snapshot.clarification : undefined;
  const [implantChoice, setImplantChoice] = useState<DeviceDetailChoice>();
  const [explantChoice, setExplantChoice] = useState<DeviceDetailChoice>();
  const [reprocessorChoice, setReprocessorChoice] = useState<Exclude<DeviceDetailChoice, "inapplicable">>();
  const [implantDate, setImplantDate] = useState("");
  const [explantDate, setExplantDate] = useState("");
  const [reprocessor, setReprocessor] = useState("");
  const completeChoice = (asked: boolean | undefined, choice: DeviceDetailChoice | undefined, value: string) => !asked
    || Boolean(choice && (choice !== "known" || value.trim()));
  const complete = completeChoice(question?.askImplantDate, implantChoice, implantDate)
    && completeChoice(question?.askExplantDate, explantChoice, explantDate)
    && completeChoice(question?.askReprocessor, reprocessorChoice, reprocessor);
  const value = (choice: DeviceDetailChoice | undefined, text: string): DeviceDetailValue => choice === "known"
    ? { kind: "known", value: text.trim() }
    : choice ? { kind: choice } : undefined;
  const choices = (name: string, choice: DeviceDetailChoice | undefined, setChoice: (choice: DeviceDetailChoice) => void, allowInapplicable: boolean) => <>
    <label><input type="radio" name={name} checked={choice === "known"} onChange={() => setChoice("known")} /> Known</label>
    <label><input type="radio" name={name} checked={choice === "unknown"} onChange={() => setChoice("unknown")} /> Unknown</label>
    {allowInapplicable && <label><input type="radio" name={name} checked={choice === "inapplicable"} onChange={() => setChoice("inapplicable")} /> Not applicable</label>}
    <label><input type="radio" name={name} checked={choice === "declined"} onChange={() => setChoice("declined")} /> Prefer not to answer</label>
  </>;
  return <>
    <h1 id="task-title">{question?.question}</h1>
    <p>These details are asked only because the reviewed device facts make them applicable. Unknown, not applicable, and refusal close the detail without a repeat.</p>
    {question?.askImplantDate && <fieldset className={styles.answerGroup}>
      <legend>Implant date</legend>
      {choices("implant-date-choice", implantChoice, setImplantChoice, false)}
      {implantChoice === "known" && <input aria-label="Device implant date" type="date" value={implantDate} onChange={(event) => setImplantDate(event.target.value)} />}
    </fieldset>}
    {question?.askExplantDate && <fieldset className={styles.answerGroup}>
      <legend>Explant date</legend>
      {choices("explant-date-choice", explantChoice, setExplantChoice, true)}
      {explantChoice === "known" && <input aria-label="Device explant date" type="date" value={explantDate} onChange={(event) => setExplantDate(event.target.value)} />}
    </fieldset>}
    {question?.askReprocessor && <fieldset className={styles.answerGroup}>
      <legend>Reprocessor</legend>
      {choices("reprocessor-choice", reprocessorChoice, (choice) => setReprocessorChoice(choice as Exclude<DeviceDetailChoice, "inapplicable">), false)}
      {reprocessorChoice === "known" && <input aria-label="Device reprocessor" value={reprocessor} onChange={(event) => setReprocessor(event.target.value)} />}
    </fieldset>}
    <button disabled={busy || !complete} onClick={() => void act({
      action: "answer-device-details",
      implantDate: question?.askImplantDate ? value(implantChoice, implantDate) : undefined,
      explantDate: question?.askExplantDate ? value(explantChoice, explantDate) : undefined,
      reprocessor: question?.askReprocessor ? value(reprocessorChoice, reprocessor) : undefined,
    })}>Add device details</button>
  </>;
}

function ReporterTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const [values, setValues] = useState({ firstName: "", lastName: "", address: "", city: "", state: "", postalCode: "", country: "UNITED STATES", phone: "", email: "", occupation: "Physician" });
  const [healthProfessional, setHealthProfessional] = useState(true);
  const [reportedTo, setReportedTo] = useState<Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer">>([]);
  const [doNotDiscloseIdentity, setDoNotDiscloseIdentity] = useState(false);
  const set = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const complete = values.firstName.trim() && values.lastName.trim() && values.occupation && (values.phone.trim() || values.email.trim());
  return <>
    <h1 id="task-title">{snapshot.clarification?.question}</h1>
    <p>Enter this directly. Wilson never infers reporter identity from the clinical narrative. A phone number or email is enough for this bounded path; address fields are optional.</p>
    <fieldset className={styles.answerGroup}>
      <legend>Reporter</legend>
      <label>First name <input aria-label="Reporter first name" value={values.firstName} onChange={(event) => set("firstName", event.target.value)} /></label>
      <label>Last name <input aria-label="Reporter last name" value={values.lastName} onChange={(event) => set("lastName", event.target.value)} /></label>
      <label>Phone <input aria-label="Reporter phone" value={values.phone} onChange={(event) => set("phone", event.target.value)} /></label>
      <label>Email <input aria-label="Reporter email" type="email" value={values.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label>Address (optional) <input aria-label="Reporter address" value={values.address} onChange={(event) => set("address", event.target.value)} /></label>
      <label>City (optional) <input aria-label="Reporter city" value={values.city} onChange={(event) => set("city", event.target.value)} /></label>
      <label>State (optional) <input aria-label="Reporter state" value={values.state} onChange={(event) => set("state", event.target.value)} /></label>
      <label>ZIP/postal code (optional) <input aria-label="Reporter postal code" value={values.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></label>
      <label>Country <select aria-label="Reporter country" value={values.country} onChange={(event) => set("country", event.target.value)}><option>UNITED STATES</option><option>CANADA</option></select></label>
      <label>Occupation <select aria-label="Reporter occupation" value={values.occupation} onChange={(event) => set("occupation", event.target.value)}>{["Physician", "Nurse", "Nurse Practitioner", "Pharmacist", "Physician Assistant", "Other Health Professional", "Non-Health Professional"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={healthProfessional} onChange={(event) => setHealthProfessional(event.target.checked)} /> Health professional</label>
    </fieldset>
    <fieldset className={styles.answerGroup}><legend>Also reported to</legend>
      {[["manufacturer", "Manufacturer or compounder"], ["user-facility", "User facility"], ["distributor-importer", "Distributor or importer"], ["packer", "Packer"]] .map(([value, label]) => <label key={value}><input type="checkbox" checked={reportedTo.includes(value as typeof reportedTo[number])} onChange={(event) => setReportedTo(event.target.checked ? [...reportedTo, value as typeof reportedTo[number]] : reportedTo.filter((item) => item !== value))} /> {label}</label>)}
      <label><input type="checkbox" checked={doNotDiscloseIdentity} onChange={(event) => setDoNotDiscloseIdentity(event.target.checked)} /> Do not disclose my identity to the manufacturer</label>
    </fieldset>
    <div className={styles.decisionActions}>
      <button disabled={busy || !complete} onClick={() => void act({ action: "answer-reporter", reporter: {
        kind: "provided", firstName: values.firstName.trim(), lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined, email: values.email.trim() || undefined,
        address: values.address.trim() || undefined, city: values.city.trim() || undefined,
        state: values.state.trim() || undefined, postalCode: values.postalCode.trim() || undefined,
        country: values.country, occupation: values.occupation, healthProfessional, reportedTo, doNotDiscloseIdentity,
      } })}>Add reporter details</button>
      <button disabled={busy} onClick={() => void act({ action: "answer-reporter", reporter: { kind: "declined" } })}>Prefer not to provide reporter details</button>
    </div>
  </>;
}

function UpdateReview({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const groups = groupAttention(snapshot.review.attention.filter(({ kind }) => kind !== "conflict"));
  return <>
    <p className={styles.eyebrow}>Review update</p>
    <h1 id="task-title">Review the proposed update</h1>
    <p>Accepted knowledge stays active until you accept a correction. An accepted incompatible alternative remains visibly unresolved and is omitted from the form.</p>
    {groups.map(({ groupId, items }) => <article className={styles.attentionCard} key={groupId}>
      <span className={styles.attentionLabel}>{items.some(({ kind }) => kind === "correction") ? "Proposed correction" : "Proposed information"}</span>
      {items.map((item) => <div key={item.target}>
        <h2>{targetLabel(snapshot, item.target)}</h2>
        <p><strong>{formatFact(item.values[0]?.value)}</strong></p>
        <Evidence excerpt={item.values[0]?.evidence} expanded />
      </div>)}
      <div className={styles.decisionActions}>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "accept" })}>Accept this update</button>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "reject" })}>Reject this update</button>
      </div>
    </article>)}
  </>;
}

function OutputComposition({ snapshot, update, setUpdate, busy, act, openPdf }: {
  snapshot: JourneySnapshot;
  update: string;
  setUpdate: (value: string) => void;
  busy: boolean;
  act: (action: JourneyAction) => Promise<void>;
  openPdf: (mode: "preview" | "download") => Promise<void>;
}) {
  const { A, B, C, D, E, F, G } = snapshot.projection.sections;
  const conflicts = snapshot.review.attention.filter(({ kind }) => kind === "conflict");
  return <div className={styles.outputWorkspace}>
    <section className={styles.outputSummary} aria-labelledby="output-title">
      <p className={styles.eyebrow}>Reviewed case and supported output</p>
      <h1 id="output-title">{snapshot.downloadReady ? "The supported form is ready" : "The form needs more reviewed information"}</h1>
      <Summary title="Included" tone="included">
        <li>Patient {A.patientIdentifier ?? "identifier not provided"}{A.ageYears === undefined ? "" : `, age ${A.ageYears}`}{A.sex ? `, ${A.sex}` : ""}{A.weight ? `, ${A.weight.value} ${A.weight.unit}` : ""}</li>
        {B.eventDescription && <li>{B.eventDescription}</li>}
        {B.relevantTests.map((test) => <li key={test.testId}>{test.testResult}{test.date ? ` on ${displayDate(test.date)}` : ""}</li>)}
        {B.relevantHistory && <li>Relevant history: {B.relevantHistory}</li>}
        {C.productAvailability && <li>Product availability: {C.productAvailability.replaceAll("-", " ")}</li>}
        {D.suspectProducts.map((product) => <li key={product.productId}>{product.name ?? "Unnamed product"} as a suspect product{product.dose ? `, ${product.dose}` : ""}</li>)}
        {E.suspectDevice && <li>{E.suspectDevice.brandName ?? "Unnamed device"} as the suspect medical device{E.suspectDevice.modelNumber ? `, model ${E.suspectDevice.modelNumber}` : ""}</li>}
        {F.concomitantProducts.map((product) => <li key={product.productId}>{product.name ?? "Unnamed product"} as another medical product</li>)}
        {G.reporter.firstName && G.reporter.lastName && <li>Reporter: {G.reporter.firstName} {G.reporter.lastName}</li>}
      </Summary>

      <Summary title="Needs attention" tone={conflicts.length > 0 ? "attention" : "quiet"}>
        {conflicts.length === 0 ? <li>No unresolved conflicts.</li> : conflicts.map((conflict) => (
          <li key={conflict.target}>{targetLabel(snapshot, conflict.target)} has incompatible sources and is omitted unless you resolve it.</li>
        ))}
      </Summary>
      {conflicts.map((conflict) => <ConflictCard key={conflict.target} snapshot={snapshot} item={conflict} busy={busy} act={act} />)}

      <Summary title="Omitted or unsupported" tone="quiet">
        {snapshot.projection.omissions.map((item, index) => <li key={`${item.target}-${index}`}>{humanOmission(snapshot, item.target, item.concept)}: {omissionLabel(item.reason)}</li>)}
        {snapshot.projection.notIncluded.map((item) => <li key={item}>{item}</li>)}
      </Summary>
      {snapshot.outputIssues.length > 0 && <Summary title="Required before output" tone="attention">
        {snapshot.outputIssues.map((issue) => <li key={issue}>{issue}</li>)}
      </Summary>}

      <div className={styles.decisionActions}>
        <button disabled={busy || !snapshot.downloadReady} onClick={() => void openPdf("preview")}>Open PDF preview</button>
        <button className={styles.download} disabled={busy || !snapshot.downloadReady} onClick={() => void openPdf("download")}>Download official PDF</button>
      </div>

      <section className={styles.updateBox} aria-labelledby="update-title">
        <h2 id="update-title">Add a correction or later update</h2>
        <p>Wilson will propose changes against the reviewed product identities. Existing facts remain active until you accept an update.</p>
        <label htmlFor="later-update">Clinical update</label>
        <textarea id="later-update" rows={5} value={update} onChange={(event) => setUpdate(event.target.value)} />
        <button disabled={busy || !update.trim()} onClick={() => void act({ action: "submit-update", text: update })}>Review this update</button>
      </section>

      <h2 className={styles.reviewedHeading}>Reviewed knowledge</h2>
      <CaseCards snapshot={snapshot} busy={busy} act={act} />
    </section>
    <section className={styles.previewPanel} aria-labelledby="preview-title">
      <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Same case revision</p><h2 id="preview-title">Form FDA 3500 preview</h2></div></div>
      <FormPreview snapshot={snapshot} />
    </section>
  </div>;
}

function ConflictCard({ snapshot, item, busy, act }: {
  snapshot: JourneySnapshot; item: ReviewAttentionItem; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  return <fieldset className={styles.conflictChoice}>
    <legend>{targetLabel(snapshot, item.target)}</legend>
    {item.values.map((value) => <div className={styles.conflictOption} key={value.id}>
      <strong>{formatFact(value.value)}</strong>
      <Evidence excerpt={value.evidence} expanded />
      <button disabled={busy} onClick={() => void act({ action: "resolve-conflict", target: item.target, chosenValueId: value.id })}>Use {formatFact(value.value)}</button>
    </div>)}
    <p className={styles.hint}>You may leave this unresolved. Neither alternative will be put in the form.</p>
  </fieldset>;
}

function FormPreview({ snapshot }: { snapshot: JourneySnapshot }) {
  const { A, B, C, D, E, F, G } = snapshot.projection.sections;
  const omissionByTarget = new Map(snapshot.projection.omissions.map((item) => [item.target, item.reason]));
  return <div className={styles.formPreview} aria-label="Form FDA 3500 preview">
    <header className={styles.formHeader}>
      <div><strong>MedWatch</strong><span>The FDA Safety Information and Adverse Event Reporting Program</span></div>
      <div><strong>Form FDA 3500</strong><span>Voluntary Reporting</span></div>
    </header>
    <PreviewSection letter="A" title="Patient information">
      <PreviewField label="Patient identifier" value={A.patientIdentifier} />
      <PreviewField label="Age" value={A.ageYears === undefined ? undefined : `${A.ageYears} years`} />
      <PreviewField label="Sex" value={A.sex} />
      <PreviewField label="Weight" value={A.weight ? `${A.weight.value} ${A.weight.unit}` : undefined} />
    </PreviewSection>
    <PreviewSection letter="B" title="Adverse event or product problem">
      <PreviewField label="Report type" value={B.reportType === "adverse-event" ? "Adverse event" : B.reportType === "product-problem" ? "Product problem" : B.reportType === "adverse-event-and-product-problem" ? "Adverse event and product problem" : undefined} />
      <PreviewField label="Serious outcomes" value={Object.entries(seriousOutcomeLabels).filter(([field]) => B[field as keyof typeof seriousOutcomeLabels] === true).map(([, label]) => label).join(", ") || "None recorded"} />
      <PreviewField label="Date of death" value={displayDate(B.deathDate)} />
      <PreviewField label="Date of event" value={displayDate(B.eventDate)} />
      <PreviewField label="Relevant tests" value={B.relevantTests.map((test) => [test.testResult, test.lowRange && `low ${test.lowRange}`, test.highRange && `high ${test.highRange}`, displayDate(test.date)].filter(Boolean).join(" · ")).join("; ") || undefined} />
      <PreviewField wide label="Relevant history" value={B.relevantHistory} />
      <PreviewField wide label="Describe event" value={B.eventDescription} />
    </PreviewSection>
    <PreviewSection letter="C" title="Product availability">
      <PreviewField label="Available for evaluation" value={C.productAvailability?.replaceAll("-", " ")} />
      <PreviewField label="Returned on" value={displayDate(C.productReturnDate)} />
    </PreviewSection>
    <PreviewSection letter="D" title="Suspect products">
      {D.suspectProducts.map((product, index) => <div className={styles.previewProduct} key={product.productId}>
        <strong>#{index + 1} {product.name}</strong>
        <span>{[product.dose, product.frequency, product.route].filter(Boolean).join(" · ") || "Regimen not provided"}</span>
        <span>Started: {product.startDate ? displayDate(product.startDate) : omissionText(omissionByTarget.get(`product:${product.productId}:startDate`))}</span>
        <span>Used for: {product.indication ?? omissionText(omissionByTarget.get(`product:${product.productId}:indication`))}</span>
      </div>)}
    </PreviewSection>
    <PreviewSection letter="E" title="Suspect medical device">
      <PreviewField label="Brand and common name" value={E.suspectDevice ? [E.suspectDevice.brandName, E.suspectDevice.commonName].filter(Boolean).join(" · ") : undefined} />
      <PreviewField label="Manufacturer" value={E.suspectDevice?.manufacturer} />
      <PreviewField label="Model / lot / serial" value={E.suspectDevice ? [E.suspectDevice.modelNumber, E.suspectDevice.lotNumber, E.suspectDevice.serialNumber].filter(Boolean).join(" · ") : undefined} />
      <PreviewField wide label="UDI" value={E.suspectDevice?.udi} />
    </PreviewSection>
    <PreviewSection letter="F" title="Other medical products">
      {F.concomitantProducts.length === 0 ? <PreviewField label="Product" /> : F.concomitantProducts.map((product) => <PreviewField key={product.productId} label="Product" value={product.name} />)}
    </PreviewSection>
    <PreviewSection letter="G" title="Reporter">
      <PreviewField label="Name" value={G.reporter.firstName && G.reporter.lastName ? `${G.reporter.firstName} ${G.reporter.lastName}` : undefined} />
      <PreviewField label="Contact" value={G.reporter.email ?? G.reporter.phone} />
      <PreviewField label="Occupation" value={G.reporter.occupation} />
      <PreviewField label="Identity disclosure" value={G.reporter.doNotDiscloseIdentity === undefined ? undefined : G.reporter.doNotDiscloseIdentity ? "Do not disclose" : "Disclosure permitted"} />
    </PreviewSection>
    <footer>FORM FDA 3500 (09/2025) · Supported fields preview</footer>
  </div>;
}

function PreviewSection({ letter, title, children }: { letter: string; title: string; children: ReactNode }) {
  return <section className={styles.previewSection}><h3><span>{letter}</span>{title}</h3><div>{children}</div></section>;
}

function PreviewField({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? styles.previewWide : undefined}><span>{label}</span><strong>{value ?? "Not provided"}</strong></div>;
}

function Summary({ title, tone, children }: { title: string; tone: "included" | "attention" | "quiet"; children: ReactNode }) {
  return <section className={`${styles.summary} ${styles[tone]}`}><h2>{title}</h2><ul>{children}</ul></section>;
}

function CaseCards({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<void>;
}) {
  const understanding = snapshot.understanding;
  if (snapshot.revision === 0) return <p className={styles.emptyCase}>Proposed case knowledge will appear here after Wilson reads the account.</p>;
  return <div className={styles.cards}>
    <CaseCard title="Patient" groupId="patient" facts={understanding.patient} fields={["identifier", "ageYears", "sex", "weight"]} allowChanges={snapshot.stage === "understanding"} busy={busy} act={act} />
    <CaseCard title="Event" groupId="event" facts={understanding.event} fields={["reportType", "problemDescription", "symptoms", "onsetDate", "death", "deathDate", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "treatments", "outcome", "dischargeDate", "productAvailability", "productReturnDate", "relevantHistory"]} allowChanges={snapshot.stage === "understanding"} busy={busy} act={act} />
    {understanding.relevantTests.map((test, index) => <CaseCard key={test.id} title={`Relevant test ${index + 1}`} eyebrow="Test or laboratory result" groupId={test.proposalGroupId} facts={test.facts} fields={["testResult", "lowRange", "highRange", "date"]} allowChanges={snapshot.stage === "understanding" && test.state === "proposed"} busy={busy} act={act} />)}
    {understanding.products.map((product) => {
      const name = formatFact(activeValue(product.facts.name));
      const role = formatFact(activeValue(product.facts.role));
      const productType = formatFact(activeValue(product.facts.productType));
      const fields = productType === "device"
        ? ["commonName", "manufacturer", "procode", "modelNumber", "lotNumber", "catalogNumber", "expirationDate", "serialNumber", "udi", "deviceOperator", "implanted", "implantDate", "explantDate", "reprocessedSingleUse", "reprocessor", "servicedByThirdParty"]
        : ["manufacturer", "lotNumber", "dose", "frequency", "route", "startDate", "stopped", "stopDate", "indication"];
      return <CaseCard key={product.id} title={name} eyebrow={productType === "device" ? "Suspect medical device" : role === "suspect" ? "Suspect product" : "Other product"} groupId={product.proposalGroupId} facts={product.facts} fields={fields} evidenceFields={["name", "productType", "role"]} allowChanges={snapshot.stage === "understanding" && product.state === "proposed"} allowRemove={snapshot.stage === "understanding" && product.state === "proposed"} busy={busy} act={act} />;
    })}
    {Object.values(understanding.reporter).some((fact) => activeValue(fact)) && <CaseCard title="Reporter" groupId="reporter" facts={understanding.reporter} fields={["firstName", "lastName", "phone", "email", "address", "city", "state", "postalCode", "country", "healthProfessional", "occupation", "reportedTo", "doNotDiscloseIdentity"]} allowChanges={false} busy={busy} act={act} />}
  </div>;
}

function CaseCard({ title, eyebrow, groupId, facts, fields, evidenceFields = [], allowChanges, allowRemove = false, busy, act }: {
  title: string;
  eyebrow?: string;
  groupId: string;
  facts: Record<string, FactView>;
  fields: string[];
  evidenceFields?: string[];
  allowChanges: boolean;
  allowRemove?: boolean;
  busy: boolean;
  act: (action: JourneyAction) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string>();
  const [replacement, setReplacement] = useState("");
  const evidence = [...new Set([...fields, ...evidenceFields].flatMap((field) => facts[field]?.evidence ?? []))];
  return <article className={styles.caseCard}>
    <div className={styles.cardTitle}>
      <div>{eyebrow && <span>{eyebrow}</span>}<h3>{title}</h3></div>
      {allowRemove && <div className={styles.cardActions}><button disabled={busy} onClick={() => void act({ action: "reject-group", groupId })}>Remove {title}</button></div>}
    </div>
    <dl>{fields.map((field) => {
      const fact = facts[field];
      if (!fact) return null;
      const value = activeValue(fact);
      if (!value && fact.history.length === 0 && fact.conflicts.length === 0) return null;
      const proposal = fact.proposals.find(({ groupId: proposalGroup }) => proposalGroup === groupId);
      const editable = allowChanges && proposal?.value.kind === "known" && !Array.isArray(proposal.value.value) && (typeof proposal.value.value === "string" || typeof proposal.value.value === "number" || typeof proposal.value.value === "boolean");
      return <div key={field}>
        <dt>{fieldLabel(field)}</dt>
        <dd>{fact.state === "conflicted" ? "Unresolved conflict" : formatFact(value)}{fact.state === "proposed" && <span className={styles.proposed}>Proposed</span>}</dd>
        {fact.history.map((history, index) => <dd key={index} className={styles.history}>Earlier: {formatFact(history.value)}</dd>)}
        {editable && editing !== field && <button className={styles.inlineAction} disabled={busy} onClick={() => { setEditing(field); setReplacement(String(proposal.value.kind === "known" ? proposal.value.value : "")); }}>Change</button>}
        {editable && editing === field && <div className={styles.inlineEdit}>
          <input aria-label={`New ${fieldLabel(field)}`} value={replacement} onChange={(event) => setReplacement(event.target.value)} />
          <button disabled={busy || !replacement.trim()} onClick={() => {
            const replacementValue = replacementFor(proposal.value, replacement);
            void act({ action: "change-proposal", groupId, proposalId: proposal.id, value: replacementValue, statement: `${fieldLabel(field)} corrected to ${replacement}.` });
            setEditing(undefined);
          }}>Apply change</button>
        </div>}
      </div>;
    })}</dl>
    {evidence.length > 0 && <Evidence excerpt={evidence} />}
  </article>;
}

function groupAttention(items: ReviewAttentionItem[]) {
  const groups = new Map<string, ReviewAttentionItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    groups.set(item.groupId, [...(groups.get(item.groupId) ?? []), item]);
  }
  return [...groups].map(([groupId, grouped]) => ({ groupId, items: grouped }));
}

function replacementFor(
  original: CaseValue<unknown>,
  replacement: string,
): Extract<JourneyAction, { action: "change-proposal" }>["value"] {
  if (original.kind !== "known") return { kind: "known", value: replacement };
  if (typeof original.value === "number") return { kind: "known", value: Number(replacement) };
  if (typeof original.value === "boolean") return { kind: "known", value: replacement.toLowerCase() === "yes" || replacement.toLowerCase() === "true" };
  return { kind: "known", value: replacement };
}

function activeValue(fact: FactView | undefined): CaseValue<unknown> | undefined {
  return fact?.resolved ?? fact?.proposals[0]?.value;
}

function formatFact(value: CaseValue<unknown> | undefined): string {
  if (!value) return "Not provided";
  if (value.kind !== "known") return value.kind.replaceAll("-", " ");
  if (Array.isArray(value.value)) return value.value.join(" and ");
  if (typeof value.value === "object" && value.value && "unit" in value.value) {
    const measured = value.value as Record<string, unknown>;
    return `${String(measured.value)} ${String(measured.unit)}`;
  }
  if (typeof value.value === "boolean") return value.value ? "Yes" : "No";
  if (typeof value.value === "string") {
    const label = {
      "adverse-event": "Adverse event",
      "product-problem": "Product problem",
      "adverse-event-and-product-problem": "Adverse event and product problem",
    }[value.value];
    if (label) return label;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.value)) return displayDate(value.value) ?? value.value;
  }
  return String(value.value);
}

function displayDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${Number(day)}-${name}-${year}`;
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    identifier: "Identifier", ageYears: "Age", sex: "Sex", weight: "Weight", problemDescription: "Product problem", symptoms: "Symptoms", onsetDate: "Onset",
    reportType: "Report type", death: "Death", deathDate: "Date of death", lifeThreatening: "Life-threatening", hospitalized: "Hospitalized",
    disability: "Disability or permanent damage", requiredIntervention: "Required intervention", congenitalAnomaly: "Congenital anomaly", otherSerious: "Other serious event",
    treatments: "Treatment", outcome: "Outcome", relevantTestsAvailable: "Relevant tests", relevantHistory: "Relevant history", testResult: "Test and result", lowRange: "Low range", highRange: "High range", date: "Date",
    dischargeDate: "Discharged", dose: "Dose", frequency: "Frequency", route: "Route", startDate: "Started",
    productAvailability: "Product availability", productReturnDate: "Returned to manufacturer", stopped: "Stopped", stopDate: "Stopped date", indication: "Used for", name: "Name", productType: "Product type", role: "Role", manufacturer: "Manufacturer", lotNumber: "Lot number",
    commonName: "Common device name", procode: "Procode", modelNumber: "Model number", catalogNumber: "Catalog number", expirationDate: "Expiration date", serialNumber: "Serial number", udi: "Unique device identifier", deviceOperator: "Device operator", implanted: "Implanted device", implantDate: "Implant date", explantDate: "Explant date", reprocessedSingleUse: "Reprocessed single-use device", reprocessor: "Reprocessor", servicedByThirdParty: "Third-party serviced",
    firstName: "First name", lastName: "Last name", address: "Address", city: "City", state: "State", postalCode: "ZIP/postal code", country: "Country",
    phone: "Phone", email: "Email", healthProfessional: "Health professional", occupation: "Occupation", reportedTo: "Also reported to", doNotDiscloseIdentity: "Keep identity from manufacturer",
  };
  return labels[field] ?? humanizeIdentifier(field);
}

function unrepresentedTargetLabel(entity: string, field: string): string {
  const entityLabel = { patient: "Patient", event: "Event", product: "Product", test: "Relevant test" }[entity]
    ?? "Case detail";
  return `${entityLabel} — ${fieldLabel(field)}`;
}

function unrepresentedReason(reason: JourneySnapshot["unrepresented"][number]["reason"]): string {
  return {
    "unsupported-proposal": "The suggestion did not use Wilson’s supported proposal format.",
    "unsupported-target": "Wilson does not support that case field in this path.",
    "product-limit": "The suggestion was for a product beyond Wilson’s supported three-product limit.",
    "incompatible-value": "The suggested value did not match the supported format for this field.",
    "unresolved-entity": "The suggestion could not be linked to a reviewed product or relevant test.",
    "evidence-not-found": "The cited wording was not found exactly in the clinician’s input.",
    "evidence-ambiguous": "The cited wording occurred more than once and could not be anchored unambiguously.",
    "incomplete-relevant-test": "The relevant test could not be kept without its test-and-result detail.",
  }[reason];
}

function humanizeIdentifier(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("-", " ").trim();
  return spaced ? `${spaced[0].toUpperCase()}${spaced.slice(1)}` : "Proposed detail";
}

function targetLabel(snapshot: JourneySnapshot, target: string): string {
  const [entity, entityId, field] = target.split(":");
  if (entity === "test") {
    const index = snapshot.understanding.relevantTests.findIndex(({ id }) => id === entityId);
    return `Relevant test ${index + 1} — ${fieldLabel(field ?? "")}`;
  }
  if (entity !== "product") return field ? fieldLabel(field) : target;
  const product = snapshot.understanding.products.find(({ id }) => id === entityId);
  return `${formatFact(activeValue(product?.facts.name))} — ${fieldLabel(field ?? "")}`;
}

function omissionLabel(reason: string): string {
  return reason === "empty" ? "not provided" : reason.replaceAll("-", " ");
}

function omissionText(reason: string | undefined): string {
  return reason === "conflicted" ? "Omitted — unresolved conflict" : reason ? omissionLabel(reason) : "Not provided";
}

export function humanOmission(snapshot: JourneySnapshot, target: string, fallback: string): string {
  const [entity, , field] = target.split(":");
  if (entity !== "product") return field ? fieldLabel(field) : fallback;
  return targetLabel(snapshot, target);
}

function Evidence({ excerpt, expanded = false }: { excerpt?: string | string[]; expanded?: boolean }) {
  const excerpts = (Array.isArray(excerpt) ? excerpt : [excerpt]).filter((value): value is string => Boolean(value));
  if (excerpts.length === 0) return null;
  return expanded
    ? <blockquote className={styles.evidence}><span>Source evidence</span>{excerpts.map((value) => <span key={value}>“{value}”</span>)}</blockquote>
    : <details className={styles.evidence}><summary>View source evidence</summary>{excerpts.map((value) => <blockquote key={value}>“{value}”</blockquote>)}</details>;
}

function displayError(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error)) return fallback;
  if (caught instanceof JourneyRequestError && caught.diagnosticReference) return `${caught.message} Diagnostic reference: ${caught.diagnosticReference}`;
  return caught.message;
}
