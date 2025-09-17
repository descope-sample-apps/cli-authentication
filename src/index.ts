import { Command } from "commander";
import chalk from "chalk";
import DescopeClient from "@descope/node-sdk";
import * as readline from "readline";

/**
 * Prompt the user for input in the terminal and resolve with the entered value.
 *
 * @param query The prompt message to display to the user.
 * @returns A promise that resolves with the user's input string.
 */
export const getCode = async (query: string) => {
	const rl = readline.createInterface({
		// Force Node stream overload to avoid DOM ReadableStream/WritableStream resolution
		input: process.stdin as unknown as NodeJS.ReadableStream,
		output: process.stdout as unknown as NodeJS.WritableStream,
	});
	return await new Promise((resolve) => {
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans);
		});
	});
};

/**
 * Build and configure the CLI program with all supported commands.
 *
 * Commands:
 * - login: Email OTP sign-up or sign-in.
 * - login-oauth: OAuth2 PKCE flow via the browser.
 * - me: Fetch user info using a refresh token.
 * - validate: Validate a session token.
 * - refresh: Exchange a refresh token for a new session token.
 * - validate-and-refresh: Validate a session token or refresh it if needed.
 */
export const buildProgram = (): Command => {
	const program = new Command();


	program
		.name("CLI Authentication")
		.description("Perform authentication actions with Descope Node SDK using CLI")
		.version("1.0.0");

	// OTP/Email login command
	program
		.command("login")
		.description("Login with OTP/Email")
		.requiredOption("-e, --email <email>", "email of user")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.action(async (opts) => {
			// Initialize Descope client for the given project
			const clientAuth = DescopeClient({ projectId: opts.projectId });

			// Trigger OTP sign-up or sign-in by email
			const res = await clientAuth.otp.signUpOrIn.email(opts.email);
			if (!res.ok) {
				console.log(`Error ${res.error?.errorCode}: ${res.error?.errorDescription}`);
				return;
			}
			// Prompt for the OTP code and verify it
			const code = await getCode(chalk.yellow("Please type code sent by email: "));
			const jwt = await clientAuth.otp.verify.email(opts.email, `${code}`);

			// NOTE: The SDK returns tokens on success; print error if verification failed
			if (!res.ok) {
				console.log(`Error ${res.error?.errorCode}: ${res.error?.errorDescription}`);
				return;
			}
			console.log(chalk.green("Code verified successfully."));

			console.log("User logged in");
			console.log("**************");
			console.log(jwt.data);
			console.log();
		});

	// OAuth2 login with PKCE via browser
	program
		.command("login-oauth")
		.description("Login using OAuth2 flow with PKCE in the browser")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.option("-b, --baseUrl <baseUrl>", "Descope base URL", "https://api.descope.com")
		.option("-c, --callbackPort <port>", "Local callback port", "8088")
		.option("-o, --output <output>", "Output type: session|refresh|json", "session")
		.action(async (opts) => {
			try {
				console.error(chalk.blue("\uD83D\uDD10 Starting OAuth2 authentication..."));
				// Lazy-load OAuth flow implementation to speed up other commands
				const { descopeOAuthLogin } = await import("./auth");
				const jwt = await descopeOAuthLogin(opts.projectId, opts.baseUrl, opts.callbackPort);
				// Select which token(s) to output
				const out = String(opts.output || "session").toLowerCase();
				if (out === "session") {
					process.stdout.write(`${jwt.sessionJwt}\n`);
				} else if (out === "refresh") {
					if (!jwt.refreshJwt) {
						console.error(chalk.red("No refresh token returned by the provider"));
						process.exit(1);
					}
					process.stdout.write(`${jwt.refreshJwt}\n`);
				} else if (out === "json") {
					process.stdout.write(`${JSON.stringify(jwt)}\n`);
				} else {
					console.error(chalk.red(`Unknown --output value: ${opts.output}. Use session|refresh|json.`));
					process.exit(1);
				}
			} catch (error) {
				console.error(chalk.red(`\u274C Authentication failed: ${error}`));
				process.exit(1);
			}
		});

	// Fetch current user profile using a refresh token
	program
		.command("me")
		.description("Get user information using a refresh token")
        .requiredOption("-r, --refresh <refresh>", "Refresh token")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.action(async (opts) => {
			const clientAuth = DescopeClient({ projectId: opts.projectId });
			try {
                const me = await clientAuth.me(opts.refresh);
                if (!me.ok) {
                    console.error(chalk.red(`Failed to fetch user info: ${me.error?.errorMessage || "unknown error"}`));
                    process.exit(1);
                }
                process.stdout.write(`${JSON.stringify(me.data)}\n`);
			} catch (error) {
				console.error(chalk.red(`Failed to fetch user info: ${error}`));
				process.exit(1);
			}
		});

	// Validate a session token and print minimal info
	program
		.command("validate")
		.description("Validate provided session token")
        .requiredOption("-s, --session <session>", "Session token")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.action(async (opts) => {
			const clientAuth = DescopeClient({ projectId: opts.projectId });
			try {
                const info = await clientAuth.validateSession(opts.session);
                process.stdout.write(`${JSON.stringify({ ok: true, sub: info.token.sub, exp: info.token.exp })}\n`);
			} catch (error) {
				console.error(chalk.red(`Invalid session token: ${error}`));
				process.exit(1);
			}
		});

	// Exchange a refresh token for a new session token
	program
		.command("refresh")
		.description("Refresh session using a provided refresh token and get a new session token")
        .requiredOption("-r, --refresh <refresh>", "Refresh token")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.action(async (opts) => {
			const clientAuth = DescopeClient({ projectId: opts.projectId });
			try {
                const info = await clientAuth.refreshSession(opts.refresh);
                process.stdout.write(`${info.jwt}\n`);
			} catch (error) {
				console.error(chalk.red(`Failed to refresh session: ${error}`));
				process.exit(1);
			}
		});

	// Validate a session token; if invalid, try to refresh using the given refresh token
	program
		.command("validate-and-refresh")
		.description(
			"Validate provided session token, and if failed - refresh it and get a new one, using the provided refresh token",
		)
        .requiredOption("-r, --refresh <refresh>", "Refresh token")
        .requiredOption("-s, --session <session>", "Session token")
		.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
		.action(async (opts) => {
			const clientAuth = DescopeClient({ projectId: opts.projectId });
			try {
                const info = await clientAuth.validateAndRefreshSession(opts.session, opts.refresh);
                process.stdout.write(`${info.jwt}\n`);
			} catch (error) {
				console.error(chalk.red(`Failed to validate/refresh: ${error}`));
				process.exit(1);
			}
		});

	return program;
};

/**
 * Entry point for the CLI. Parses the provided argv and executes the matching command.
 *
 * @param argv The argv array to parse (defaults to process.argv).
 */
export const run = async (argv: readonly string[] = process.argv): Promise<void> => {
	const program = buildProgram();
	await program.parseAsync(argv as string[]);
};

if (require.main === module) {
	// Execute when run directly: parse CLI arguments and run the program
	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	run();
}
