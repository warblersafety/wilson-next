# Wilson Experiment 1 system diagrams

**Status:** Working visual companion to the approved architecture and browser
experiment; not implementation authorization  
**Scope:** The first production-shaped Wilson experiment only  
**Companions:**
[`ARCHITECTURE-PROPOSAL.md`](../product/ARCHITECTURE-PROPOSAL.md),
[`EXPERIMENT-1-PROPOSAL.md`](EXPERIMENT-1-PROPOSAL.md), and the
[`visual checkpoint`](visual-checkpoint/README.md)

These diagrams make the approved boundaries, data model, and major flows easier
to inspect. They do not expand the approved experiment. Solid paths describe
Experiment 1 behavior. Dotted paths identify a test substitution or an
explicitly excluded future possibility.

## Executive summary

Experiment 1 builds one small browser application around a semantic
adverse-event case. The case represents the clinician's knowledge rather than
the fields or widgets of a particular FDA PDF. The model may propose grounded
facts, but it cannot change the case directly or turn a proposal into resolved
knowledge. Every change passes through the command boundary, and resolving
model-proposed knowledge requires clinician review. Review screens,
clarification, and the Form 3500 output are regenerated from the same case
revision.

This is form-independent in a deliberately narrow sense: the domain model does
not contain PDF widget names, page coordinates, checkbox encodings, or a
particular Form 3500 revision. It is still an adverse-event reporting model,
not a general clinical ontology. Experiment 1 implements only the concepts and
fields required by its fixed synthetic journey.

## Experiment boundary

```mermaid
flowchart TB
    subgraph INCLUDED["Built for Experiment 1"]
        UI["Four approved screen compositions<br/>supporting one seven-state journey"]
        MODEL["Live model plus one predetermined<br/>automated-test substitution"]
        CASE["One temporary semantic case<br/>for the fixed synthetic scenario"]
        RULES["Stable products, evidence, review,<br/>one correction, and one conflict"]
        FORM["Supported Form 3500 projection<br/>and official PDF download"]
        LOCK["Shared preview lock<br/>for the deployed physician session"]

        UI --> MODEL
        UI --> CASE
        CASE --> RULES
        CASE --> FORM
        LOCK --> UI
    end

    subgraph EXCLUDED["Explicitly not built"]
        ACCOUNTS["User accounts or identity system"]
        DATABASE["Database or saved-case history"]
        ONTOLOGY["Generic medical ontology"]
        FULLFORM["Complete Form 3500 coverage"]
        ENGINE["Generic question or workflow engine"]
        OUTPUTS["Other report formats or integrations"]
        OPERATIONS["Production multi-user operations"]
    end
```

The shared preview lock is not product authentication. It is one shared
password and a signed browser cookie added for the protected preview. There are
no accounts, identities, roles, signup, or password recovery.

## Experiment 1 system architecture

```mermaid
flowchart LR
    CLINICIAN["Clinician"] <--> BROWSER["Wilson browser UI"]

    subgraph SERVER["One Wilson application on one Node server"]
        LOCK["Shared preview lock<br/>deployed preview only"]
        APP["Application commands<br/>and queries"]
        MODELPORT["Model interface"]
        LIVE["Live Claude"]
        SCRIPTED["Predetermined responses<br/>browser automation only"]
        VALIDATE["Schema, span, type,<br/>and entity validation"]
        COMMAND["applyCaseCommand<br/>only authoritative write path"]
        CASE["Semantic case<br/>current revision"]
        MEMORY["Temporary in-memory<br/>session repository"]
        VIEWS["Understanding, clarification,<br/>review, and output views"]
        PROJECTION["Semantic Form 3500<br/>projection"]
        FILLER["Versioned FDA PDF filler"]

        LOCK <--> APP
        APP --> MODELPORT
        MODELPORT <--> LIVE
        MODELPORT -. "test substitution" .-> SCRIPTED
        MODELPORT --> VALIDATE
        VALIDATE --> APP

        APP --> COMMAND
        COMMAND --> CASE
        CASE <--> MEMORY
        CASE --> VIEWS
        VIEWS --> APP
        CASE --> PROJECTION
        PROJECTION --> FILLER
    end

    BROWSER <--> LOCK
    FILLER --> PDF["Downloaded official<br/>Form FDA 3500 PDF"]
```

The browser may hold temporary interface state, but it does not own the case.
The model and PDF filler are replaceable boundaries inside one application,
not separate services.

## Bounded semantic data model

```mermaid
classDiagram
    direction LR

    class Case {
        id
        revision
    }

    class Patient {
        stableId
        selectedPatientFacts
    }

    class Event {
        stableId
        selectedEventFacts
    }

    class Product {
        stableId
        suspectOrConcomitantRole
        selectedProductFacts
    }

    class Fact~T~ {
        state
        proposedValues
        resolvedValue
        conflictingValues
        supersededValues
        sourceIds
    }

    class Source {
        sourceId
        inputId
        sourceType
        exactClinicianExcerpt
        actor
        recordedAt
    }

    class Change {
        commandId
        affectedFactIds
        priorRevision
        resultingRevision
        supersessionOrResolution
    }

    class AskedNeed {
        semanticNeed
        sourceOrAnswer
    }

    Case "1" --> "1" Patient
    Case "1" --> "1" Event
    Case "1" --> "many" Product
    Case "1" --> "many" Source
    Case "1" --> "many" Change
    Case "1" --> "few" AskedNeed
    Patient --> Fact
    Event --> Fact
    Product --> Fact
    Fact --> Source
    Change --> Fact
```

For Experiment 1, the selected facts cover only the fixed fixture: its patient,
event, two suspect products, one concomitant product, indications, correction,
and date conflict. `Fact<T>` supplies consistent proposed, resolved,
conflicted, unknown, absent, inapplicable, declined, and superseded behavior for
those typed fields. It is not a generic fact registry. `AskedNeed` supports the
one authored indication question, not a general question planner.

## Model and clinician authority

```mermaid
sequenceDiagram
    actor Clinician
    participant UI as Wilson browser UI
    participant Model as Model interface
    participant Check as Proposal validation
    participant Write as applyCaseCommand
    participant Case as Authoritative case

    Clinician->>UI: Submit account, answer, or correction
    UI->>Model: Request structured proposals
    Model-->>Check: Typed facts and exact source excerpts
    Check-->>Write: Attach valid proposals or reject malformed output
    Write->>Case: Record proposed facts and their sources
    Case-->>UI: Return a proposed case revision or visible failure

    Note over UI,Case: Proposed facts are not resolved knowledge

    UI-->>Clinician: Show proposed knowledge and evidence
    Clinician->>UI: Accept, correct, reject, or resolve
    UI->>Write: Send review command with expected revision
    Write->>Case: Enforce identity, history, and conflict rules
    Case-->>UI: Return a new revision and refreshed views

    Note over Model,Case: The model never writes directly to the case
```

The predetermined automated-test responses replace only the model call in this
sequence. Browser rendering, clinician review, commands, case changes,
projection, and PDF filling remain real application behavior.

## Fixed clinician journey

```mermaid
flowchart LR
    DESCRIBE["1. Describe<br/>Enter the natural account<br/>and run extraction"]
    CHECK["2. Check understanding<br/>Review five semantic groups"]
    CLARIFY["3. Clarify<br/>Answer one indication question"]
    CORRECT["4. Correct and review<br/>Correct naproxen dose;<br/>see the date conflict"]
    INSPECT["5. Inspect output<br/>Unresolved date is<br/>omitted and explained"]
    RESOLVE["6. Resolve conflict<br/>Choose 13-Aug;<br/>all views update"]
    DOWNLOAD["7. Download<br/>Official PDF"]

    DESCRIBE --> CHECK --> CLARIFY --> CORRECT --> INSPECT --> RESOLVE --> DOWNLOAD
    CHECK -. "edit account" .-> DESCRIBE
    INSPECT -. "correct knowledge" .-> CORRECT
    RESOLVE -. "reconsider decision" .-> CORRECT
```

These are stages of work, not a requirement for seven pages. Inspecting the
output before conflict resolution is deliberate: it demonstrates that Wilson
can omit an unresolved value and explain why instead of guessing.

## One case revision produces every view and the PDF

```mermaid
flowchart TB
    INPUTS["Clinician accounts, answers,<br/>corrections, and decisions"]
    CASE["Semantic adverse-event case<br/>revision N"]

    INPUTS --> CASE
    CASE --> UNDERSTANDING["Understanding view"]
    CASE --> REVIEW["Review view"]
    CASE --> NEED["Authored follow-up need"]
    CASE --> FORM["Semantic Form 3500 projection"]

    FORM --> INCLUDED["Included values"]
    FORM --> OMITTED["Omitted values<br/>with explanation"]
    FORM --> UNRESOLVED["Needs resolution"]
    INCLUDED --> MAP["Form-version-specific<br/>PDF widget mapping"]
    MAP --> PDF["Official FDA PDF"]

    UNRESOLVED --> DECISION["Clinician resolves conflict"]
    DECISION --> COMMAND["applyCaseCommand"]
    COMMAND --> NEXT["Semantic adverse-event case<br/>revision N+1"]
    NEXT --> UPDATED["Regenerate every view<br/>and the projection together"]

    CASE -. "replaceable projection seam;<br/>not Experiment 1 scope" .-> FUTURE["Possible future output"]
```

The semantic case knows adverse-event reporting concepts but not PDF widget
identifiers. The Form 3500 projection decides which supported concepts are
included, omitted, or unresolved. Only the final versioned filler knows the
official PDF's widget names and encodings.

## Approved implementation order after authorization

```mermaid
flowchart LR
    S0["Slice 0<br/>Prove the official FDA PDF<br/>can be filled correctly"]
    S1["Slice 1<br/>Build the minimal case model<br/>and authoritative write boundary"]
    S2["Slice 2<br/>Assemble the local browser journey<br/>with predetermined responses"]
    S3["Slice 3<br/>Connect live Claude<br/>and inspect a few samples"]
    S4["Slice 4<br/>Add the shared preview lock,<br/>deploy, and meet one physician"]

    S0 --> S1 --> S2 --> S3 --> S4
```

This order is approved in
[`DEPLOYMENT-PREFLIGHT.md`](DEPLOYMENT-PREFLIGHT.md), but implementation still
requires an explicit go-ahead after the remaining topics. In particular, the
shared preview lock is late deployment plumbing rather than an initial product
subsystem.

## Implementation divergence flow

```mermaid
flowchart TD
    DISCOVERY["Implementation does not fit<br/>the approved plan"]
    CONSEQUENCE{"Would continuing change user behavior,<br/>semantic truth, authority, scope, privacy,<br/>evidence, or a consequential commitment?"}
    DEFECT{"Is it an ordinary defect within<br/>the approved behavior?"}
    FIX["Fix the code and add<br/>focused recurrence evidence"]
    DISCRETION["Choose the simplest reversible<br/>implementation within the approved seam"]
    STOP["Stop the affected slice and<br/>preserve the smallest failing example"]
    CLASSIFY["Classify the owning product, interaction,<br/>architecture, experiment, or preflight premise"]
    NOTE["Record expected versus observed,<br/>options, impact, and recommendation"]
    RECONCILE["Update the owning artifact and obtain<br/>approval for the consequential change"]
    RESUME["Resume from the corrected decision"]

    DISCOVERY --> CONSEQUENCE
    CONSEQUENCE -- "No" --> DEFECT
    DEFECT -- "Yes" --> FIX
    DEFECT -- "No" --> DISCRETION
    CONSEQUENCE -- "Yes" --> STOP
    STOP --> CLASSIFY --> NOTE --> RECONCILE --> RESUME
```

This is the preflight's
[stop-and-reconcile rule](DEPLOYMENT-PREFLIGHT.md#stop-and-reconcile-rule).
It prevents an implementation workaround from silently becoming a product or
architecture decision without turning routine coding choices into governance.

## Minimum verification path

```mermaid
flowchart LR
    DOMAIN["Focused deterministic tests<br/>protect critical case rules"]
    BROWSER["One scripted browser journey<br/>proves UI, flow, and PDF"]
    MODEL["Up to four live-model samples<br/>inspect extraction quality"]
    DEPLOY["One deployed operator run<br/>checks the real environment"]
    PHYSICIAN["One physician session<br/>provides the highest-value feedback"]

    DOMAIN --> BROWSER --> MODEL --> DEPLOY --> PHYSICIAN
```

This is a short safety runway to physician feedback, not a comprehensive test
program or an eval platform.

## Visual design companion

The architecture and flow diagrams explain how Wilson behaves. The four
realistic mockups remain the bounded answer to what the first journey may look
like:

1. [`Describe`](visual-checkpoint/01-describe.png)
2. [`Check understanding`](visual-checkpoint/02-check-understanding.png)
3. [`Correct and resolve`](visual-checkpoint/03-correct-resolve.png)
4. [`Inspect output`](visual-checkpoint/04-inspect-output.png)

Those mockups are an approved visual hypothesis for the fixed journey, not a
complete design system or authority for unshown states.
