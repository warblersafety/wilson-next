"use client";

import { useEffect, useRef, useState } from "react";
import { productDisplayLabel } from "../src/domain/case/product-label";
import type { CaseValue, ReportType } from "../src/domain/case/types";
import type { FactView, ProductView, ReviewAttentionItem } from "../src/domain/case/views";
import type { BrowserJourneyState, JourneyResponse } from "../src/server/case/browser-state";
import type { JourneyAction, JourneySnapshot } from "../src/server/journey/service";
import { factControl, knownOptionLabel, type FactControl, type FactControlEntity } from "./fact-controls";
import {
  clearJourneySession,
  JourneyRequestError,
  readStoredJourneyState,
  requestJourneyJson,
  requestJourneyPdf,
  storeJourneyState,
} from "./browser-diagnostics";
import { MedicationTask } from "./medication-task";
import styles from "./page.module.css";
import { productCardFields } from "./product-fields";

const progressMessages = {
  opening: "Organizing your account…",
  update: "Organizing your update…",
  case: "Updating your case…",
  reset: "Starting a new case…",
  pdf: "Preparing the PDF…",
};

type Screen = "describe" | "details" | "reporter" | "save";
type PdfArtifact = { url: string; filename: string; caseId: string; contentKey: string };

export default function Journey() {
  const [reporterDirty, setReporterDirty] = useState(false);
  const [screen, setScreen] = useState<Screen>("describe");
  const [pdf, setPdf] = useState<PdfArtifact>();
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [browserState, setBrowserState] = useState<BrowserJourneyState>();
  const [opening, setOpening] = useState("");
  const [reportType, setReportType] = useState<ReportType | undefined>("adverse-event");
  const [update, setUpdate] = useState("");
  const [pendingOperation, setPendingOperation] = useState<keyof typeof progressMessages>();
  const busy = pendingOperation !== undefined;
  const [error, setError] = useState<string>();
  const [boundaryNotice, setBoundaryNotice] = useState<string>();
  const [resetNotice, setResetNotice] = useState(false);
  const previousTask = useRef<string | undefined>(undefined);

  useEffect(() => { void loadJourney(); }, []);

  const task = screen;
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  useEffect(() => {
    if (!task) return;
    if (previousTask.current && previousTask.current !== task) {
      const heading = document.querySelector<HTMLElement>(`[data-screen="${screen}"] h1`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
    previousTask.current = task;
  }, [task]);

  useEffect(() => {
    if (!resetNotice) return;
    document.getElementById("opening-account")?.focus();
    const timer = window.setTimeout(() => setResetNotice(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [resetNotice]);

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
        }, "This tab’s previous case could not be restored");
        acceptResponse(response);
        setScreen(response.snapshot.stage === "describe" ? "describe" : "details");
      } catch (caught) {
        if (caught instanceof JourneyRequestError
          && ["incompatible-browser-state", "malformed-browser-state", "stale-browser-state"].includes(caught.code ?? "")) {
          clearJourneySession();
          await freshJourney("Wilson could not restore this tab’s previous case. That work is no longer available, so a new case was started.");
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setError(displayError(caught, "The temporary case could not be loaded"));
    }
  }

  async function act(action: JourneyAction) {
    if (!snapshot || !browserState) return false;
    setPendingOperation(action.action === "submit-opening" ? "opening" : action.action === "submit-update" ? "update" : "case");
    setError(undefined);
    setBoundaryNotice(undefined);
    setResetNotice(false);
    try {
      const response = await requestJourneyJson<JourneyResponse>({
        method: "POST",
        body: { operation: "act", state: browserState, expectedRevision: snapshot.revision, action },
      }, "Wilson could not update the case");
      acceptResponse(response);
      if (response.snapshot.transitionNotice) setBoundaryNotice(response.snapshot.transitionNotice);
      if (action.action === "submit-opening") setScreen("details");
      if (action.action === "answer-reporter") setScreen("save");
      if (action.action === "submit-update") setScreen("details");
      if (action.action === "submit-update") setUpdate((current) => current === action.text ? "" : current);
      return true;
    } catch (caught) {
      setError(displayError(caught, "Wilson could not update the case"));
      return false;
    } finally {
      setPendingOperation(undefined);
    }
  }

  async function resetJourney() {
    if (((snapshot?.revision ?? 0) > 0 || opening.length > 0 || update.length > 0 || reportType !== "adverse-event")
      && !window.confirm("Start a new case? This case and any unfinished text will be lost.")) return;
    setPendingOperation("reset");
    setError(undefined);
    setBoundaryNotice(undefined);
    setResetNotice(false);
    try {
      const response = await requestJourneyJson<JourneyResponse>({}, "The new case could not be started");
      clearJourneySession();
      acceptResponse(response);
      setOpening("");
      setUpdate("");
      setPdf(undefined);
      setScreen("describe");
      setReportType("adverse-event");
      setResetNotice(true);
    } catch (caught) {
      setError(displayError(caught, "The new case could not be started"));
    } finally {
      setPendingOperation(undefined);
    }
  }

  async function generatePdf() {
    if (!browserState || !snapshot?.downloadReady) return;
    setPendingOperation("pdf");
    setError(undefined);
    try {
      const { blob, filename } = await requestJourneyPdf(browserState, "preview");
      setPdf({ url: URL.createObjectURL(blob), filename, caseId: browserState.case.id, contentKey: snapshot.reportContentKey });
    } catch (caught) {
      setError(displayError(caught, "The official PDF could not be generated"));
    } finally {
      setPendingOperation(undefined);
    }
  }

  useEffect(() => {
    if (screen === "save" && snapshot?.downloadReady && pdf?.contentKey !== snapshot.reportContentKey) void generatePdf();
  // Generate once on entering this screen or changing accepted contents/readiness. Errors expose an explicit retry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, snapshot?.reportContentKey, snapshot?.downloadReady]);

  if (!snapshot) return <main className={styles.loading}><p>{error ?? "Preparing your case…"}</p></main>;

  return (
    <main className={styles.appShell}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.wordmark}>Wilson</span><span className={styles.purpose}>Prepare an FDA MedWatch report.</span></div>
        <div className={styles.headerActions}>
          <span className={styles.resetNotice} role="status">{resetNotice ? "New case started" : ""}</span>
          <button disabled={busy} onClick={() => void resetJourney()}>New case</button>
        </div>
      </header>
      <aside className={styles.boundary} aria-label="Preview notice">
        <p><strong>Demo only. Use fictional information.</strong> Do not use this preview for a real report.</p>
        <details className={styles.previewAbout}>
          <summary>About this preview</summary>
          <div>
            <p>Wilson helps you prepare a downloadable Form FDA 3500. It does not submit the report to FDA.</p>
            <p>This preview supports a limited set of details for adult medication side effects, adverse events or product problems involving one medical device, and quality problems with other medical products. It does not cover every report or every field on the form. Details that cannot be included are shown with your case. Tests can be added during review; another medicine must be included in the starting account of a new case.</p>
            <p>Your case is temporary and kept only in this browser tab. Closing the tab or starting a new case clears it. Unsubmitted text is not saved. Do not rely on reloading, reopening a tab, or using another device to recover your work.</p>
          </div>
        </details>
      </aside>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {boundaryNotice && <div className={styles.notice} role="status">{boundaryNotice}</div>}
      {snapshot.unrepresented.length > 0 && <UnrepresentedNotice items={snapshot.unrepresented} />}
      {pendingOperation && <div className={styles.progress} role="status">{progressMessages[pendingOperation]}</div>}
      <nav className={styles.stepper} aria-label="Report steps">
        {([["describe", "Describe"], ["details", "Review details"], ["reporter", "Reporter details"], ["save", "Review & save"]] as const).map(([value, label], index) =>
          <button key={value} aria-current={screen === value ? "step" : undefined} disabled={busy || (value !== "describe" && snapshot.revision === 0)} onClick={() => setScreen(value)}><span>{index + 1}</span><span>{label}</span></button>)}
      </nav>
      <div className={styles.screen}>
        <section data-screen="describe" hidden={screen !== "describe"} className={styles.describeScreen}>
          {snapshot.revision === 0
            ? <Describe key={browserState?.case.id} opening={opening} setOpening={setOpening} reportType={reportType} setReportType={setReportType} busy={busy} interpreting={pendingOperation === "opening"} act={act} />
            : <><p className={styles.eyebrow}>Your starting account</p><h1>Describe what happened</h1><div className={styles.caseCard}><p className={styles.originalAccount}>{opening || browserState?.case.sources.find(({ inputType }) => inputType === "narrative")?.excerpt || "Your submitted account is retained with the source evidence in Review details."}</p></div><p>The account has been interpreted. Add new information or corrections in Review details.</p><button onClick={() => setScreen("details")}>Return to review details</button></>}
        </section>
        <section data-screen="details" hidden={screen !== "details"}>
          <p className={styles.eyebrow}>Your case, taking shape</p>
          <h1>Review the case details</h1>
          <p className={styles.lead}>Check what Wilson captured. Accept each group when it is correct, or change what needs correcting.</p>
          {pdf && <div className={styles.returnBanner}><div><strong>A PDF has been generated for this case</strong><p>{snapshot.downloadReady && pdf.contentKey === snapshot.reportContentKey ? "Accepted report contents are unchanged." : "New work needs review before a current PDF is ready."}</p></div><button onClick={() => setScreen("save")}>Return to PDF</button></div>}
          {snapshot.stage === "review-update" && <UpdateReview snapshot={snapshot} busy={busy} act={act} />}
          {snapshot.review.attention.filter(({ kind }) => kind === "conflict").map((item) => <ConflictCard key={item.target} snapshot={snapshot} item={item} busy={busy || snapshot.stage !== "output"} act={act} />)}
          <CaseSummaryHeading attention={snapshot.review.attention} />
          <CaseCards key={browserState?.case.id} snapshot={snapshot} busy={busy} act={act} />
          <section className={styles.invitation} aria-label="Useful clinical details">
            <h2>Anything to add or correct?</h2>
            {snapshot.clinicalNeeds.length > 0 && <div className={styles.caseGuidance}><p>These details would help complete this report:</p><ul>{snapshot.clinicalNeeds.map((need) => <li key={`${need.key}:${need.targetIds.join()}`}>{need.question}</li>)}</ul></div>}
            <p>Answer several things together, or add another detail. Say which product or test it concerns. Proposed answers remain here until you accept them.</p>
            <CorrectionInput update={update} setUpdate={setUpdate} busy={busy || snapshot.stage === "review-update" || snapshot.stage === "describe"} act={act} />
            {snapshot.clarification && snapshot.clarification.kind !== "reporter" && <details className={styles.directQuestions}><summary>Use direct answers for the next question</summary><CompletionTask key={clinicalDraftKey(snapshot)} snapshot={snapshot} busy={busy || snapshot.stage !== "clarify"} act={act} /></details>}
          </section>
          <div className={styles.screenActions}><p>{snapshot.clinicalNeeds.length > 0 ? "Complete the applicable clinical details to prepare the PDF. You can view reporter details at any time." : "Your accepted details will be used in the report."}</p><button disabled={busy} onClick={() => setScreen("reporter")}>Continue to reporter details</button></div>
        </section>
        <section data-screen="reporter" hidden={screen !== "reporter"}>
          <ReporterTask onDirtyChange={setReporterDirty} key={`${browserState?.case.id}:${JSON.stringify(snapshot.understanding.reporter)}:${JSON.stringify(snapshot.understanding.event.reportDate.resolved)}`} snapshot={snapshot} busy={busy} act={act} />
          <div className={styles.screenActions}><button onClick={() => setScreen("details")}>Back to review details</button><button onClick={() => setScreen("save")}>Return to review & save</button></div>
        </section>
        <section data-screen="save" hidden={screen !== "save"}>
          <OutputComposition snapshot={snapshot} pdf={pdf} caseId={browserState?.case.id} busy={busy} generatePdf={generatePdf} navigate={setScreen} hasDraft={Boolean(update.trim())} reporterDirty={reporterDirty} />
        </section>
      </div>
      <footer className={styles.footer}>Wilson prepares Form FDA 3500 for your review. Nothing is submitted to FDA.</footer>
    </main>
  );
}

function clinicalDraftKey(snapshot: JourneySnapshot): string {
  const q = snapshot.clarification;
  if (!q) return "none";
  const product = q.kind === "medication-history" ? snapshot.understanding.products.find(({ id }) => id === q.productId)
    : q.kind === "device-details" ? snapshot.understanding.products.find(({ id }) => id === q.deviceId) : undefined;
  return JSON.stringify([q.key, q.targetIds, product && [product.state, ...["name", "role", "productType", "stopped", "doseReduced", "restarted", "implanted", "reprocessedSingleUse"].map((field) => product.facts[field].resolved)]]);
}

function CaseSummaryHeading({ attention }: { attention: ReviewAttentionItem[] }) {
  const proposals = attention.filter(({ kind }) => kind !== "conflict").length;
  const conflicts = attention.filter(({ kind }) => kind === "conflict").length;
  return <div className={styles.caseSummaryHeading}>
    <h2 id="case-title">Case summary</h2>
    <p>Check these details against your account.</p>
    {proposals > 0 && <p>{proposals} proposed {proposals === 1 ? "detail" : "details"} to check</p>}
    {conflicts > 0 && <p>{conflicts} unresolved {conflicts === 1 ? "conflict" : "conflicts"}</p>}
  </div>;
}

function Describe({ opening, setOpening, reportType, setReportType, busy, interpreting, act }: {
  opening: string; setOpening: (value: string) => void; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
  reportType: ReportType | undefined; setReportType: (value: ReportType | undefined) => void;
  interpreting: boolean;
}) {
  const adverseEvent = reportType === "adverse-event" || reportType === "adverse-event-and-product-problem";
  const productProblem = reportType === "product-problem" || reportType === "adverse-event-and-product-problem";
  return <>
    <h1 id="task-title">Describe what happened</h1>
    <p>Type, paste, or dictate your account. Wilson will organize it into a summary for you to check and correct, then help you prepare a downloadable report.</p>
    <NarrativeInput id="opening-account" label="Clinical account" context="account" rows={8} disabled={busy} value={opening} onChange={setOpening} />
    <fieldset className={styles.reportType}><legend>Report type</legend>
      <label><input type="checkbox" checked={adverseEvent} onChange={(event) => setReportType(event.target.checked ? productProblem ? "adverse-event-and-product-problem" : "adverse-event" : productProblem ? "product-problem" : undefined)} /> Adverse event</label>
      <label><input type="checkbox" checked={productProblem} onChange={(event) => setReportType(event.target.checked ? adverseEvent ? "adverse-event-and-product-problem" : "product-problem" : adverseEvent ? "adverse-event" : undefined)} /> Product problem</label>
    </fieldset>
    <button disabled={busy || !opening.trim() || !reportType} onClick={() => reportType && void act({ action: "submit-opening", text: opening, reportType })}>
      {interpreting ? "Extracting case details…" : "Review Wilson’s understanding"}
    </button>
  </>;
}

function NarrativeInput({ id, label, context, rows, value, onChange, disabled = false }: {
  id: string; label: string; context: "account" | "update"; rows: number;
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  return <div>
    <label htmlFor={id}>{label}</label>
    <textarea disabled={disabled} id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-hint`} />
    <p id={`${id}-hint`} className={styles.hint}>Check the text and correct any errors before continuing.</p>
    <div className={styles.dictationDisclosure}>
      <button type="button" className={styles.dictationToggle} aria-expanded={helpOpen} aria-controls={`${id}-dictation`}
        onClick={() => setHelpOpen(!helpOpen)}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
        </svg>
        How to dictate
        <svg aria-hidden="true" className={styles.dictationArrow} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="m5 3 5 5-5 5" />
        </svg>
      </button>
      <div id={`${id}-dictation`} className={styles.dictationHelp} hidden={!helpOpen}>
        <p>You can speak instead of typing in {label} using your computer’s built-in dictation. Your spoken words appear as editable text.</p>
        <details className={styles.dictationPlatform}>
          <summary>Mac instructions</summary>
          <ol>
            <li>Click in <strong>{label}</strong> where you want to add text.</li>
            <li>Choose <strong>Edit → Start Dictation</strong> from the menu bar, or use your Dictation shortcut.</li>
            <li>Speak your {context}. When finished, press <strong>Esc</strong> to stop dictation.</li>
          </ol>
        </details>
        <details className={styles.dictationPlatform}>
          <summary>Windows instructions</summary>
          <ol>
            <li>Click in <strong>{label}</strong> where you want to add text.</li>
            <li>Press <strong>Windows + H</strong> to start voice typing.</li>
            <li>Speak your {context}. When finished, click the microphone in the Windows voice-typing toolbar to stop dictation.</li>
          </ol>
        </details>
        <p>Check the text and correct any errors, especially medication names, doses, and words like “no” or “not.” When ready, select <strong>{context === "account" ? "Review Wilson’s understanding" : "Review this update"}</strong>.</p>
        <p>Wilson receives text, not audio. Your computer’s dictation service may send audio to Apple or Microsoft.</p>
      </div>
    </div>
  </div>;
}

function CorrectionInput({ update, setUpdate, busy, act }: {
  update: string; setUpdate: (value: string) => void; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  return <section className={styles.updateBox} aria-labelledby="update-title">
    <h3 id="update-title">Add or correct information</h3>
    <NarrativeInput id="later-update" label="Clinical update" context="update" rows={5} value={update} onChange={setUpdate} />
    <button disabled={busy || !update.trim()} onClick={() => void act({ action: "submit-update", text: update })}>Review this update</button>
  </section>;
}

function UnrepresentedNotice({ items }: { items: JourneySnapshot["unrepresented"] }) {
  return <section className={styles.quarantine} role="status" aria-labelledby="unrepresented-title">
    <h2 id="unrepresented-title">Some details were left out</h2>
    <p>Some suggested details could not be added. Check the summary, then describe what is missing in Clinical update. You can recover a missing test there.</p>
    <details><summary>View {items.length} omitted details and supporting text</summary>
    <ul>{items.map((item, index) => <li key={`${item.entity}-${item.field}-${index}`}>
      <strong>{unrepresentedTargetLabel(item.entity, item.field)}</strong>
      <span>{unrepresentedReason(item.reason)}</span>
      <blockquote>{item.evidenceQuote}</blockquote>
    </li>)}</ul></details>
  </section>;
}

type IndicationChoice = "known" | "unknown" | "declined";

function CompletionTask(props: { snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean> }) {
  const question = props.snapshot.clarification;
  if (!question) return null;
  return <>
    <p className={styles.eyebrow}>Clarify · {question.reason}</p>
    {question.kind === "medication-history" && <MedicationTask {...props} />}
    {question.kind === "indications" && <IndicationTask {...props} />}
    {question.kind === "serious-outcomes" && <SeriousOutcomesTask {...props} />}
    {question.kind === "death-date" && <DeathDateTask {...props} />}
    {question.kind === "clinical-context" && <ClinicalContextTask {...props} />}
    {question.kind === "device-details" && <DeviceDetailsTask {...props} />}
    {question.kind === "reporter" && <ReporterTask {...props} />}
  </>;
}

function IndicationTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
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
      const name = productViewLabel(product!);
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
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
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
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
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
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  const question = snapshot.clarification?.kind === "clinical-context" ? snapshot.clarification : undefined;
  const [testChoice, setTestChoice] = useState<ContextChoice>();
  const [historyChoice, setHistoryChoice] = useState<ContextChoice>();
  const [testName, setTestName] = useState("");
  const [testResult, setTestResult] = useState("");
  const [lowRange, setLowRange] = useState("");
  const [highRange, setHighRange] = useState("");
  const [testDate, setTestDate] = useState("");
  const [history, setHistory] = useState("");
  const testComplete = !question?.askTests || (testChoice && (testChoice !== "known" || Boolean(testName.trim() || testResult.trim())));
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
        <p>Enter the details you know. Leave missing units or dates blank; do not guess clinical terms.</p>
        <label>Test identity <input aria-label="Test identity" value={testName} onChange={(event) => setTestName(event.target.value)} /></label>
        <label>Result and stated units <input aria-label="Result and stated units" value={testResult} onChange={(event) => setTestResult(event.target.value)} /></label>
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
      test: question?.askTests ? testChoice === "known" ? { kind: "known", testName: testName.trim() || undefined, testResult: testResult.trim() || undefined, lowRange: lowRange.trim() || undefined, highRange: highRange.trim() || undefined, date: testDate || undefined } : { kind: testChoice as Exclude<ContextChoice, "known"> } : undefined,
      history: question?.askHistory ? contextValue(historyChoice, history) : undefined,
    })}>Add this context</button>
  </>;
}

type DeviceDetailChoice = "known" | "unknown" | "inapplicable" | "declined";
type DeviceDetailValue = Extract<JourneyAction, { action: "answer-device-details" }>["implantDate"];

function DeviceDetailsTask({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
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

function ReporterTask({ snapshot, busy, act, onDirtyChange }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>; onDirtyChange?: (dirty: boolean) => void;
}) {
  const accepted = snapshot.understanding.reporter;
  const saved = (field: string) => accepted[field]?.resolved;
  const text = (field: string, fallback = "") => knownString(saved(field)) ?? (saved(field) ? "" : fallback);
  const [values, setValues] = useState(() => ({ firstName: text("firstName"), lastName: text("lastName"), address: text("address"), city: text("city"), state: text("state"), postalCode: text("postalCode"), country: text("country", "UNITED STATES"), phone: text("phone"), email: text("email"), occupation: text("occupation", "Physician") }));
  const [reportDate, setReportDate] = useState(() => {
    const existing = snapshot.understanding.event.reportDate.resolved;
    if (existing) return existing.kind === "known" ? String(existing.value) : "";
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [healthProfessional, setHealthProfessional] = useState(() => saved("healthProfessional")?.kind === "known" ? Boolean((saved("healthProfessional") as { value: unknown }).value) : true);
  const [reportedTo, setReportedTo] = useState<Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer">>(() => saved("reportedTo")?.kind === "known" ? (saved("reportedTo") as { value: Array<"manufacturer" | "user-facility" | "distributor-importer" | "packer"> }).value : []);
  const [doNotDiscloseIdentity, setDoNotDiscloseIdentity] = useState(() => saved("doNotDiscloseIdentity")?.kind === "known" && Boolean((saved("doNotDiscloseIdentity") as { value: unknown }).value));
  const initialDraft = useRef(JSON.stringify([values, reportDate, healthProfessional, reportedTo, doNotDiscloseIdentity]));
  useEffect(() => {
    onDirtyChange?.(JSON.stringify([values, reportDate, healthProfessional, reportedTo, doNotDiscloseIdentity]) !== initialDraft.current);
  }, [values, reportDate, healthProfessional, reportedTo, doNotDiscloseIdentity, onDirtyChange]);
  const previouslySaved = Object.values(accepted).some(({ resolved }) => resolved);
  const canSave = (snapshot.stage === "clarify" && (snapshot.clarification?.kind === "reporter" || previouslySaved)) || snapshot.stage === "output";
  const set = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const complete = values.firstName.trim() && values.lastName.trim() && values.occupation && (values.phone.trim() || values.email.trim());
  const missing = [
    ...(!values.firstName.trim() ? ["first name"] : []),
    ...(!values.lastName.trim() ? ["last name"] : []),
    ...(!values.occupation.trim() ? ["occupation"] : []),
    ...(!values.phone.trim() && !values.email.trim() ? ["phone or email"] : []),
  ];
  return <>
    <p className={styles.eyebrow}>About the reporter</p><h1>Add the reporter details for this report</h1>
    <p className={styles.lead}>Tell us who is making this report. A name, occupation, and phone or email are required; address details are optional.</p>{!canSave && <p className={styles.notice}>You can draft these details now. Complete the clinical review before saving them.</p>}{saved("firstName")?.kind === "declined" && <p className={styles.notice}>Reporter details were previously declined. You can supply them here to replace that choice.</p>}
    <label>Date of this report <input disabled={busy} aria-label="Date of this report" type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
    <p>Defaults to today on your device. Change it if this report was prepared on another date. It stays the same when you reopen or download the form.</p>
    <fieldset disabled={busy} className={`${styles.answerGroup} ${styles.reporterFields}`}>
      <legend>Reporter identity and contact</legend>
      <label>First name <input aria-label="Reporter first name" value={values.firstName} onChange={(event) => set("firstName", event.target.value)} /></label>
      <label>Last name <input aria-label="Reporter last name" value={values.lastName} onChange={(event) => set("lastName", event.target.value)} /></label>
      <label>Phone <input aria-label="Reporter phone" value={values.phone} onChange={(event) => set("phone", event.target.value)} /></label>
      <label>Email <input aria-label="Reporter email" type="email" value={values.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label>Address (optional) <input aria-label="Reporter address" value={values.address} onChange={(event) => set("address", event.target.value)} /></label>
      <label>City (optional) <input aria-label="Reporter city" value={values.city} onChange={(event) => set("city", event.target.value)} /></label>
      <label>State (optional) <input aria-label="Reporter state" value={values.state} onChange={(event) => set("state", event.target.value)} /></label>
      <label>ZIP/postal code (optional) <input aria-label="Reporter postal code" value={values.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></label>
      <label>Country <select aria-label="Reporter country" value={values.country} onChange={(event) => set("country", event.target.value)}><option value="">Not provided</option><option>UNITED STATES</option><option>CANADA</option></select></label>
    </fieldset>
    <fieldset disabled={busy} className={`${styles.answerGroup} ${styles.reporterChoices}`}><legend>Professional details</legend>
      <label>Are you a health professional? <select aria-label="Health professional" value={String(healthProfessional)} onChange={(event) => setHealthProfessional(event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label>Occupation <select aria-label="Reporter occupation" value={values.occupation} onChange={(event) => set("occupation", event.target.value)}><option value="">Select occupation</option>{["Physician", "Nurse", "Nurse Practitioner", "Pharmacist", "Physician Assistant", "Other Health Professional", "Non-Health Professional"].map((value) => <option key={value}>{value}</option>)}</select></label>
    </fieldset>
    <fieldset disabled={busy} className={`${styles.answerGroup} ${styles.reporterChoices}`}><legend>Have you also reported this to anyone below?</legend><p>Select any that apply. Leave unchecked if none.</p>
      {[["manufacturer", "Manufacturer or compounder"], ["user-facility", "User facility"], ["distributor-importer", "Distributor or importer"], ["packer", "Packer"]] .map(([value, label]) => <label key={value}><input type="checkbox" checked={reportedTo.includes(value as typeof reportedTo[number])} onChange={(event) => setReportedTo(event.target.checked ? [...reportedTo, value as typeof reportedTo[number]] : reportedTo.filter((item) => item !== value))} /> {label}</label>)}
    </fieldset>
    <fieldset disabled={busy} className={`${styles.answerGroup} ${styles.privacyPanel}`}><legend>Your privacy</legend>
      <label><input type="checkbox" checked={doNotDiscloseIdentity} onChange={(event) => setDoNotDiscloseIdentity(event.target.checked)} /> Do not disclose my identity to the manufacturer</label>
    </fieldset>
    <p className={styles.hint}>This choice is recorded in the report. Wilson does not submit it or contact the manufacturer.</p>
    {missing.length > 0 && <p className={styles.requirementHint} role="status">Required before adding: {joinList(missing)}.</p>}
    <div className={styles.decisionActions}>
      <button disabled={busy || !canSave || !complete} onClick={() => void act({ action: "answer-reporter", reportDate: reportDate || null, reporter: {
        kind: "provided", firstName: values.firstName.trim(), lastName: values.lastName.trim(),
        phone: values.phone.trim() || undefined, email: values.email.trim() || undefined,
        address: values.address.trim() || undefined, city: values.city.trim() || undefined,
        state: values.state.trim() || undefined, postalCode: values.postalCode.trim() || undefined,
        country: values.country, occupation: values.occupation, healthProfessional, reportedTo, doNotDiscloseIdentity,
      } })}>{previouslySaved ? "Save reporter details" : "Add reporter details"}</button>
      <button disabled={busy || !canSave} onClick={() => void act({ action: "answer-reporter", reportDate: reportDate || null, reporter: { kind: "declined" } })}>Prefer not to provide reporter details</button>
    </div>
  </>;
}

function UpdateReview({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  const groups = groupAttention(snapshot.review.attention.filter(({ kind, groupId }) => kind !== "conflict" && !snapshot.openingGroups.includes(groupId ?? "")));
  return <>
    <p className={styles.eyebrow}>Review update</p>
    <h1 id="task-title">Review the proposed update</h1>
    <p>Review each proposed change before continuing. Earlier information stays unchanged until you accept a correction. An accepted incompatible alternative remains visibly unresolved and is omitted from the form.</p>
    {groups.map(({ groupId, items }) => <article className={styles.attentionCard} key={groupId}>
      <span className={styles.attentionLabel}>{items.some(({ kind }) => kind === "correction") ? "Proposed correction" : "Proposed information"}</span>
      {items.map((item) => <div key={item.target}>
        <h2>{targetLabel(snapshot, item.target)}</h2>
        <p><strong>{formatFact(item.values[0]?.value, controlForTarget(item.target))}</strong></p>
        <Evidence excerpt={item.values[0]?.evidence} expanded />
      </div>)}
      <div className={styles.decisionActions}>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "accept" })}>Accept this update</button>
        <button disabled={busy} onClick={() => void act({ action: "review-update-group", groupId, decision: "reject" })}>Reject this update</button>
      </div>
    </article>)}
  </>;
}

function OutputComposition({ snapshot, pdf, caseId, busy, generatePdf, navigate, hasDraft, reporterDirty }: {
  snapshot: JourneySnapshot; pdf?: PdfArtifact; caseId?: string; busy: boolean;
  generatePdf: () => Promise<void>; navigate: (screen: Screen) => void; hasDraft: boolean; reporterDirty: boolean;
}) {
  const artifact = pdf?.caseId === caseId ? pdf : undefined;
  const current = Boolean(artifact && artifact.contentKey === snapshot.reportContentKey && snapshot.downloadReady);
  return <>
    <p className={styles.eyebrow}>Review & save</p>
    <h1>Your FDA MedWatch report</h1>
    <p className={styles.lead}>Inspect the actual generated form, then save a copy. Wilson does not submit it.</p>
    {hasDraft && <p className={styles.notice}>You have an unsent clinical draft in Review details. It is not included in the PDF.</p>}
    {reporterDirty && <p className={styles.notice}>You have unsaved reporter details. The PDF contains the previously accepted reporter information until you save those changes.</p>}
    {snapshot.outputIssues.length > 0 && <section className={styles.invitation}><h2>The form needs more reviewed information</h2><ul>{snapshot.outputIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul><button onClick={() => navigate(snapshot.clarification?.kind === "reporter" ? "reporter" : "details")}>Continue completing the report</button></section>}
    <div className={styles.pdfToolbar}><div><h2>Form FDA 3500</h2><p role="status">{current ? "The PDF reflects the accepted report contents." : artifact ? "Earlier PDF — it does not include changes awaiting review or generation." : "Generate the PDF after completing review and reporter details."}</p></div>
      {current ? <a className={styles.primaryLink} href={artifact!.url} download={artifact!.filename}>Save PDF</a> : <button disabled={busy || !snapshot.downloadReady} onClick={() => void generatePdf()}>{artifact ? "Generate updated PDF" : "Generate PDF"}</button>}
    </div>
    {artifact && <><iframe className={styles.pdfFrame} src={artifact.url} title={current ? "Generated Form FDA 3500" : "Earlier generated Form FDA 3500"} /><p><a href={artifact.url} target="_blank" rel="noreferrer">Open {current ? "PDF" : "earlier PDF"} in a separate tab</a></p></>}
    <details className={styles.reportDescription}><summary>Report event description</summary><p>{snapshot.projection.sections.B.eventDescription ?? "No accepted description yet."}</p><p className={styles.hint}>This is the wording generated from currently accepted information{current ? " and included in the PDF" : "; an earlier PDF may contain earlier wording"}.</p></details>
    <details><summary>Report coverage and omitted information</summary><p>This preview supports a limited set of Form FDA 3500 fields.</p><ul>{snapshot.projection.omissions.filter(({ reason }) => reason !== "empty").map((item, index) => <li key={index}>{humanOmission(snapshot, item.target, item.concept)}: {omissionLabel(item.reason)}</li>)}{snapshot.projection.notIncluded.map((item) => <li key={item}>{item}</li>)}</ul></details>
    <div className={styles.screenActions}><button onClick={() => navigate("details")}>Edit case details</button><button onClick={() => navigate("reporter")}>Edit reporter details</button></div>
  </>;
}

function ConflictCard({ snapshot, item, busy, act }: {
  snapshot: JourneySnapshot; item: ReviewAttentionItem; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  return <fieldset className={styles.conflictChoice}>
    <legend>{targetLabel(snapshot, item.target)}</legend>
    {item.values.map((value) => <div className={styles.conflictOption} key={value.id}>
      <strong>{formatFact(value.value, controlForTarget(item.target))}</strong>
      <Evidence excerpt={value.evidence} expanded />
      <button disabled={busy} onClick={() => void act({ action: "resolve-conflict", target: item.target, chosenValueId: value.id })}>Use {formatFact(value.value, controlForTarget(item.target))}</button>
    </div>)}
    <p className={styles.hint}>You may leave this unresolved. Neither alternative will be put in the form.</p>
  </fieldset>;
}

function CaseCards({ snapshot, busy, act }: {
  snapshot: JourneySnapshot; busy: boolean; act: (action: JourneyAction) => Promise<boolean>;
}) {
  const understanding = snapshot.understanding;
  const openingReview = snapshot.stage === "understanding";
  const directEdit = snapshot.stage === "clarify" || snapshot.stage === "output";
  const entityWithdrawal = snapshot.stage === "output";
  if (snapshot.revision === 0) return <p className={styles.emptyCase}>Proposed case knowledge will appear here after Wilson reads the account.</p>;
  return <div className={styles.cards}>
    <CaseCard domId="case-card-patient" title="Patient" entity="patient" entityId="patient" entityState="resolved" groupId="patient" facts={understanding.patient} fields={["identifier", "ageYears", "sex", "weight"]} allowOpeningReview={openingReview && snapshot.openingGroups.includes("patient")} allowDirectEdit={directEdit} busy={busy} act={act} />
    <CaseCard domId="case-card-event" title="Event" entity="event" entityId="event" entityState="resolved" groupId="event" facts={understanding.event} fields={["reportType", "reportDate", "problemDescription", "symptoms", "onsetDate", "death", "deathDate", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious", "relevantTestsAvailable", "treatments", "outcome", "dischargeDate", "productAvailability", "productReturnDate", "relevantHistory"]} allowOpeningReview={openingReview && snapshot.openingGroups.includes("event")} allowDirectEdit={directEdit} busy={busy} act={act} />
    {understanding.relevantTests.map((test, index) => <CaseCard domId={`case-card-test-${index + 1}`} key={test.id} title={`Relevant test ${index + 1}`} eyebrow="Test or laboratory result" entity="test" entityId={test.id} entityState={test.state} groupId={test.proposalGroupId} facts={test.facts} fields={["testName", "testResult", "lowRange", "highRange", "date"]} allowOpeningReview={openingReview && test.state === "proposed"} allowDirectEdit={directEdit && test.state === "resolved"} allowRemove={openingReview && test.state === "proposed"} allowWithdraw={entityWithdrawal && test.state === "resolved"} busy={busy} act={act} />)}
    {understanding.products.map((product) => {
      const name = productViewLabel(product);
      const role = knownString(activeValue(product.facts.role));
      const productType = knownString(activeValue(product.facts.productType));
      const fields = productCardFields(productType, product.facts);
      return <div key={product.id}>{product.medicationNotice && <p role="status">{product.medicationNotice}</p>}<CaseCard domId={`case-card-product-${product.ordinal}`} key={product.id} title={name} eyebrow={product.state === "withdrawn" ? "Withdrawn product" : productType === "device" ? role === "concomitant" ? "Unsupported concomitant medical device" : "Suspect medical device" : role === "suspect" ? "Suspect product" : role === "concomitant" ? "Other product" : "Product awaiting classification"} entity="product" entityId={product.id} entityState={product.state} groupId={product.proposalGroupId} facts={product.facts} fields={fields} allowOpeningReview={openingReview && product.state === "proposed"} allowDirectEdit={directEdit && product.state === "resolved"} allowRemove={openingReview && product.state === "proposed"} allowWithdraw={entityWithdrawal && product.state === "resolved"} busy={busy} act={act} /></div>;
    })}

  </div>;
}

type EditableCaseValue = Extract<JourneyAction, { action: "set-fact" }>["value"];

function CaseCard({ domId, title, eyebrow, entity, entityId, entityState, groupId, facts, fields, evidenceFields = [], allowOpeningReview, allowDirectEdit, allowRemove = false, allowWithdraw = false, busy, act }: {
  domId?: string;
  title: string;
  eyebrow?: string;
  entity: "patient" | "event" | "product" | "test" | "reporter";
  entityId: string;
  entityState: "proposed" | "resolved" | "rejected" | "withdrawn";
  groupId: string;
  facts: Record<string, FactView>;
  fields: string[];
  evidenceFields?: string[];
  allowOpeningReview: boolean;
  allowDirectEdit: boolean;
  allowRemove?: boolean;
  allowWithdraw?: boolean;
  busy: boolean;
  act: (action: JourneyAction) => Promise<boolean>;
}) {
  const [showMore, setShowMore] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, EditableCaseValue>>({});
  const previousFacts = useRef(facts);
  useEffect(() => {
    const changed = Object.keys(facts).filter((field) => JSON.stringify([facts[field].resolved, facts[field].history, facts[field].conflicts]) !== JSON.stringify([previousFacts.current[field]?.resolved, previousFacts.current[field]?.history, previousFacts.current[field]?.conflicts]));
    previousFacts.current = facts;
    if (changed.length === 0) return;
    const invalid = new Set(changed);
    if (entity === "product" && changed.some((field) => ["name", "productType", "role", "stopped", "doseReduced", "restarted"].includes(field))) {
      for (const field of ["stopped", "doseReduced", "stopDate", "improvedAfterChange", "restarted", "recurred"]) invalid.add(field);
    }
    if (entity === "product" && changed.some((field) => ["productType", "role", "implanted", "reprocessedSingleUse"].includes(field))) {
      for (const field of ["implantDate", "explantDate", "reprocessor"]) invalid.add(field);
    }
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !invalid.has(field))));
    setEditing((current) => current && invalid.has(current) ? undefined : current);
  }, [facts, entity]);
  const evidence = [...new Set([...fields, ...evidenceFields].flatMap((field) => facts[field]?.evidence ?? []))];
  const outcomeFields = ["death", "lifeThreatening", "hospitalized", "disability", "requiredIntervention", "congenitalAnomaly", "otherSerious"];
  const groupedOutcomes = entity === "event" && outcomeFields.every((field) => {
    const fact = facts[field];
    const value = activeValue(fact);
    return value?.kind === "known" && typeof value.value === "boolean" && fact.conflicts.length === 0 && fact.history.length === 0;
  });
  const groupCorrections = Object.entries(drafts).flatMap(([field, value]) => {
    const proposal = facts[field]?.proposals.find(({ groupId: proposalGroup }) => proposalGroup === groupId);
    return proposal ? [{ proposalId: proposal.id, value }] : [];
  });
  return <article id={domId} className={styles.caseCard}>
    <div className={styles.cardTitle}>
      <div>{eyebrow && <span>{eyebrow}</span>}<h3>{title}</h3></div>
      <div className={styles.cardActions}>
        {allowRemove && <button disabled={busy} onClick={() => void act({ action: "reject-group", groupId })}>Remove {title}</button>}
        {allowWithdraw && <button disabled={busy} onClick={() => void act({ action: "withdraw-entity", entity: entity as "product" | "test", entityId })}>Withdraw {title}</button>}
      </div>
    </div>
    {fields.every((field) => !activeValue(facts[field]) && !facts[field]?.history.length && !facts[field]?.conflicts.length) && <p className={styles.hint}>No details were captured for this group. It can be left blank.</p>}
    {entityState === "withdrawn" && <p className={styles.withdrawn}>Withdrawn from the active report; reviewed facts and source history are retained below.</p>}
    {entity === "test" && entityState !== "withdrawn" && !knownString(activeValue(facts.testName)) && <p role="status">Test identity is not recorded as known. Check the source wording. You can supply its name in Clinical update or leave it unknown for a partial report.</p>}
    <dl>{groupedOutcomes && !showMore && <div>
      <dt>Serious outcomes</dt>
      <dd>{outcomeFields.filter((field) => (activeValue(facts[field]) as { value: boolean }).value).map((field) => factControl("event", field)!.label).join(", ") || "None reported"}{outcomeFields.some((field) => facts[field].proposals.length > 0) && <span className={styles.proposed}>Proposed</span>}</dd>
      <button className={styles.inlineAction} onClick={() => setShowMore(true)}>Review outcomes</button>
    </div>}{fields.map((field) => {
      const fact = facts[field];
      if (!fact || (groupedOutcomes && !showMore && outcomeFields.includes(field))) return null;
      const value = activeValue(fact);
      if (!showMore && !value && fact.history.length === 0 && fact.conflicts.length === 0) return null;
      const proposal = fact.proposals.find(({ groupId: proposalGroup }) => proposalGroup === groupId);
      const editable = Boolean((allowOpeningReview && proposal) || allowDirectEdit);
      if (!value && fact.history.length === 0 && fact.conflicts.length === 0 && !editable && !(entity === "test" && (field === "testName" || field === "testResult"))) return null;
      const control = factControl(entity, field);
      if (!control) return null;
      const draft = drafts[field];
      return <div key={field}>
        <dt>{control.label}</dt>
        <dd>{fact.state === "conflicted" ? "Unresolved conflict" : formatFact(value, control)}{fact.state === "proposed" && <span className={styles.proposed}>Proposed</span>}</dd>
        {draft && editing !== field && <dd className={styles.hint}>Unsaved edit: {formatFact(draft, control)}</dd>}
        {fact.history.map((history, index) => <dd key={index} className={styles.history}>Earlier: {formatFact(history.value, control)}</dd>)}
        {editable && editing !== field && fact.state !== "conflicted" && <button className={styles.inlineAction} disabled={busy} onClick={() => {
          setEditing(field);
          setDrafts((current) => ({ ...current, [field]: editableInitialValue(value, control) }));
        }}>{value ? "Change" : "Add"}</button>}
        {editable && editing === field && draft && <div className={styles.inlineEdit}>
          {control.help && <p>{control.help}</p>}
          <FactValueEditor label={control.label} control={control} value={draft} onChange={(next) => setDrafts((current) => ({ ...current, [field]: next }))} />
          <button disabled={busy || !validEditableValue(draft, control)} onClick={async () => {
            if (allowOpeningReview && proposal) {
              setEditing(undefined);
              return;
            }
            if (!await act({ action: "set-fact", target: `${entity}:${entityId}:${field}`, value: draft })) return;
            setEditing(undefined);
            setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)));
          }}>{allowOpeningReview && proposal ? "Keep draft" : value ? "Apply correction" : "Add fact"}</button>
        </div>}
      </div>;
    })}</dl>
    {allowDirectEdit && <button className={styles.inlineAction} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>{showMore ? "Show fewer fields" : "Show more fields"}</button>}
    {allowOpeningReview && <button className={styles.groupReview} disabled={busy || Object.entries(drafts).some(([field, value]) => !validEditableValue(value, factControl(entity, field)!))} onClick={() => void act({ action: "review-opening-group", groupId, corrections: groupCorrections })}>
      Accept {title}{groupCorrections.length > 0 ? ` with ${groupCorrections.length} ${groupCorrections.length === 1 ? "change" : "changes"}` : ""}
    </button>}
    {allowOpeningReview && !allowRemove && <button disabled={busy} onClick={() => void act({ action: "reject-group", groupId })}>Reject {title}</button>}
    {evidence.length > 0 && <Evidence excerpt={evidence} />}
  </article>;
}

function FactValueEditor({ label, control, value, onChange }: { label: string; control: FactControl; value: EditableCaseValue; onChange: (value: EditableCaseValue) => void }) {
  const known = value.kind === "known" ? value.value : undefined;
  return <div className={styles.factEditor}>
    <label>{label} status<select aria-label={`${label} status`} value={value.kind} onChange={(event) => onChange(event.target.value === "known" ? editableInitialValue(undefined, control) : { kind: event.target.value as Exclude<EditableCaseValue["kind"], "known"> })}>
      <option value="known">Known</option><option value="unknown">Unknown</option><option value="explicitly-absent">Not present</option><option value="inapplicable">Not applicable</option><option value="declined">Prefer not to answer</option>
    </select></label>
    {value.kind === "known" && control.shape === "text" && <input aria-label={`New ${label}`} value={String(known ?? "")} onChange={(event) => onChange({ kind: "known", value: event.target.value })} />}
    {value.kind === "known" && control.shape === "age" && <input aria-label={`New ${label}`} type="number" min="0" max="150" value={String(known ?? "")} onChange={(event) => onChange({ kind: "known", value: Number(event.target.value) })} />}
    {value.kind === "known" && control.shape === "date" && <input aria-label={`New ${label}`} type="date" value={String(known ?? "")} onChange={(event) => onChange({ kind: "known", value: event.target.value })} />}
    {value.kind === "known" && control.shape === "boolean" && <select aria-label={`New ${label}`} value={String(known)} onChange={(event) => onChange({ kind: "known", value: event.target.value === "true" })}><option value="true">Yes</option><option value="false">No</option></select>}
    {value.kind === "known" && control.shape === "list" && <textarea aria-label={`New ${label}`} rows={3} value={Array.isArray(known) ? known.join("\n") : ""} onChange={(event) => onChange({ kind: "known", value: splitList(event.target.value) })} />}
    {value.kind === "known" && control.shape === "weight" && <div className={styles.measurement}>
      <input aria-label={`New ${label}`} type="number" min="0.1" step="0.1" value={typeof known === "object" && known && "value" in known ? String(known.value) : ""} onChange={(event) => onChange({ kind: "known", value: { value: Number(event.target.value), unit: typeof known === "object" && known && "unit" in known && known.unit === "lb" ? "lb" : "kg" } })} />
      <select aria-label={`${label} unit`} value={typeof known === "object" && known && "unit" in known ? String(known.unit) : "kg"} onChange={(event) => onChange({ kind: "known", value: { value: typeof known === "object" && known && "value" in known ? Number(known.value) : 0, unit: event.target.value as "kg" | "lb" } })}><option value="kg">kg</option><option value="lb">lb</option></select>
    </div>}
    {value.kind === "known" && control.shape === "choice" && <select aria-label={`New ${label}`} value={String(known ?? "")} onChange={(event) => onChange({ kind: "known", value: event.target.value })}>{control.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
    {value.kind === "known" && control.shape === "choices" && <fieldset><legend>New {label}</legend>{control.options?.map((option) => <label key={option.value}><input type="checkbox" checked={Array.isArray(known) && known.includes(option.value)} onChange={(event) => onChange({ kind: "known", value: event.target.checked ? [...(Array.isArray(known) ? known : []), option.value] : (Array.isArray(known) ? known : []).filter((item) => item !== option.value) })} /> {option.label}</label>)}</fieldset>}
  </div>;
}

function editableInitialValue(value: CaseValue<unknown> | undefined, control: FactControl): EditableCaseValue {
  if (value) return value as EditableCaseValue;
  if (control.shape === "age") return { kind: "known", value: 0 };
  if (control.shape === "boolean") return { kind: "known", value: false };
  if (control.shape === "list" || control.shape === "choices") return { kind: "known", value: [] };
  if (control.shape === "weight") return { kind: "known", value: { value: 0, unit: "kg" } };
  if (control.shape === "choice") return { kind: "known", value: control.options?.[0]?.value ?? "" };
  return { kind: "known", value: "" };
}

function validEditableValue(value: EditableCaseValue, control: FactControl): boolean {
  if (value.kind !== "known") return true;
  if (control.shape === "text" || control.shape === "date" || control.shape === "choice") return typeof value.value === "string" && Boolean(value.value.trim());
  if (control.shape === "age") return typeof value.value === "number" && Number.isInteger(value.value) && value.value >= 0 && value.value <= 150;
  if (control.shape === "weight") return typeof value.value === "object" && !Array.isArray(value.value) && value.value.value > 0;
  if (control.shape === "list") return Array.isArray(value.value) && value.value.length > 0;
  return true;
}

function splitList(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function groupAttention(items: ReviewAttentionItem[]) {
  const groups = new Map<string, ReviewAttentionItem[]>();
  for (const item of items) {
    if (!item.groupId) continue;
    groups.set(item.groupId, [...(groups.get(item.groupId) ?? []), item]);
  }
  return [...groups].map(([groupId, grouped]) => ({ groupId, items: grouped }));
}

function activeValue(fact: FactView | undefined): CaseValue<unknown> | undefined {
  return fact?.resolved ?? fact?.proposals[0]?.value;
}

function knownString(value: CaseValue<unknown> | undefined): string | undefined {
  return value?.kind === "known" && typeof value.value === "string" ? value.value : undefined;
}

function productViewLabel(product: ProductView): string {
  return productDisplayLabel(knownString(activeValue(product.facts.name)), product.ordinal);
}


function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "the required details";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatFact(value: CaseValue<unknown> | undefined, control?: FactControl): string {
  if (!value) return "Not provided";
  if (value.kind !== "known") return {
    unknown: "Unknown",
    "explicitly-absent": "Not present",
    inapplicable: "Not applicable",
    declined: "Prefer not to answer",
  }[value.kind];
  if (Array.isArray(value.value)) return value.value
    .map((item) => control?.options?.find((option) => option.value === item)?.label ?? item)
    .join(" and ");
  if (typeof value.value === "object" && value.value && "unit" in value.value) {
    const measured = value.value as Record<string, unknown>;
    return `${String(measured.value)} ${String(measured.unit)}`;
  }
  if (typeof value.value === "boolean") return value.value ? "Yes" : "No";
  if (typeof value.value === "string") {
    const label = control?.options?.find((option) => option.value === value.value)?.label ?? knownOptionLabel(value.value);
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

function fieldLabel(entity: string, field?: string): string {
  if (!field) return humanizeIdentifier(entity);
  return factControl(entity as FactControlEntity, field)?.label ?? humanizeIdentifier(field);
}

function unrepresentedTargetLabel(entity: string, field: string): string {
  const entityLabel = { patient: "Patient", event: "Event", product: "Product", test: "Relevant test" }[entity]
    ?? "Case detail";
  return `${entityLabel} — ${fieldLabel(entity, field)}`;
}

function unrepresentedReason(reason: JourneySnapshot["unrepresented"][number]["reason"]): string {
  return {
    "unsupported-proposal": "The suggestion did not use Wilson’s supported proposal format.",
    "unsupported-target": "Wilson does not support that case field in this path.",
    "invalid-source-reference": "Wilson could not identify the supporting text. Restate this detail in Clinical update.",
    "test-limit": "This preview supports up to eight relevant tests.",
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
    return `Relevant test ${index + 1} — ${fieldLabel("test", field)}`;
  }
  if (entity !== "product") return field ? fieldLabel(entity, field) : target;
  const product = snapshot.understanding.products.find(({ id }) => id === entityId);
  return `${product ? productViewLabel(product) : "Selected product"} — ${fieldLabel("product", field)}`;
}

function controlForTarget(target: string): FactControl | undefined {
  const [entity, , field] = target.split(":");
  if (!field || !["patient", "event", "product", "test", "reporter"].includes(entity)) return undefined;
  return factControl(entity as "patient" | "event" | "product" | "test" | "reporter", field);
}

function omissionLabel(reason: string): string {
  return {
    empty: "not provided",
    unknown: "unknown",
    "explicitly-absent": "not present",
    inapplicable: "not applicable",
    declined: "prefer not to answer",
    conflicted: "unresolved conflict",
  }[reason] ?? reason.replaceAll("-", " ");
}


export function humanOmission(snapshot: JourneySnapshot, target: string, fallback: string): string {
  const [entity, , field] = target.split(":");
  if (target === "event:event:relevantTestsAvailable") return "Relevant tests";
  if (entity !== "product") return field ? fieldLabel(entity, field) : fallback;
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
