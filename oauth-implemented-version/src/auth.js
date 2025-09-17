"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserInfo = exports.clearProjectCache = exports.clearAllCache = exports.logout = exports.getJwt = exports.descopeAccessKeyLogin = exports.descopeOAuthLogin = exports.descopeLoginOtp = exports.getEmail = exports.getAuthConfig = void 0;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const node_sdk_1 = __importDefault(require("@descope/node-sdk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const http_1 = require("http");
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
/**
 * Get configuration from environment variables
 */
const getAuthConfig = () => {
    const projectId = process.env.DESCOPE_PROJECT_ID;
    const baseUrl = process.env.DESCOPE_BASE_URL || "https://api.descope.com";
    const oauthCallbackPort = process.env.OAUTH_CALLBACK_PORT || "8088";
    const accessKey = process.env.DESCOPE_ACCESS_KEY;
    if (!projectId) {
        throw new Error("DESCOPE_PROJECT_ID environment variable is required");
    }
    return {
        projectId,
        baseUrl,
        oauthCallbackPort,
        accessKey,
    };
};
exports.getAuthConfig = getAuthConfig;
/**
 * Get the path where JWT tokens are stored
 */
const jwtPath = (projectId) => {
    return path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope", `${projectId}.jwt`);
};
/**
 * Load JWT token from disk
 */
const loadJwtFromDisk = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const path = jwtPath(projectId);
    return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path).toString()) : undefined;
});
/**
 * Save JWT token to disk
 */
const saveJwtToDisk = (projectId, jwt) => __awaiter(void 0, void 0, void 0, function* () {
    const jwtFilePath = jwtPath(projectId);
    if (!fs.existsSync(jwtFilePath)) {
        fs.mkdirSync(path.dirname(jwtFilePath), { recursive: true });
    }
    fs.writeFileSync(jwtFilePath, JSON.stringify(jwt));
    return jwt;
});
const readline = __importStar(require("readline"));
/**
 * Prompt user for OTP code
 */
const getCode = () => __awaiter(void 0, void 0, void 0, function* () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question("Enter the verification code sent to your email: ", (code) => {
            rl.close();
            resolve(code.trim());
        });
    });
});
/**
 * Prompt user for email address
 */
const getEmail = () => __awaiter(void 0, void 0, void 0, function* () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question("Enter your email address: ", (email) => {
            rl.close();
            resolve(email.trim());
        });
    });
});
exports.getEmail = getEmail;
/**
 * Login using OTP (email verification)
 */
const descopeLoginOtp = (projectId, email, baseUrl) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const config = (0, exports.getAuthConfig)();
    const clientAuth = (0, node_sdk_1.default)({
        projectId: projectId,
        baseUrl: baseUrl || config.baseUrl,
    });
    // Try to load JWT from disk and validate it
    const jwtCache = yield loadJwtFromDisk(projectId);
    try {
        if (jwtCache && (yield clientAuth.validateSession(jwtCache.sessionJwt))) {
            console.log(chalk_1.default.green("✓ Using cached authentication token"));
            return jwtCache;
        }
    }
    catch (_f) {
        // Token is invalid, continue with login
    }
    console.log(chalk_1.default.yellow(`Sending OTP to ${email}...`));
    console.log(chalk_1.default.gray(`Using project ID: ${projectId}`));
    console.log(chalk_1.default.gray(`Using base URL: ${baseUrl || config.baseUrl}`));
    const res = yield clientAuth.otp.signIn.email(email);
    console.log(chalk_1.default.gray(`OTP response: ${JSON.stringify(res, null, 2)}`));
    if (!res.ok) {
        throw new Error(`ERROR ${res.code}. ${(_a = res.error) === null || _a === void 0 ? void 0 : _a.errorMessage}`);
    }
    const code = yield getCode();
    console.log(chalk_1.default.yellow("Verifying code..."));
    let resVerify;
    try {
        resVerify = yield clientAuth.otp.verify.email(email, code);
        console.log(chalk_1.default.gray(`Verification response: ${JSON.stringify(resVerify, null, 2)}`));
        if (!resVerify.ok) {
            console.log(chalk_1.default.red(`Cannot login. Error is ${resVerify.code}`));
            console.log(resVerify.error);
            throw new Error(`Login failed: ${resVerify.code}`);
        }
    }
    catch (error) {
        console.log(chalk_1.default.red(`Verification error: ${error}`));
        throw error;
    }
    const jwtData = {
        ok: resVerify.ok,
        code: resVerify.code || 200,
        error: resVerify.error,
        sessionJwt: (_c = (_b = resVerify === null || resVerify === void 0 ? void 0 : resVerify.data) === null || _b === void 0 ? void 0 : _b.sessionJwt) !== null && _c !== void 0 ? _c : "",
        refreshJwt: (_e = (_d = resVerify === null || resVerify === void 0 ? void 0 : resVerify.data) === null || _d === void 0 ? void 0 : _d.refreshJwt) !== null && _e !== void 0 ? _e : "",
    };
    console.log(chalk_1.default.green("✓ Login successful!"));
    return yield saveJwtToDisk(projectId, jwtData);
});
exports.descopeLoginOtp = descopeLoginOtp;
/**
 * Login using OAuth2 flow
 */
const descopeOAuthLogin = (projectId, baseUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, exports.getAuthConfig)();
    baseUrl = baseUrl || config.baseUrl;
    const clientAuth = (0, node_sdk_1.default)({
        projectId: projectId,
        baseUrl: baseUrl,
    });
    // Try to load JWT from disk and validate it
    const jwtCache = yield loadJwtFromDisk(projectId);
    try {
        if (jwtCache && (yield clientAuth.validateSession(jwtCache.sessionJwt))) {
            console.log(chalk_1.default.green("✓ Using cached authentication token"));
            return jwtCache;
        }
    }
    catch (_a) {
        // Token is invalid, continue with login
    }
    console.log(chalk_1.default.yellow("Starting OAuth2 login flow..."));
    // OAuth2 params
    const state = randomString(16);
    const codeVerifier = randomString(64);
    const codeChallenge = base64URLEncode(sha256Hash(codeVerifier));
    const port = config.oauthCallbackPort;
    const local = `http://localhost:${port}/`;
    const redirectUri = local + "callback";
    const authorizationEndpoint = `${baseUrl}/oauth2/v1/authorize`;
    const tokenEndpoint = `${baseUrl}/oauth2/v1/token`;
    // Build authorization URL
    const authParams = new URLSearchParams({
        response_type: "code",
        client_id: projectId,
        redirect_uri: redirectUri,
        scope: "openid profile email",
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        flow: "sign-in",
    });
    const authURL = `${authorizationEndpoint}?${authParams.toString()}`;
    // Start callback server and open browser
    return new Promise((resolve, reject) => {
        const server = (0, http_1.createServer)((req, res) => {
            var _a;
            if ((_a = req.url) === null || _a === void 0 ? void 0 : _a.startsWith("/callback")) {
                const url = new URL(req.url, local);
                const params = url.searchParams;
                const cleanup = () => {
                    const sockets = new Set();
                    for (const socket of sockets) {
                        socket.destroy();
                    }
                    server.closeAllConnections();
                    server.close();
                };
                if (params.get("error")) {
                    const errorDesc = params.get("error_description");
                    console.error(chalk_1.default.red(`OAuth Error: ${params.get("error")} - ${errorDesc}`));
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end(`OAuth error: ${params.get("error")} - ${errorDesc}`);
                    cleanup();
                    reject(new Error(`OAuth error: ${params.get("error")}`));
                    return;
                }
                // Validate state
                if (params.get("state") !== state) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end("Invalid state");
                    cleanup();
                    reject(new Error("Invalid state parameter"));
                    return;
                }
                const code = params.get("code");
                if (!code) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    res.end("Missing code");
                    cleanup();
                    reject(new Error("Missing authorization code"));
                    return;
                }
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("Login successful! You may close this browser window.");
                cleanup();
                exchangeCodeForToken(tokenEndpoint, {
                    grant_type: "authorization_code",
                    client_id: projectId,
                    code: code,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier,
                }, projectId)
                    .then(resolve)
                    .catch(reject);
            }
        });
        server.listen(port, () => {
            console.log(chalk_1.default.yellow(`Opening browser to: ${authURL}`));
            (0, child_process_1.exec)(`open "${authURL}"`);
        });
        server.on("error", (err) => {
            reject(err);
        });
    });
});
exports.descopeOAuthLogin = descopeOAuthLogin;
/**
 * Exchange authorization code for JWT token
 */
const exchangeCodeForToken = (tokenEndpoint, params, projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
    });
    if (!response.ok) {
        throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }
    const tokenResponse = (yield response.json());
    const jwtData = {
        ok: true,
        code: 200,
        sessionJwt: tokenResponse.access_token || tokenResponse.id_token || "",
        refreshJwt: tokenResponse.refresh_token || "",
    };
    console.log(chalk_1.default.green("✓ OAuth login successful!"));
    return yield saveJwtToDisk(projectId, jwtData);
});
/**
 * Login using access key (service-to-service)
 */
const descopeAccessKeyLogin = (projectId, accessKey, baseUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, exports.getAuthConfig)();
    const clientAuth = (0, node_sdk_1.default)({
        projectId: projectId,
        baseUrl: baseUrl || config.baseUrl,
    });
    try {
        const jwt = (yield clientAuth.exchangeAccessKey(accessKey)).jwt;
        console.log(chalk_1.default.green("✓ Access key authentication successful!"));
        return jwt;
    }
    catch (e) {
        throw new Error(`Failed to authenticate with access key: ${e}`);
    }
});
exports.descopeAccessKeyLogin = descopeAccessKeyLogin;
/**
 * Get JWT token using the configured authentication method
 */
const getJwt = () => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, exports.getAuthConfig)();
    if (config.accessKey) {
        return yield (0, exports.descopeAccessKeyLogin)(config.projectId, config.accessKey, config.baseUrl);
    }
    // Try to load cached JWT first
    const jwtCache = yield loadJwtFromDisk(config.projectId);
    if (jwtCache) {
        const clientAuth = (0, node_sdk_1.default)({
            projectId: config.projectId,
            baseUrl: config.baseUrl,
        });
        try {
            if (yield clientAuth.validateSession(jwtCache.sessionJwt)) {
                console.log(chalk_1.default.green("✓ Using cached authentication token"));
                return jwtCache.sessionJwt;
            }
        }
        catch (_a) {
            // Token is invalid, will need to re-authenticate
        }
    }
    throw new Error("No valid authentication found. Please run 'login-otp' or 'login-oauth' command first.");
});
exports.getJwt = getJwt;
/**
 * Clear stored authentication tokens
 */
const logout = () => __awaiter(void 0, void 0, void 0, function* () {
    const config = (0, exports.getAuthConfig)();
    const path = jwtPath(config.projectId);
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
        console.log(chalk_1.default.green("✓ Logged out successfully"));
    }
    else {
        console.log(chalk_1.default.yellow("No stored authentication found"));
    }
});
exports.logout = logout;
/**
 * Clear all cached authentication tokens for all projects
 */
const clearAllCache = () => __awaiter(void 0, void 0, void 0, function* () {
    const descopeDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope");
    if (!fs.existsSync(descopeDir)) {
        console.log(chalk_1.default.yellow("No cache directory found"));
        return;
    }
    const files = fs.readdirSync(descopeDir).filter((file) => file.endsWith(".jwt"));
    if (files.length === 0) {
        console.log(chalk_1.default.yellow("No cached tokens found"));
        return;
    }
    let clearedCount = 0;
    for (const file of files) {
        try {
            const filePath = path.join(descopeDir, file);
            fs.unlinkSync(filePath);
            clearedCount++;
            console.log(chalk_1.default.green(`✓ Cleared cache for project: ${file.replace(".jwt", "")}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`✗ Failed to clear cache for ${file}: ${error}`));
        }
    }
    console.log(chalk_1.default.green(`✓ Successfully cleared ${clearedCount} cached token(s)`));
});
exports.clearAllCache = clearAllCache;
/**
 * Clear cache for a specific project
 */
const clearProjectCache = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    const jwtPath = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope", `${projectId}.jwt`);
    if (fs.existsSync(jwtPath)) {
        fs.unlinkSync(jwtPath);
        console.log(chalk_1.default.green(`✓ Cleared cache for project: ${projectId}`));
    }
    else {
        console.log(chalk_1.default.yellow(`No cached token found for project: ${projectId}`));
    }
});
exports.clearProjectCache = clearProjectCache;
/**
 * Get user information from JWT token
 */
const getUserInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const jwt = yield (0, exports.getJwt)();
    const config = (0, exports.getAuthConfig)();
    const clientAuth = (0, node_sdk_1.default)({
        projectId: config.projectId,
        baseUrl: config.baseUrl,
    });
    try {
        const userInfo = yield clientAuth.validateSession(jwt);
        return userInfo;
    }
    catch (e) {
        throw new Error(`Failed to get user info: ${e}`);
    }
});
exports.getUserInfo = getUserInfo;
// Utility functions
const randomString = (length) => {
    return crypto.randomBytes(length).toString("base64url").slice(0, length);
};
const sha256Hash = (input) => {
    return crypto.createHash("sha256").update(input).digest();
};
const base64URLEncode = (buffer) => {
    return buffer.toString("base64url");
};
