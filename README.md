# Descope CLI-Authentication Sample App

This repo showcase how to authenticate users using Node CLI and Descope Node SDK.
User is authenticated using an OTP sent to the provided email.
The method used is SignUpOrIn, which means if the provided user does not exist - it is created and then signed in. 
Once user is signed in - you can use the session JWT to send to any backend service to be validated with Descope SDK. 

##  🎨 Features
- [Descope](https://descope.com/) Node SDK 🔐
- CLI authentication using OTP via email
- Refresh access token with the received refresh token
- Get end user information with me()


## ✨ Made with...
- [Descope](https://www.descope.com/)

## ⚙️ Setup

1. Clone the repository:

```
git clone https://github.com/descope-sample-apps/svelte-sample-app.git
```

2. Install dependencies:

```
npm install
```

3. Have Descope project ID from your project

## 🔮 Running the Application 

To start the application, run:

```
./start.sh login -p <PROJECT ID> -e <EMAIL>
```

## ⚠️ Issue Reporting

For any issues or suggestions, feel free to open an issue in the GitHub repository.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
