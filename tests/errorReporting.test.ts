import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessage, reportError, reportLocation } from "@/lib/errorReporting";
import { shouldIgnore } from "@/lib/client/reportError";
import { ApiClientError } from "@/lib/client/api";

describe("Error Reporting payload (SPEC §25.4)", () => {
  it("sends the V8 stack as the message so Error Reporting can group it", () => {
    const err = new TypeError("x is undefined");
    const msg = errorMessage(err);
    expect(msg.startsWith("TypeError: x is undefined\n    at ")).toBe(true);
  });
  it("wraps non-Error values", () => {
    expect(errorMessage("boom")).toBe("Error: boom");
    expect(errorMessage({ code: 1 })).toBe('Error: {"code":1}');
  });
  it("extracts the first frame for reportLocation (V8 and Firefox/Safari)", () => {
    expect(reportLocation("Error: a\n    at runJob (/var/task/.next/server/chunks/12.js:40:7)\n    at next (x.js:1:1)")).toEqual({ filePath: "/var/task/.next/server/chunks/12.js", lineNumber: 40, functionName: "runJob" });
    expect(reportLocation("Error: a\n    at /var/task/a.js:3:9")).toEqual({ filePath: "/var/task/a.js", lineNumber: 3, functionName: "<anonymous>" });
    expect(reportLocation("Error: a\nrender@https://veyraflow.eu/_next/static/chunks/app.js:1:2345")).toEqual({ filePath: "https://veyraflow.eu/_next/static/chunks/app.js", lineNumber: 1, functionName: "render" });
    expect(reportLocation("Error: boom", "pipeline audio_sfx")).toEqual({ filePath: "pipeline audio_sfx", lineNumber: 0, functionName: "pipeline audio_sfx" });
  });
});

describe("reportError (SPEC §25.4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("is a no-op without GCP_PROJECT_ID / GCP_ERROR_REPORTING_API_KEY", async () => {
    vi.stubEnv("GCP_PROJECT_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await reportError(new Error("x"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("posts a ReportedErrorEvent with a sanitized request URL", async () => {
    vi.stubEnv("GCP_PROJECT_ID", "veyraflow-prod");
    vi.stubEnv("GCP_ERROR_REPORTING_API_KEY", "AIza-test");
    vi.stubEnv("APP_URL", "https://veyraflow.eu");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234567");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await reportError(new Error("db down"), { where: "api POST /api/jobs", userId: "u-1", httpRequest: { method: "POST", url: "/s/Qm9vLXNoYXJlLXRva2VuLXRoYXQtaXMtNDMtY2hhcnMtbG9uZw?email=a%40b.co", responseStatusCode: 500 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://clouderrorreporting.googleapis.com/v1beta1/projects/veyraflow-prod/events:report?key=AIza-test");
    const body = JSON.parse(init.body);
    expect(body.serviceContext).toEqual({ service: "veyraflow-server", version: "production-abcdef1" });
    expect(body.message.startsWith("Error: db down\n    at ")).toBe(true);
    expect(body.context.user).toBe("u-1");
    expect(body.context.httpRequest).toEqual({ method: "POST", url: "https://veyraflow.eu/s/[id]", responseStatusCode: 500 });
    expect(body.context.reportLocation.lineNumber).toBeGreaterThan(0);
  });
  it("never throws when Google is unreachable", async () => {
    vi.stubEnv("GCP_PROJECT_ID", "p");
    vi.stubEnv("GCP_ERROR_REPORTING_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(reportError(new Error("x"))).resolves.toBeUndefined();
  });
});

describe("browser error filter (SPEC §25.4)", () => {
  it("ignores noise", () => {
    expect(shouldIgnore("Script error.")).toBe(true);
    expect(shouldIgnore(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(shouldIgnore(new Error("ResizeObserver loop completed with undelivered notifications."))).toBe(true);
    expect(shouldIgnore(new Error("x"), "chrome-extension://abc/content.js")).toBe(true);
    expect(shouldIgnore(new ApiClientError("unauthorized", "Please sign in", 401))).toBe(true);
  });
  it("keeps real bugs and 5xx API errors", () => {
    expect(shouldIgnore(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(shouldIgnore(new ApiClientError("internal_error", "Something went wrong", 500))).toBe(false);
  });
});
