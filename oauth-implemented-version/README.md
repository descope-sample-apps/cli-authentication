# Sample Descope CLI

This is a sample CLI that demonstrates how to implement Descope authentication patterns, mirroring the authentication setup from the main customer-success project.

## Features

- **OTP Authentication**: Email-based one-time password authentication
- **OAuth Authentication**: Browser-based OAuth2 flow with PKCE
- **JWT Token Management**: Automatic token caching and validation
- **Multiple Authentication Methods**: Support for both OTP and OAuth flows

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env` file with your Descope configuration:
```bash
cp .env.example .env
```

3. Update the `.env` file with your Descope project details:
```
DESCOPE_PROJECT_ID=your_project_id_here
DESCOPE_BASE_URL=https://api.descope.com
OAUTH_CALLBACK_PORT=8088
```

## Usage

Build and run the CLI:
```bash
pnpm run build
pnpm start
```

Or run in development mode:
```bash
pnpm run dev
```

## Commands

- `login-otp <email>` - Login using OTP (email verification)
- `login-oauth` - Login using OAuth2 flow
- `whoami` - Show current user information
- `logout` - Clear stored authentication tokens

## Authentication Flow

The CLI supports two authentication methods:

### OTP Authentication
1. User provides email address
2. System sends OTP to email
3. User enters OTP code
4. System validates and stores JWT token

### OAuth Authentication
1. System opens browser to Descope OAuth endpoint
2. User completes authentication in browser
3. System receives callback with authorization code
4. System exchanges code for JWT token

Both methods cache the JWT token locally and validate it on subsequent requests.
