import { Command } from "commander";
import chalk from "chalk";
import DescopeClient from "@descope/node-sdk";
import * as readline from "readline";
import { descopeOAuthLogin } from "./auth";

const program = new Command();

export const getCode = async (query: string) => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return await new Promise((resolve) => {
		rl.question(query, (ans) => {
			rl.close();
			resolve(ans);
		});
	});
};

program
	.name("CLI Authentication")
	.description("Perform authentication actions with Descope Node SDK using CLI")
	.version("1.0.0");

program
	.command("login")
	.description("Login with OTP/Email")
	.requiredOption("-e, --email <email>", "email of user")
	.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
	.action(async (opts) => {
		const clientAuth = DescopeClient({ projectId: opts.projectId });

		const res = await clientAuth.otp.signUpOrIn.email(opts.email);
		if (!res.ok) {
			console.log(`Error ${res.error?.errorCode}: ${res.error?.errorDescription}`);
			return;
		}
		const code = await getCode(chalk.yellow("Please type code sent by email: "));
		const jwt = await clientAuth.otp.verify.email(opts.email, `${code}`);

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
			const jwt = await descopeOAuthLogin(opts.projectId, opts.baseUrl, opts.callbackPort);
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

program.parse();
