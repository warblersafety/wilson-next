import { assertCaseInvariants, cloneCase, freezeCase } from "../../domain/case/internal";
import type { SemanticCase } from "../../domain/case/types";

export interface CaseRepository {
  create(caseState: SemanticCase): Promise<void>;
  load(caseId: string): Promise<SemanticCase | undefined>;
  save(caseState: SemanticCase, expectedRevision: number): Promise<void>;
}

export class RepositoryRevisionError extends Error {}
export class RepositoryCapacityError extends Error {}

interface StoredCase {
  caseState: SemanticCase;
  touchedAt: number;
}

export interface InMemoryCaseRepositoryOptions {
  idleTtlMs?: number;
  maxCases?: number;
  now?: () => number;
}

export class InMemoryCaseRepository implements CaseRepository {
  readonly #entries = new Map<string, StoredCase>();
  readonly #idleTtlMs: number;
  readonly #maxCases: number;
  readonly #now: () => number;

  constructor(options: InMemoryCaseRepositoryOptions = {}) {
    this.#idleTtlMs = options.idleTtlMs ?? 8 * 60 * 60 * 1_000;
    this.#maxCases = options.maxCases ?? 32;
    this.#now = options.now ?? Date.now;
  }

  async create(caseState: SemanticCase): Promise<void> {
    this.#prune();
    if (this.#entries.has(caseState.id)) throw new Error(`Case ${caseState.id} already exists`);
    if (this.#entries.size >= this.#maxCases) throw new RepositoryCapacityError("Temporary case capacity reached");
    if (caseState.revision !== 0 || caseState.changes.length !== 0) {
      throw new Error("A new temporary case must begin at revision zero");
    }
    assertCaseInvariants(caseState);
    this.#entries.set(caseState.id, { caseState: freezeCase(cloneCase(caseState)), touchedAt: this.#now() });
  }

  async load(caseId: string): Promise<SemanticCase | undefined> {
    this.#prune();
    const stored = this.#entries.get(caseId);
    if (!stored) return undefined;
    stored.touchedAt = this.#now();
    return freezeCase(cloneCase(stored.caseState));
  }

  async save(caseState: SemanticCase, expectedRevision: number): Promise<void> {
    this.#prune();
    const stored = this.#entries.get(caseState.id);
    if (!stored) throw new Error(`Case ${caseState.id} does not exist`);
    if (stored.caseState.revision !== expectedRevision) {
      throw new RepositoryRevisionError(
        `Expected stored revision ${expectedRevision}, received ${stored.caseState.revision}`,
      );
    }
    const lastChange = caseState.changes.at(-1);
    if (caseState.revision !== expectedRevision + 1
      || caseState.changes.length !== stored.caseState.changes.length + 1
      || lastChange?.priorRevision !== expectedRevision
      || lastChange.resultingRevision !== caseState.revision) {
      throw new RepositoryRevisionError("A save must contain exactly one complete command revision");
    }
    assertCaseInvariants(caseState);
    this.#entries.set(caseState.id, { caseState: freezeCase(cloneCase(caseState)), touchedAt: this.#now() });
  }

  #prune(): void {
    const expiresBefore = this.#now() - this.#idleTtlMs;
    for (const [id, stored] of this.#entries) {
      if (stored.touchedAt <= expiresBefore) this.#entries.delete(id);
    }
  }
}
