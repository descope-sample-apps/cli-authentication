import * as dotenv from "dotenv";
dotenv.config();

import DescopeClient from "@descope/node-sdk";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createServer } from "http";
import { exec } from "child_process";
import chalk from "chalk";

export interface JwtResponse {
    ok: boolean;
    code: number;
    error?: unknown;
    sessionJwt: string;
    refreshJwt: string;
}

export interface AuthConfig {
    projectId: string;
    baseUrl: string;
    oauthCallbackPort: string;
    accessKey?: string;
}

/**
 * Get configuration from environment variables
 */
export const getAuthConfig = (): AuthConfig => {
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

/**
 * Get the path where JWT tokens are stored
 */
const jwtPath = (projectId: string): string => {
    return path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope", `${projectId}.jwt`);
};

/**
 * Load JWT token from disk
 */
const loadJwtFromDisk = async (projectId: string): Promise<JwtResponse | undefined> => {
    const path = jwtPath(projectId);
    return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path).toString()) : undefined;
};

/**
 * Save JWT token to disk
 */
const saveJwtToDisk = async (projectId: string, jwt: JwtResponse): Promise<JwtResponse> => {
    const jwtFilePath = jwtPath(projectId);
    if (!fs.existsSync(jwtFilePath)) {
        fs.mkdirSync(path.dirname(jwtFilePath), { recursive: true });
    }
    fs.writeFileSync(jwtFilePath, JSON.stringify(jwt));
    return jwt;
};

import * as readline from "readline";

/**
 * Prompt user for OTP code
 */
const getCode = async (): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question("Enter the verification code sent to your email: ", (code: string) => {
            rl.close();
            resolve(code.trim());
        });
    });
};

/**
 * Prompt user for email address
 */
export const getEmail = async (): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question("Enter your email address: ", (email: string) => {
            rl.close();
            resolve(email.trim());
        });
    });
};

/**
 * Login using OTP (email verification)
 */
export const descopeLoginOtp = async (projectId: string, email: string, baseUrl?: string): Promise<JwtResponse> => {
    const config = getAuthConfig();
    const clientAuth = DescopeClient({
        projectId: projectId,
        baseUrl: baseUrl || config.baseUrl,
    });

    // Try to load JWT from disk and validate it
    const jwtCache = await loadJwtFromDisk(projectId);
    try {
        if (jwtCache && (await clientAuth.validateSession(jwtCache.sessionJwt))) {
            console.log(chalk.green("✓ Using cached authentication token"));
            return jwtCache;
        }
    } catch {
        // Token is invalid, continue with login
    }

    console.log(chalk.yellow(`Sending OTP to ${email}...`));
    console.log(chalk.gray(`Using project ID: ${projectId}`));
    console.log(chalk.gray(`Using base URL: ${baseUrl || config.baseUrl}`));

    const res = await clientAuth.otp.signIn.email(email);
    console.log(chalk.gray(`OTP response: ${JSON.stringify(res, null, 2)}`));

    if (!res.ok) {
        throw new Error(`ERROR ${res.code}. ${res.error?.errorMessage}`);
    }

    const code = await getCode();
    console.log(chalk.yellow("Verifying code..."));

    let resVerify;
    try {
        resVerify = await clientAuth.otp.verify.email(email, code);
        console.log(chalk.gray(`Verification response: ${JSON.stringify(resVerify, null, 2)}`));

        if (!resVerify.ok) {
            console.log(chalk.red(`Cannot login. Error is ${resVerify.code}`));
            console.log(resVerify.error);
            throw new Error(`Login failed: ${resVerify.code}`);
        }
    } catch (error) {
        console.log(chalk.red(`Verification error: ${error}`));
        throw error;
    }

    const jwtData: JwtResponse = {
        ok: resVerify.ok,
        code: resVerify.code || 200,
        error: resVerify.error,
        sessionJwt: resVerify?.data?.sessionJwt ?? "",
        refreshJwt: resVerify?.data?.refreshJwt ?? "",
    };

    console.log(chalk.green("✓ Login successful!"));
    return await saveJwtToDisk(projectId, jwtData);
};

/**
 * Login using OAuth2 flow
 */
export const descopeOAuthLogin = async (projectId: string, baseUrl?: string): Promise<JwtResponse> => {
    const config = getAuthConfig();
    baseUrl = baseUrl || config.baseUrl;

    const clientAuth = DescopeClient({
        projectId: projectId,
        baseUrl: baseUrl,
    });

    // Try to load JWT from disk and validate it
    const jwtCache = await loadJwtFromDisk(projectId);
    try {
        if (jwtCache && (await clientAuth.validateSession(jwtCache.sessionJwt))) {
            console.log(chalk.green("✓ Using cached authentication token"));
            return jwtCache;
        }
    } catch {
        // Token is invalid, continue with login
    }

    console.log(chalk.yellow("Starting OAuth2 login flow..."));

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
    return new Promise<JwtResponse>((resolve, reject) => {
        const server = createServer((req, res) => {
            if (req.url?.startsWith("/callback")) {
                const url = new URL(req.url, local);
                const params = url.searchParams;

                const cleanup = () => {
                    const sockets = new Set<import("net").Socket>();
                    for (const socket of sockets) {
                        socket.destroy();
                    }
                    server.closeAllConnections();
                    server.close();
                };

                if (params.get("error")) {
                    const errorDesc = params.get("error_description");
                    console.error(chalk.red(`OAuth Error: ${params.get("error")} - ${errorDesc}`));
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

                exchangeCodeForToken(
                    tokenEndpoint,
                    {
                        grant_type: "authorization_code",
                        client_id: projectId,
                        code: code,
                        redirect_uri: redirectUri,
                        code_verifier: codeVerifier,
                    },
                    projectId,
                )
                    .then(resolve)
                    .catch(reject);
            }
        });

        server.listen(port, () => {
            console.log(chalk.yellow(`Opening browser to: ${authURL}`));
            exec(`open "${authURL}"`);
        });

        server.on("error", (err) => {
            reject(err);
        });
    });
};

/**
 * Exchange authorization code for JWT token
 */
const exchangeCodeForToken = async (tokenEndpoint: string, params: Record<string, string>, projectId: string): Promise<JwtResponse> => {
    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
        throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const tokenResponse = (await response.json()) as Record<string, unknown>;

    const jwtData: JwtResponse = {
        ok: true,
        code: 200,
        sessionJwt: (tokenResponse.access_token as string) || (tokenResponse.id_token as string) || "",
        refreshJwt: (tokenResponse.refresh_token as string) || "",
    };

    console.log(chalk.green("✓ OAuth login successful!"));
    return await saveJwtToDisk(projectId, jwtData);
};

/**
 * Login using access key (service-to-service)
 */
export const descopeAccessKeyLogin = async (projectId: string, accessKey: string, baseUrl?: string): Promise<string> => {
    const config = getAuthConfig();
    const clientAuth = DescopeClient({
        projectId: projectId,
        baseUrl: baseUrl || config.baseUrl,
    });

    try {
        const jwt = (await clientAuth.exchangeAccessKey(accessKey)).jwt;
        console.log(chalk.green("✓ Access key authentication successful!"));
        return jwt;
    } catch (e) {
        throw new Error(`Failed to authenticate with access key: ${e}`);
    }
};

/**
 * Get JWT token using the configured authentication method
 */
export const getJwt = async (): Promise<string> => {
    const config = getAuthConfig();

    if (config.accessKey) {
        return await descopeAccessKeyLogin(config.projectId, config.accessKey, config.baseUrl);
    }

    // Try to load cached JWT first
    const jwtCache = await loadJwtFromDisk(config.projectId);
    if (jwtCache) {
        const clientAuth = DescopeClient({
            projectId: config.projectId,
            baseUrl: config.baseUrl,
        });

        try {
            if (await clientAuth.validateSession(jwtCache.sessionJwt)) {
                console.log(chalk.green("✓ Using cached authentication token"));
                return jwtCache.sessionJwt;
            }
        } catch {
            // Token is invalid, will need to re-authenticate
        }
    }

    throw new Error("No valid authentication found. Please run 'login-otp' or 'login-oauth' command first.");
};

/**
 * Clear stored authentication tokens
 */
export const logout = async (): Promise<void> => {
    const config = getAuthConfig();
    const path = jwtPath(config.projectId);

    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
        console.log(chalk.green("✓ Logged out successfully"));
    } else {
        console.log(chalk.yellow("No stored authentication found"));
    }
};

/**
 * Clear all cached authentication tokens for all projects
 */
export const clearAllCache = async (): Promise<void> => {
    const descopeDir = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope");

    if (!fs.existsSync(descopeDir)) {
        console.log(chalk.yellow("No cache directory found"));
        return;
    }

    const files = fs.readdirSync(descopeDir).filter((file) => file.endsWith(".jwt"));

    if (files.length === 0) {
        console.log(chalk.yellow("No cached tokens found"));
        return;
    }

    let clearedCount = 0;
    for (const file of files) {
        try {
            const filePath = path.join(descopeDir, file);
            fs.unlinkSync(filePath);
            clearedCount++;
            console.log(chalk.green(`✓ Cleared cache for project: ${file.replace(".jwt", "")}`));
        } catch (error) {
            console.log(chalk.red(`✗ Failed to clear cache for ${file}: ${error}`));
        }
    }

    console.log(chalk.green(`✓ Successfully cleared ${clearedCount} cached token(s)`));
};

/**
 * Clear cache for a specific project
 */
export const clearProjectCache = async (projectId: string): Promise<void> => {
    const jwtPath = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope", `${projectId}.jwt`);

    if (fs.existsSync(jwtPath)) {
        fs.unlinkSync(jwtPath);
        console.log(chalk.green(`✓ Cleared cache for project: ${projectId}`));
    } else {
        console.log(chalk.yellow(`No cached token found for project: ${projectId}`));
    }
};

/**
 * Get user information from JWT token
 */
export const getUserInfo = async (): Promise<unknown> => {
    const jwt = await getJwt();
    const config = getAuthConfig();

    const clientAuth = DescopeClient({
        projectId: config.projectId,
        baseUrl: config.baseUrl,
    });

    try {
        const userInfo = await clientAuth.validateSession(jwt);
        return userInfo;
    } catch (e) {
        throw new Error(`Failed to get user info: ${e}`);
    }
};

// Utility functions
const randomString = (length: number): string => {
    return crypto.randomBytes(length).toString("base64url").slice(0, length);
};

const sha256Hash = (input: string): Buffer => {
    return crypto.createHash("sha256").update(input).digest();
};

const base64URLEncode = (buffer: Buffer): string => {
    return buffer.toString("base64url");
};
