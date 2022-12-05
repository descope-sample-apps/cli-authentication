import chalk from "chalk";
import { Command } from "commander";
import descopeCli from "./descopeCli";
import * as dotenv from "dotenv";
import { env, exit } from "process";
import { preProcessFile } from "typescript";
dotenv.config();

const program = new Command();

if (!process.env.DESCOPE_PROJECT_ID) {
    console.log(chalk.bgRed.white("Missing DESCOPE_PROJECT_ID env parameter"))
    process.exit(1);
}
program
	.name("cli-authentication")
	.description("Sample app for CLI authentication with Descope")
	.version("1.0.0");

program
    .command("login")
    .description("Display the winners for the given dates")
    .requiredOption(
        "-e, --email <email>",
        "email of user",
        "otp"
    )
    .option(
        "-v, --verbose",
        "email of user",
    )
    .option(
        "-m, --method <otp|totp|enchanted>",
        "Method for login",
        "otp"
    )
    .action(async (opts: any) => {
        
        const descpoeCli = await descopeCli({
            projectId: `${process.env.DESCOPE_PROJECT_ID}`,
            redirectUri: `${process.env.REDIRECT_URI}`,
            options: { verbose: opts.verbose }
            
        });
        let jwt;
        switch (opts.method) {
            case "totp":   
                jwt = await descpoeCli.signIn.totp(opts.email);
                break;
            case "enchanted":   
                jwt = await descpoeCli.signIn.enchantedLink(opts.email);
                break;
            case "opt":                
            default:
                jwt = (await descpoeCli.signIn.otp(opts.email));
                break;
        }
        console.log(jwt);
    });

program.parse();
