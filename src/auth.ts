import chalk from "chalk";
import DescopeClient from "@descope/node-sdk";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { createServer } from "http";
import { exec } from "child_process";

export interface JwtResponse {
	ok: boolean;
	code: number;
	error?: unknown;
	sessionJwt: string;
	refreshJwt: string;
}

const JWT_DIR = path.join(process.env.HOME || process.env.USERPROFILE || "", ".config", "descope");

const getJwtFilePath = (projectId: string): string => path.join(JWT_DIR, `${projectId}.jwt`);

export const loadJwtFromDisk = async (projectId: string): Promise<JwtResponse | undefined> => {
	const jwtFilePath = getJwtFilePath(projectId);
	if (!fs.existsSync(jwtFilePath)) return undefined;
	try {
		return JSON.parse(fs.readFileSync(jwtFilePath, "utf8"));
	} catch {
		return undefined;
	}
};

export const saveJwtToDisk = async (projectId: string, jwt: JwtResponse): Promise<JwtResponse> => {
	const jwtFilePath = getJwtFilePath(projectId);
	if (!fs.existsSync(JWT_DIR)) {
		fs.mkdirSync(JWT_DIR, { recursive: true });
	}
	fs.writeFileSync(jwtFilePath, JSON.stringify(jwt));
	return jwt;
};

const randomString = (length: number): string => crypto.randomBytes(length).toString("base64url").slice(0, length);
const sha256Hash = (input: string): Buffer => crypto.createHash("sha256").update(input).digest();
const base64URLEncode = (buffer: Buffer): string => buffer.toString("base64url");

const openUrl = (url: string): void => {
	const platform = process.platform;
	if (platform === "darwin") {
		exec(`open "${url}"`);
		return;
	}
	if (platform === "win32") {
		exec(`start "" "${url}"`);
		return;
	}
	exec(`xdg-open "${url}"`);
};

export const descopeOAuthLogin = async (
	projectId: string,
	baseUrl = "https://api.descope.com",
	callbackPort = "8088",
): Promise<JwtResponse> => {
	const clientAuth = DescopeClient({ projectId, baseUrl });

	// Try cache first
	const jwtCache = await loadJwtFromDisk(projectId);
	if (jwtCache) {
		try {
			if (await clientAuth.validateSession(jwtCache.sessionJwt)) {
				console.log(chalk.green("✓ Using cached authentication token"));
				return jwtCache;
			}
		} catch {
			// fall through
		}
	}

	console.log(chalk.yellow("Starting OAuth2 login flow..."));

	const state = randomString(16);
	const codeVerifier = randomString(64);
	const codeChallenge = base64URLEncode(sha256Hash(codeVerifier));
	const local = `http://localhost:${callbackPort}/`;
	const redirectUri = `${local}callback`;
	const authorizationEndpoint = `${baseUrl}/oauth2/v1/authorize`;
	const tokenEndpoint = `${baseUrl}/oauth2/v1/token`;

	const authParams = new URLSearchParams({
		response_type: "code",
		client_id: projectId,
		redirect_uri: redirectUri,
		scope: "openid profile email",
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		flow: "sign-in",
	});
	const authURL = `${authorizationEndpoint}?${authParams.toString()}`;

	return await new Promise<JwtResponse>((resolve, reject) => {
		const server = createServer((req, res) => {
			if (req.url?.startsWith("/callback")) {
				const url = new URL(req.url, local);
				const params = url.searchParams;

				const cleanup = () => {
					// Best-effort close
					try {
						// Close active sockets where supported
						const s: any = server as any;
						s.closeAllConnections?.();
					} catch {}
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
					code,
					redirect_uri: redirectUri,
					code_verifier: codeVerifier,
				})
					.then((jwt) => saveJwtToDisk(projectId, jwt).then(resolve))
					.catch(reject);
			}
		});

		server.listen(callbackPort, () => {
			console.log(chalk.yellow(`Opening browser to: ${authURL}`));
			openUrl(authURL);
		});

		server.on("error", (err) => reject(err));
	});
};

const exchangeCodeForToken = async (
	tokenEndpoint: string,
	params: Record<string, string>,
): Promise<JwtResponse> => {
	const response = await fetch(tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});
	if (!response.ok) {
		throw new Error(`Failed to exchange code for token: ${response.statusText}`);
	}
	const tokenResponse = (await response.json()) as Record<string, unknown>;
	return {
		ok: true,
		code: 200,
		sessionJwt: (tokenResponse.access_token as string) || (tokenResponse.id_token as string) || "",
		refreshJwt: (tokenResponse.refresh_token as string) || "",
	};
};
