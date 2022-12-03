import DescopeClient from "@descope/node-sdk";
import chalk from "chalk";
import { Response } from "node-fetch";
import * as readline  from 'readline';

export type jwtData = {
	sessionJwt: string;
	refreshJwt: string;
};
export type descopeCliOptions = {
    verbose: boolean
}
export type descopeCliProps = {
	projectId: string;
	redirectUri?: string;
    options?: descopeCliOptions;
};

export default async ( props: descopeCliProps) => {
    let cookies: any;
    const redirectUri = props.redirectUri || "";
    const projectId = props.projectId;
    const verbose = props?.options?.verbose || false;

    const consoleError = (error: any) => {
        consolePrint(chalk.red(`Error ${error?.errorCode}: ${error?.errorDescription}`), false);
    }
    const consolePrint = (text:any, verboseLevel: boolean) => {
        if (verbose || !verboseLevel) {
            console.log(text);
        }
    }
	const clientAuth = DescopeClient({
		projectId: projectId,
        hooks: {
            afterRequest: ( req: any, res: Response) => {
                if (res.status === 200 && res?.headers?.get("set-cookie")) {
                    cookies = res?.headers?.get("set-cookie");
                }
            }
        }
	});
    const getCode = (query: string) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }))
    }
    const getCookie = (cookies: string,name: string) => {
        var nameEQ = name + "=";
        var ca = cookies.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }
    const handleResponse = (res:any) => {
        if (!res.ok) {
            consoleError(res.error);
            return {};
        }
        consolePrint(chalk.green("Code verified successfully."), false)
        return ({
            sessionJwt: `${res.data?.sessionJwt}`,
            refreshJwt: `${getCookie(`${cookies}`, "DSR")}`
        });
    }

    return ({
        signIn: {
            otp: async (identifier: string) => {
                const res = await clientAuth.otp.signIn.email(identifier);
                if (!res.ok) {
                    consoleError(res.error);
                    return {};
                }
                const code = await getCode(chalk.yellow("Please type code sent by email: "));
                const jwt = await clientAuth.otp.verify.email(identifier, `${code}`);
                return handleResponse(jwt);
            },
            enchantedLink: async (identifier: string) => {
                const res = await clientAuth.magicLink.crossDevice.signIn.email(identifier,redirectUri);
                if (!res.ok) {
                    consoleError(res.error);
                    return {};
                }
                const ref = res.data?.pendingRef;
                console.log(chalk.yellow("Enchanted link sent. Please click it."));
                const jwt = await clientAuth.magicLink.crossDevice.waitForSession(ref!);
                return handleResponse(jwt);
            },  
            totp: async (identifier: string) => {
                const code = await getCode("Please type code sent by email: ");
                const jwt = clientAuth.totp.verify(identifier,`${code}`);
                return handleResponse(jwt);
            }
        }
    });
}
