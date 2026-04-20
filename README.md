# TimeLog ⏳

**TimeLog** is a lightweight, fully customizable task and time-tracking application built to adapt entirely to how *you* want to track your day. Instead of forcing you into rigid activity schemas like "Sleep" or "Exercise," TimeLog relies on dynamic custom tasks with highly personalized emojis and colors.

## Features ✨

* **Dynamically Created Tasks**: Personalize your lifestyle tracker. Map specific emojis and custom colors to unique tasks in your life instantly with native emoji palettes and native color pickers.
* **Smart Concurrency Lock**: Tracks your active state down to the millisecond. If you're running a task, the platform locks you out of initiating a new workflow elsewhere until you stop or complete the active cycle.
* **Inline Clock Displays**: The responsive user interface tracks the runtime of your task efficiently inline, so your tracking card breathes and scales seamlessly into any mobile device footprint.
* **Comprehensive Dashboards**: Check 7-day and 30-day activity trends broken down natively through detailed data graphs.
* **Google Authentication**: Frictionless onboarding leveraging Google Identity provider sign-ins.
* **Dark Mode Native**: Features a gorgeous standard dark-mode system and an automated light-mode equivalent mapping safely around browser top-panels via calculated `safe-area-inset` styling.

## 🔗 Live Demo
Try out the live implementation securely hosted here:  
👉 **[timelog-production-4f7b.up.railway.app](https://timelog-production-4f7b.up.railway.app)**

*Your data is fully secure, completely isolated by Google Authentication, and runs on a protected instance.*

## 📱 Mobile App Usage (PWA)
TimeLog operates strictly as a Progressive Web App (PWA). Instead of a traditional app store, you can install it seamlessly straight from your browser for a full-screen mobile experience!
1. **iOS (Safari)**: Tap the "Share" icon at the bottom of the screen, scroll down, and select **Add to Home Screen**. 
2. **Android (Chrome)**: Tap the 3-dot menu at the top right, and select **Add to Home screen** (or "Install app"). 
*(Once added, you'll never see browser URL bars again—it operates just like a native app!)*

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+)
- A [Google Cloud Console project](https://console.cloud.google.com/) equipped with an OAuth 2.0 Client ID (To enable Google sign-in)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vineetjangiriitb/timelog.git
   cd timelog
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add the following keys:
   ```env
   # Your Google OAuth 2.0 Web Application Client ID
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

   # An arbitrary long string for backend JWT encryption
   JWT_SECRET=your_super_secret_jwt_string_here

   PORT=3000
   ```

4. **Initialize application**
   ```bash
   npm start
   ```
   *The application will automatically deploy the `data/` directory and configure the underlying SQLite database schema upon the first connection.*

5. **Open locally**
   Head to `http://localhost:3000` to start tracking your time.

## 🔐 Security & Privacy Notice (For Open Source)

This project has been safely structured to separate sensitive configurations from the public repository layout:
* `data/timelog.db` - The underlying SQLite engine containing personal data is completely ignored from Source Control via `.gitignore`.
* `.env` - Authentication keys including `GOOGLE_CLIENT_ID` and `JWT_SECRET` are blocked from Source Control via `.gitignore`.

If you are forking or downloading this repository, you **must** supply your own `.env` configuration file to instantiate the authentication layer!

## 🚢 Deployment (Railway / Cloud Hosted)

TimeLog is heavily optimized to be deployed swiftly onto PaaS providers like **Railway**, **Render**, or **Heroku**. Because TimeLog relies on **SQLite**, you **must** configure a Persistent Volume mapped to the data directory so that your logs survive container restarts.

**Deployment Steps for Railway**:
1. Connect your GitHub repository to a new Railway project.
2. In your Railway service settings under **Variables**, set:
   * `GOOGLE_CLIENT_ID` = `your_google_id_here`
   * `JWT_SECRET` = `a_random_secure_long_string`
3. Wait for the initial deployment to finish to unlock the Volumes configuration.
4. Go to the **Volumes** tab in your service settings and click **Add a Volume**.
5. Set the **Mount Path** to exactly `/app/data` (assuming your root deployment uses Railway's default `/app` structure).
6. Redeploy your service.

*(Your SQLite database will now securely write to the persistent volume guaranteeing zero data-loss during standard cyclic reboots!)*

## License
MIT License. Free to use, fork, and hack into.
