#!/usr/bin/env node

import * as dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import chalk from "chalk";
import * as auth from "./auth";
import { getEmail } from "./auth";

const program = new Command();

program.name("sample-descope-cli").description("Sample CLI demonstrating Descope authentication patterns").version("1.0.0");

// Login with OTP command
program
    .command("login-otp")
    .description("Login using OTP (email verification)")
    .option("-e, --email <email>", "Email address")
    .action(async (options) => {
        try {
            const email = options.email || (await getEmail());
            const config = auth.getAuthConfig();

            console.log(chalk.blue("🔐 Starting OTP authentication..."));
            const jwt = await auth.descopeLoginOtp(config.projectId, email, config.baseUrl);

            console.log(chalk.green("✅ Authentication successful!"));
            console.log(chalk.gray(`Session JWT: ${jwt.sessionJwt.substring(0, 50)}...`));
        } catch (error) {
            console.error(chalk.red(`❌ Authentication failed: ${error}`));
            process.exit(1);
        }
    });

// Login with OAuth command
program
    .command("login-oauth")
    .description("Login using OAuth2 flow")
    .action(async () => {
        try {
            const config = auth.getAuthConfig();

            console.log(chalk.blue("🔐 Starting OAuth2 authentication..."));
            const jwt = await auth.descopeOAuthLogin(config.projectId, config.baseUrl);

            console.log(chalk.green("✅ Authentication successful!"));
            console.log(chalk.gray(`Session JWT: ${jwt.sessionJwt.substring(0, 50)}...`));
        } catch (error) {
            console.error(chalk.red(`❌ Authentication failed: ${error}`));
            process.exit(1);
        }
    });

// Whoami command
program
    .command("whoami")
    .description("Show current user information")
    .action(async () => {
        try {
            console.log(chalk.blue("👤 Getting user information..."));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userInfo = (await auth.getUserInfo()) as any;

            console.log(chalk.green("✅ User information retrieved:"));
            console.log(chalk.cyan("User ID:"), userInfo.sub || "N/A");
            console.log(chalk.cyan("Email:"), userInfo.email || "N/A");
            console.log(chalk.cyan("Name:"), userInfo.name || "N/A");
            console.log(chalk.cyan("Roles:"), userInfo.roles?.join(", ") || "N/A");
            console.log(chalk.cyan("Permissions:"), userInfo.permissions?.join(", ") || "N/A");

            if (userInfo.tenants) {
                console.log(chalk.cyan("Tenants:"));
                userInfo.tenants.forEach((tenant: { id: string; name?: string }) => {
                    console.log(chalk.gray(`  - ${tenant.id}: ${tenant.name || "N/A"}`));
                });
            }
        } catch (error) {
            console.error(chalk.red(`❌ Failed to get user info: ${error}`));
            process.exit(1);
        }
    });

// Logout command
program
    .command("logout")
    .description("Clear stored authentication tokens")
    .action(async () => {
        try {
            await auth.logout();
        } catch (error) {
            console.error(chalk.red(`❌ Logout failed: ${error}`));
            process.exit(1);
        }
    });

// Clear cache command
program
    .command("clear-cache")
    .description("Clear all cached authentication tokens")
    .option("-p, --project <projectId>", "Clear cache for specific project only")
    .action(async (options) => {
        try {
            if (options.project) {
                console.log(chalk.blue(`🧹 Clearing cache for project: ${options.project}`));
                await auth.clearProjectCache(options.project);
            } else {
                console.log(chalk.blue("🧹 Clearing all cached authentication tokens..."));
                await auth.clearAllCache();
            }
            console.log(chalk.green("✅ Cache cleared successfully!"));
        } catch (error) {
            console.error(chalk.red(`❌ Clear cache failed: ${error}`));
            process.exit(1);
        }
    });

// Test authenticated API call
program
    .command("test-api")
    .description("Test an authenticated API call")
    .action(async () => {
        try {
            console.log(chalk.blue("🧪 Testing authenticated API call..."));
            const jwt = await auth.getJwt();

            console.log(chalk.green("✅ Successfully retrieved JWT token"));
            console.log(chalk.gray(`Token length: ${jwt.length} characters`));
            console.log(chalk.gray(`Token preview: ${jwt.substring(0, 50)}...`));

            // Here you would typically make an API call using the JWT
            // For demonstration, we'll just show that we have a valid token
            console.log(chalk.green("✅ Ready to make authenticated API calls!"));
        } catch (error) {
            console.error(chalk.red(`❌ API test failed: ${error}`));
            process.exit(1);
        }
    });

// Show configuration
program
    .command("config")
    .description("Show current configuration")
    .action(() => {
        try {
            const config = auth.getAuthConfig();

            console.log(chalk.blue("⚙️  Current Configuration:"));
            console.log(chalk.cyan("Project ID:"), config.projectId);
            console.log(chalk.cyan("Base URL:"), config.baseUrl);
            console.log(chalk.cyan("OAuth Callback Port:"), config.oauthCallbackPort);
            console.log(chalk.cyan("Access Key:"), config.accessKey ? "***configured***" : "not configured");
        } catch (error) {
            console.error(chalk.red(`❌ Failed to show config: ${error}`));
            process.exit(1);
        }
    });

// Help command with examples
program
    .command("help-examples")
    .description("Show usage examples")
    .action(() => {
        console.log(chalk.blue("📚 Usage Examples:"));
        console.log();
        console.log(chalk.yellow("1. Login with OTP:"));
        console.log(chalk.gray("   sample-cli login-otp"));
        console.log(chalk.gray("   sample-cli login-otp --email user@example.com"));
        console.log();
        console.log(chalk.yellow("2. Login with OAuth:"));
        console.log(chalk.gray("   sample-cli login-oauth"));
        console.log();
        console.log(chalk.yellow("3. Check user info:"));
        console.log(chalk.gray("   sample-cli whoami"));
        console.log();
        console.log(chalk.yellow("4. Test API access:"));
        console.log(chalk.gray("   sample-cli test-api"));
        console.log();
        console.log(chalk.yellow("5. Logout:"));
        console.log(chalk.gray("   sample-cli logout"));
        console.log();
        console.log(chalk.yellow("6. Clear cache:"));
        console.log(chalk.gray("   sample-cli clear-cache"));
        console.log(chalk.gray("   sample-cli clear-cache --project PROJECT_ID"));
        console.log();
        console.log(chalk.yellow("7. Show configuration:"));
        console.log(chalk.gray("   sample-cli config"));
    });

// Error handling
program.on("command:*", () => {
    console.error(chalk.red(`❌ Invalid command: ${program.args.join(" ")}`));
    console.log(chalk.yellow("Use 'sample-cli --help' to see available commands"));
    process.exit(1);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
