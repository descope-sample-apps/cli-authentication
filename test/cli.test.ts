import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const LIVE = false; // remove live-mode test functionality

// Hoisted SDK instance so it's available to vi.mock factory
const { sdkInstance } = vi.hoisted(() => {
    return {
        sdkInstance: {
            otp: {
                signUpOrIn: { email: vi.fn() },
                verify: { email: vi.fn() },
            },
            me: vi.fn(),
            validateSession: vi.fn(),
            refreshSession: vi.fn(),
            validateAndRefreshSession: vi.fn(),
        },
    };
});

vi.mock("@descope/node-sdk", () => ({ default: () => sdkInstance }));

// Mock OAuth helper
vi.mock("../src/auth", () => ({ descopeOAuthLogin: vi.fn(async () => ({ ok: true, code: 200, sessionJwt: "sess", refreshJwt: "ref" })) }));

// Mock user input for OTP code
vi.mock("readline", () => {
    return {
        createInterface: () => ({
            question: (q: string, cb: (ans: string) => void) => cb("123456"),
            close: () => {},
        }),
    };
});

// Import after mocks
import { run } from "../src/index";

const withArgv = (args: string[]) => ["node", "index.js", ...args];

const captureStd = async (fn: () => Promise<void>) => {
    const write = process.stdout.write;
    const err = process.stderr.write;
    let out = "";
    let errOut = "";
    (process.stdout.write as any) = (chunk: any) => {
        out += String(chunk);
        return true;
    };
    (process.stderr.write as any) = (chunk: any) => {
        errOut += String(chunk);
        return true;
    };
    try {
        await fn();
        return { out, err: errOut };
    } finally {
        process.stdout.write = write as any;
        process.stderr.write = err as any;
    }
};

vi.spyOn(process, "exit").mockImplementation(((code?: any) => {
    throw new Error(`process.exit called with ${code}`);
}) as any);

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("CLI commands", () => {
        it("login-oauth prints session by default", async () => {
            const { out } = await captureStd(async () => {
                await run(withArgv(["login-oauth", "-p", "proj_1"]));
            });
            expect(out.trim()).toBe("sess");
        });

        it("login-oauth prints refresh when requested", async () => {
            const { out } = await captureStd(async () => {
                await run(withArgv(["login-oauth", "-p", "proj_1", "-o", "refresh"]));
            });
            expect(out.trim()).toBe("ref");
        });

        it("me prints user JSON", async () => {
            (sdkInstance.me as any).mockResolvedValue({ ok: true, data: { id: "u1" } });
            const { out } = await captureStd(async () => {
                await run(withArgv(["me", "-p", "proj_1", "-r", "ref"]));
            });
            expect(JSON.parse(out)).toEqual({ id: "u1" });
        });

        it("validate prints ok with sub/exp", async () => {
            (sdkInstance.validateSession as any).mockResolvedValue({ token: { sub: "u1", exp: 123 } });
            const { out } = await captureStd(async () => {
                await run(withArgv(["validate", "-p", "proj_1", "-s", "sess"]));
            });
            expect(JSON.parse(out)).toEqual({ ok: true, sub: "u1", exp: 123 });
        });

        it("refresh prints new session jwt", async () => {
            (sdkInstance.refreshSession as any).mockResolvedValue({ jwt: "newSess" });
            const { out } = await captureStd(async () => {
                await run(withArgv(["refresh", "-p", "proj_1", "-r", "ref"]));
            });
            expect(out.trim()).toBe("newSess");
        });

        it("validate-and-refresh prints new session jwt", async () => {
            (sdkInstance.validateAndRefreshSession as any).mockResolvedValue({ jwt: "newSess2" });
            const { out } = await captureStd(async () => {
                await run(withArgv(["validate-and-refresh", "-p", "proj_1", "-s", "sess", "-r", "ref"]));
            });
            expect(out.trim()).toBe("newSess2");
        });

        it("login OTP prompts and verifies code", async () => {
            const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
            (sdkInstance.otp.signUpOrIn.email as any).mockResolvedValue({ ok: true });
            (sdkInstance.otp.verify.email as any).mockResolvedValue({ data: { jwt: "X" } });
            await run(withArgv(["login", "-p", "proj_1", "-e", "a@b.com"]));
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("User logged in"));
            expect(sdkInstance.otp.verify.email).toHaveBeenCalledWith("a@b.com", "123456");
        });
});