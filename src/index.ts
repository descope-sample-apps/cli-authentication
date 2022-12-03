import { Command } from "commander";
import * as dotenv from "dotenv";
import descopeCli from "./descopeCli";
dotenv.config();

const program = new Command();

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
            
                break;
            case "enchanted":   
                jwt = await descpoeCli.signIn.enchantedLink(opts.email)    ;

                break;
            case "opt":                
            default:
                jwt = (await descpoeCli.signIn.otp(opts.email));

                break;
        }

        console.log(jwt);
    });

program.parse();
