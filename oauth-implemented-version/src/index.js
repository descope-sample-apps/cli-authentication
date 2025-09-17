#!/usr/bin/env node
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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const auth = __importStar(require("./auth"));
const auth_1 = require("./auth");
const program = new commander_1.Command();
program.name("sample-descope-cli").description("Sample CLI demonstrating Descope authentication patterns").version("1.0.0");
// Login with OTP command
program
    .command("login-otp")
    .description("Login using OTP (email verification)")
    .option("-e, --email <email>", "Email address")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const email = options.email || (yield (0, auth_1.getEmail)());
        const config = auth.getAuthConfig();
        console.log(chalk_1.default.blue("🔐 Starting OTP authentication..."));
        const jwt = yield auth.descopeLoginOtp(config.projectId, email, config.baseUrl);
        console.log(chalk_1.default.green("✅ Authentication successful!"));
        console.log(chalk_1.default.gray(`Session JWT: ${jwt.sessionJwt.substring(0, 50)}...`));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Authentication failed: ${error}`));
        process.exit(1);
    }
}));
// Login with OAuth command
program
    .command("login-oauth")
    .description("Login using OAuth2 flow")
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = auth.getAuthConfig();
        console.log(chalk_1.default.blue("🔐 Starting OAuth2 authentication..."));
        const jwt = yield auth.descopeOAuthLogin(config.projectId, config.baseUrl);
        console.log(chalk_1.default.green("✅ Authentication successful!"));
        console.log(chalk_1.default.gray(`Session JWT: ${jwt.sessionJwt.substring(0, 50)}...`));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Authentication failed: ${error}`));
        process.exit(1);
    }
}));
// Whoami command
program
    .command("whoami")
    .description("Show current user information")
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        console.log(chalk_1.default.blue("👤 Getting user information..."));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userInfo = (yield auth.getUserInfo());
        console.log(chalk_1.default.green("✅ User information retrieved:"));
        console.log(chalk_1.default.cyan("User ID:"), userInfo.sub || "N/A");
        console.log(chalk_1.default.cyan("Email:"), userInfo.email || "N/A");
        console.log(chalk_1.default.cyan("Name:"), userInfo.name || "N/A");
        console.log(chalk_1.default.cyan("Roles:"), ((_a = userInfo.roles) === null || _a === void 0 ? void 0 : _a.join(", ")) || "N/A");
        console.log(chalk_1.default.cyan("Permissions:"), ((_b = userInfo.permissions) === null || _b === void 0 ? void 0 : _b.join(", ")) || "N/A");
        if (userInfo.tenants) {
            console.log(chalk_1.default.cyan("Tenants:"));
            userInfo.tenants.forEach((tenant) => {
                console.log(chalk_1.default.gray(`  - ${tenant.id}: ${tenant.name || "N/A"}`));
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Failed to get user info: ${error}`));
        process.exit(1);
    }
}));
// Logout command
program
    .command("logout")
    .description("Clear stored authentication tokens")
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield auth.logout();
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Logout failed: ${error}`));
        process.exit(1);
    }
}));
// Clear cache command
program
    .command("clear-cache")
    .description("Clear all cached authentication tokens")
    .option("-p, --project <projectId>", "Clear cache for specific project only")
    .action((options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (options.project) {
            console.log(chalk_1.default.blue(`🧹 Clearing cache for project: ${options.project}`));
            yield auth.clearProjectCache(options.project);
        }
        else {
            console.log(chalk_1.default.blue("🧹 Clearing all cached authentication tokens..."));
            yield auth.clearAllCache();
        }
        console.log(chalk_1.default.green("✅ Cache cleared successfully!"));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Clear cache failed: ${error}`));
        process.exit(1);
    }
}));
// Test authenticated API call
program
    .command("test-api")
    .description("Test an authenticated API call")
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(chalk_1.default.blue("🧪 Testing authenticated API call..."));
        const jwt = yield auth.getJwt();
        console.log(chalk_1.default.green("✅ Successfully retrieved JWT token"));
        console.log(chalk_1.default.gray(`Token length: ${jwt.length} characters`));
        console.log(chalk_1.default.gray(`Token preview: ${jwt.substring(0, 50)}...`));
        // Here you would typically make an API call using the JWT
        // For demonstration, we'll just show that we have a valid token
        console.log(chalk_1.default.green("✅ Ready to make authenticated API calls!"));
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ API test failed: ${error}`));
        process.exit(1);
    }
}));
// Show configuration
program
    .command("config")
    .description("Show current configuration")
    .action(() => {
    try {
        const config = auth.getAuthConfig();
        console.log(chalk_1.default.blue("⚙️  Current Configuration:"));
        console.log(chalk_1.default.cyan("Project ID:"), config.projectId);
        console.log(chalk_1.default.cyan("Base URL:"), config.baseUrl);
        console.log(chalk_1.default.cyan("OAuth Callback Port:"), config.oauthCallbackPort);
        console.log(chalk_1.default.cyan("Access Key:"), config.accessKey ? "***configured***" : "not configured");
    }
    catch (error) {
        console.error(chalk_1.default.red(`❌ Failed to show config: ${error}`));
        process.exit(1);
    }
});
// Help command with examples
program
    .command("help-examples")
    .description("Show usage examples")
    .action(() => {
    console.log(chalk_1.default.blue("📚 Usage Examples:"));
    console.log();
    console.log(chalk_1.default.yellow("1. Login with OTP:"));
    console.log(chalk_1.default.gray("   sample-cli login-otp"));
    console.log(chalk_1.default.gray("   sample-cli login-otp --email user@example.com"));
    console.log();
    console.log(chalk_1.default.yellow("2. Login with OAuth:"));
    console.log(chalk_1.default.gray("   sample-cli login-oauth"));
    console.log();
    console.log(chalk_1.default.yellow("3. Check user info:"));
    console.log(chalk_1.default.gray("   sample-cli whoami"));
    console.log();
    console.log(chalk_1.default.yellow("4. Test API access:"));
    console.log(chalk_1.default.gray("   sample-cli test-api"));
    console.log();
    console.log(chalk_1.default.yellow("5. Logout:"));
    console.log(chalk_1.default.gray("   sample-cli logout"));
    console.log();
    console.log(chalk_1.default.yellow("6. Clear cache:"));
    console.log(chalk_1.default.gray("   sample-cli clear-cache"));
    console.log(chalk_1.default.gray("   sample-cli clear-cache --project PROJECT_ID"));
    console.log();
    console.log(chalk_1.default.yellow("7. Show configuration:"));
    console.log(chalk_1.default.gray("   sample-cli config"));
});
// Error handling
program.on("command:*", () => {
    console.error(chalk_1.default.red(`❌ Invalid command: ${program.args.join(" ")}`));
    console.log(chalk_1.default.yellow("Use 'sample-cli --help' to see available commands"));
    process.exit(1);
});
// Parse command line arguments
program.parse();
// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
