import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture the request handler passed to createServer
let savedHandler: ((req: any, res: any) => void) | null = null;

// Fake HTTP server implementing the subset used by the code
const fakeServer = {
    listen: vi.fn((port: string | number, cb?: () => void) => {
        if (cb) cb();
    }),
    close: vi.fn(() => {}),
    on: vi.fn(() => {}),
    closeAllConnections: vi.fn(() => {}),
};

vi.mock("http", () => {
    return {
        createServer: (handler: (req: any, res: any) => void) => {
            savedHandler = handler;
            return fakeServer as any;
        },
    };
});

// Mock child_process.exec to capture the opened URL
const execMock = vi.fn();
vi.mock("child_process", () => {
    return {
        exec: (cmd: string) => execMock(cmd),
    };
});

// Import after mocks are set up
import { descopeOAuthLogin } from "../src/auth";

const extractUrlFromExec = (): string => {
    const call = execMock.mock.calls[0]?.[0] as string | undefined;
    if (!call) throw new Error("exec was not called");
    const match = call.match(/\"(https?:[^\"]+)\"/);
    if (!match) throw new Error(`failed to parse URL from exec: ${call}`);
    return match[1];
};

beforeEach(() => {
    execMock.mockClear();
    (fakeServer.listen as any).mockClear();
    (fakeServer.close as any).mockClear();
    (fakeServer.on as any).mockClear();
    (fakeServer.closeAllConnections as any).mockClear();
    savedHandler = null;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("descopeOAuthLogin", () => {
    it("completes happy path and returns tokens", async () => {
        // Stub global fetch for token exchange
        const fetchStub = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: "session-token", refresh_token: "refresh-token" }),
        });
        vi.stubGlobal("fetch", fetchStub);

        const promise = descopeOAuthLogin("proj_123", "https://api.example.com", "9090");

        // Capture the authorization URL and extract state
        const openedUrl = new URL(extractUrlFromExec());
        const state = openedUrl.searchParams.get("state");
        expect(state).toBeTruthy();

        // Simulate callback HTTP request with code and correct state
        const req: any = { url: `/callback?code=ABC123&state=${state}` };
        const res: any = {
            writeHead: vi.fn(() => {}),
            end: vi.fn(() => {}),
        };
        // Invoke saved handler
        savedHandler?.(req, res);

        const jwt = await promise;
        expect(jwt.ok).toBe(true);
        expect(jwt.sessionJwt).toBe("session-token");
        expect(jwt.refreshJwt).toBe("refresh-token");
        expect(fetchStub).toHaveBeenCalledOnce();
    });

    it("rejects on invalid state", async () => {
        vi.stubGlobal("fetch", vi.fn());
        const promise = descopeOAuthLogin("proj_123", "https://api.example.com", "9091");

        // wrong state
        const req: any = { url: `/callback?code=ABC123&state=WRONG` };
        const res: any = { writeHead: vi.fn(() => {}), end: vi.fn(() => {}) };
        savedHandler?.(req, res);

        await expect(promise).rejects.toThrow(/Invalid state/);
    });

    it("rejects on missing code", async () => {
        vi.stubGlobal("fetch", vi.fn());
        const promise = descopeOAuthLogin("proj_123", "https://api.example.com", "9092");

        const openedUrl = new URL(extractUrlFromExec());
        const state = openedUrl.searchParams.get("state");

        const req: any = { url: `/callback?state=${state}` };
        const res: any = { writeHead: vi.fn(() => {}), end: vi.fn(() => {}) };
        savedHandler?.(req, res);

        await expect(promise).rejects.toThrow(/Missing authorization code/);
    });
});


