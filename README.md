## Descope CLI Authentication

This repo showcases how to authenticate users using a Node CLI and the Descope Node SDK.
Authenticate users from the command line using the Descope Node SDK. Supports OTP (email) and OAuth2 (PKCE via browser), token validation/refresh, and fetching user info. OAuth login prints the full session token to stdout; no token cache is used.
Once a user is signed in - you can use the session JWT to send to any backend service to be validated with Descope SDK. 

### 🎨 Features
- **Descope Node SDK**: End-to-end auth from the CLI
- **OTP (Email) Auth**: Signs users in with OTP, creates an account for them if they don't already exist
- **OAuth2 with PKCE**: Browser-based login, local callback server
- **Stdout token output**: `login-oauth` prints the full session token to stdout
- **Commands**: `login`, `login-oauth`, `me`, `validate`, `refresh`, `validate-and-refresh`

### ✨ Made with
- [Descope](https://www.descope.com/)

## ⚙️ Requirements
- Node.js 20.7+ (tested with 20.x)
- npm
- Descope Project ID

## 🚀 Setup
1) Clone the repository
```
git clone https://github.com/descope-sample-apps/cli-authentication.git
cd cli-authentication
```

2) Install dependencies (npm)
```
npm install
```

3) Build
```
npm run build
```

## 🔧 Usage (CLI Commands)
Run commands after building, e.g. `node build/index.js <command> [options]`.

### 1) OTP Email Login
```
node build/index.js login -p <PROJECT_ID> -e <EMAIL>
```
Flow:
- Sends an email OTP using SignUpOrIn flow.
- Prompts for the code and verifies it.
- Prints the returned JWT payload.

### 2) OAuth2 (PKCE) Login via Browser (prints token to stdout)
```
node build/index.js login-oauth -p <PROJECT_ID> \
  [-b <BASE_URL>] [-c <CALLBACK_PORT>] [-o session|refresh|json]
```
- Opens the system browser to authenticate.
- Spins up a local HTTP callback server on `http://localhost:<CALLBACK_PORT>/callback` (default `8088`).
- Exchanges the authorization code for tokens and prints to stdout based on `-o`.

Options:
- `-b, --baseUrl` Descope base URL (default `https://api.descope.com`)
- `-c, --callbackPort` Local callback port (default `8088`)

Note: Ensure your Descope project allows the redirect URI `http://localhost:<CALLBACK_PORT>/callback`.

### 3) Get Current User (me)
```
node build/index.js me -p <PROJECT_ID> -r <REFRESH_TOKEN>
```
Returns the user info JSON for the provided refresh token.

## 🔑 How to get a refresh token
- OAuth login (recommended):
  - Print only the refresh token:
    ```
    node build/index.js login-oauth -p <PROJECT_ID> -o refresh
    ```
  - Or print both tokens as JSON and take `refreshJwt`:
    ```
    node build/index.js login-oauth -p <PROJECT_ID> -o json
    ```
  - If `refreshJwt` is empty, configure your Descope project to issue refresh tokens for OAuth (e.g., enable refresh tokens/consent and include the `offline_access` scope).
- OTP flow:
  - After verifying the OTP with `login`, the returned object may include `refreshJwt`.

### 4) Validate Session Token
```
node build/index.js validate -p <PROJECT_ID> -s <SESSION_JWT>
```
Validates a session token and prints the result.

### 5) Refresh Session
```
node build/index.js refresh -p <PROJECT_ID> -r <REFRESH_TOKEN>
```
Exchanges the refresh token for a new session token.

### 6) Validate And Refresh
```
node build/index.js validate-and-refresh -p <PROJECT_ID> -s <SESSION_JWT> -r <REFRESH_TOKEN>
```
Validates the session token; if invalid, refreshes using the provided refresh token.

### Alternative runner
This repo includes `start.sh` for convenience:
```
./start.sh <command> [options]
```
(It builds then runs `node build/index.js`.)

## 🗄️ Token Cache
Token cache is disabled. Tokens are not stored on disk.

## ⚠️ Issue Reporting
Open issues and feature requests at the repository issues page.

## 📜 License
ISC — see the [LICENSE](LICENSE) file for details.
