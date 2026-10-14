export class DraftDecodeError extends Error {
  constructor(readonly code: "incompatible" | "corrupt", message: string) {
    super(message); this.name = "DraftDecodeError";
  }
}
