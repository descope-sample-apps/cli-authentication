import * as auth from "./auth";

describe("Auth Module", () => {
    test("should get auth config", () => {
        // Mock environment variables
        process.env.DESCOPE_PROJECT_ID = "test-project-id";
        process.env.DESCOPE_BASE_URL = "https://api.test.com";
        process.env.OAUTH_CALLBACK_PORT = "8088";

        const config = auth.getAuthConfig();
        
        expect(config.projectId).toBe("test-project-id");
        expect(config.baseUrl).toBe("https://api.test.com");
        expect(config.oauthCallbackPort).toBe("8088");
    });

    test("should throw error when project ID is missing", () => {
        delete process.env.DESCOPE_PROJECT_ID;
        
        expect(() => auth.getAuthConfig()).toThrow("DESCOPE_PROJECT_ID environment variable is required");
    });
});
