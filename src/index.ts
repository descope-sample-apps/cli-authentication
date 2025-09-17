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
	.action(async (opts) => {
		try {
			console.log(chalk.blue("\uD83D\uDD10 Starting OAuth2 authentication..."));
			const jwt = await descopeOAuthLogin(opts.projectId, opts.baseUrl, opts.callbackPort);
			console.log(chalk.green("\u2705 Authentication successful!"));
			console.log(chalk.gray(`Session JWT: ${jwt.sessionJwt.substring(0, 50)}...`));
		} catch (error) {
			console.error(chalk.red(`\u274C Authentication failed: ${error}`));
			process.exit(1);
		}
	});

program
	.command("me")
	.description("Get user information based on the provided refresh token")
	.requiredOption("-r, --refresh <refresh>", "Refresh token")
	.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
	.action(async (opts) => {
		const clientAuth = DescopeClient({ projectId: opts.projectId });

		console.log("User Details (me)");
		console.log("*****************");
		const me = await clientAuth.me(opts.refresh);
		console.log(me.data);
		console.log();
	});

program
	.command("validate")
	.description("Validate provided session token")
	.requiredOption("-s, --session <refresh>", "Session token")
	.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
	.action(async (opts) => {
		const clientAuth = DescopeClient({ projectId: opts.projectId });

		console.log("Validating...");
		const newJwt = await clientAuth.validateSession(opts.session);
		console.log();
		console.log("Response:");
		console.log(newJwt);
	});

program
	.command("refresh")
	.description("Refresh session using a provided refresh token and get a new session token")
	.requiredOption("-r, --refresh <refresh>", "Refresh token")
	.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
	.action(async (opts) => {
		const clientAuth = DescopeClient({ projectId: opts.projectId });

		console.log("Refreshing...");
		const newJwt = await clientAuth.refreshSession(opts.refresh);
		console.log();
		console.log("New Session JWT2:");
		console.log(newJwt);
	});

program
	.command("validate-and-refresh")
	.description(
		"Validate provided session token, and if failed - refresh it and get a new one, using the provided refresh token",
	)
	.requiredOption("-r, --refresh <refresh>", "Refresh token")
	.requiredOption("-s, --session <refresh>", "Session token")
	.requiredOption("-p, --projectId <projectId>", "Descope Project ID")
	.action(async (opts) => {
		const clientAuth = DescopeClient({ projectId: opts.projectId });

		console.log("Refreshing...");
		const newJwt = await clientAuth.validateAndRefreshSession(opts.session, opts.refresh);
		console.log();
		console.log("New Session JWT2:");
		console.log(newJwt);
	});

program.parse();
