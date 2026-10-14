import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JourneyRequestError, requestJourneyJson, requestJourneyPdf } from "../../app/browser-diagnostics";
import type { BrowserJourneyState } from "../../src/server/case/browser-state";

const state = { fictional: true } as unknown as BrowserJourneyState;
let diagnosticRequests: RequestInit[];
beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal("window", { sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  diagnosticRequests = [];
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function transport(response: () => Promise<Response>, diagnostics: "held" | "reject" | "throw" = "held") {
  return vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    if (url !== "/api/diagnostics/browser") return response();
    diagnosticRequests.push(init);
    if (diagnostics === "throw") throw new Error("Synthetic synchronous logging failure");
    return diagnostics === "reject" ? Promise.reject(new Error("Synthetic offline logger")) : new Promise<Response>(() => {});
  }));
}

describe("non-blocking best-effort browser diagnostics", () => {
  for (const diagnostics of ["held", "reject", "throw"] as const) {
    it(`dispatches and returns a successful case response with ${diagnostics} telemetry`, async () => {
      transport(async () => Response.json({ retained: true }), diagnostics);
      await expect(requestJourneyJson({ method: "POST", body: { state, action: { action: "submit-opening", text: "Fictional unlogged narrative" } } }, "Failed")).resolves.toEqual({ retained: true });
      expect(diagnosticRequests).toHaveLength(2);
      const [start, completed] = diagnosticRequests.map(request => JSON.parse(String(request.body)));
      expect(start.event.request.body.state).toBe("[BROWSER STATE NOT LOGGED]");
      expect(start.event.request.body.action.text).toBe("[CLINICIAN TEXT NOT LOGGED IN BROWSER TRACE]");
      expect(start.trace).toHaveLength(1);
      expect(completed.trace).toHaveLength(2);
      expect(completed.trace[0]).toEqual(start.event);
      expect(diagnosticRequests[0].headers).toEqual(diagnosticRequests[1].headers);
    }, 2_000);
    it(`preserves case errors and diagnostic references with ${diagnostics} telemetry`, async () => {
      transport(async () => Response.json({ error: "Synthetic rejection", code: "rejected", diagnosticReference: "fictional-reference" }, { status: 422 }), diagnostics);
      await expect(requestJourneyJson({}, "Fallback")).rejects.toMatchObject({ message: "Synthetic rejection", code: "rejected", diagnosticReference: "fictional-reference", status: 422 });
    }, 2_000);
    it(`returns PDF bytes/filename and preserves PDF errors with ${diagnostics} telemetry`, async () => {
      transport(async () => new Response("fictional PDF bytes", { headers: { "Content-Disposition": 'attachment; filename="fictional.pdf"' } }), diagnostics);
      const result = await requestJourneyPdf(state, "preview");
      expect(result.filename).toBe("fictional.pdf");
      expect(await result.blob.text()).toBe("fictional PDF bytes");
      transport(async () => Response.json({ error: "Synthetic PDF rejection" }, { status: 422 }), diagnostics);
      await expect(requestJourneyPdf(state, "download")).rejects.toMatchObject({ message: "Synthetic PDF rejection", status: 422 });
    }, 2_000);
  }
  it("aborts held diagnostic fetches at the resource deadline without delaying the useful response", async () => {
    transport(async () => Response.json({ accepted: true }));
    await expect(requestJourneyJson({}, "Failed")).resolves.toEqual({ accepted: true });
    expect(diagnosticRequests.every(request => !request.signal?.aborted)).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(diagnosticRequests.every(request => request.signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  }, 2_000);
  it("retains transport and malformed-response errors while diagnostics are held", async () => {
    transport(async () => { throw new Error("Synthetic transport failure"); });
    await expect(requestJourneyJson({}, "Useful fallback")).rejects.toBeInstanceOf(JourneyRequestError);
    transport(async () => new Response("not JSON", { status: 502 }));
    await expect(requestJourneyJson({}, "Useful fallback")).rejects.toMatchObject({ message: "Useful fallback (the response was not JSON)", status: 502 });
    expect(JSON.parse(String(diagnosticRequests.at(-1)?.body)).trace).toHaveLength(3);
  }, 2_000);
  it("cleans abort timers after successful diagnostic delivery", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url === "/api/diagnostics/browser" ? new Response(null, { status: 204 }) : Response.json({ accepted: true }))));
    await requestJourneyJson({}, "Failed");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  }, 2_000);
});
