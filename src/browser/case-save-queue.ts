import type { ActiveCaseInput, ActiveCaseRecord } from "./active-case-store";

export interface CaseWriter {
  save(input: ActiveCaseInput, generation: string | null): Promise<ActiveCaseRecord>;
  replace(input: ActiveCaseInput, generation: string | null): Promise<ActiveCaseRecord>;
}
export interface SaveStatus {
  kind: "saved" | "saving" | "error";
  savedAt: string | null;
  error?: unknown;
}
/** Coalesce only pending snapshots, never an in-flight atomic transaction. An
 * acknowledgement covers exactly its snapshot; later typing stays unsaved. */
export class CaseSaveQueue {
  private desired?: { sequence: number; input: ActiveCaseInput; replace: boolean };
  private sequence = 0;
  private committed = 0;
  private running = false;
  private inFlight: Promise<void> = Promise.resolve();
  private failed = false;
  private disposed = false;
  private committedInput: string | undefined;
  private status: SaveStatus;
  constructor(private readonly writer: CaseWriter, private generation: string | null,
    savedAt: string | null, private readonly notify: (status: SaveStatus) => void) {
    this.status = { kind: "saved", savedAt };
  }
  enqueue(input: ActiveCaseInput, replace = false): void {
    if (this.disposed) return;
    const previous = this.desired;
    this.desired = { sequence: ++this.sequence, input: structuredClone(input),
      replace: replace || Boolean(previous?.replace && previous.input.state.case.id === input.state.case.id) };
    this.emit(this.failed ? { ...this.status, kind: "error" } : { kind: "saving", savedAt: this.status.savedAt });
    this.start();
  }
  retry(): void {
    if (this.disposed || !this.desired) return;
    this.failed = false;
    this.emit({ kind: "saving", savedAt: this.status.savedAt });
    this.start();
  }
  dispose(): Promise<void> { this.disposed = true; return this.inFlight; }
  isSaved(input: ActiveCaseInput): boolean { return this.committedInput === JSON.stringify(input); }
  get unsaved(): boolean { return this.sequence !== this.committed; }
  private emit(status: SaveStatus) { this.status = status; if (!this.disposed) this.notify(status); }
  private start() { if (!this.running && !this.failed && !this.disposed) this.inFlight = this.pump(); }
  private async pump(): Promise<void> {
    if (this.running || this.failed || this.disposed) return;
    this.running = true;
    try {
      while (!this.disposed && this.desired && this.desired.sequence > this.committed) {
        const attempt = this.desired;
        try {
          const record = await (attempt.replace ? this.writer.replace(attempt.input, this.generation) : this.writer.save(attempt.input, this.generation));
          this.generation = record.generation;
          this.committed = attempt.sequence;
          this.committedInput = JSON.stringify(attempt.input);
          this.emit({ kind: this.unsaved ? "saving" : "saved", savedAt: record.savedAt });
        } catch (error) {
          this.failed = true;
          this.emit({ kind: "error", savedAt: this.status.savedAt, error });
          break;
        }
      }
    } finally { this.running = false; }
  }
}
