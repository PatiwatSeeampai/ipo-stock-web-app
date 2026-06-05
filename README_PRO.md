# 📊 Professional Investment Terminal (Web UI & Tauri Desktop)

Welcome to the new professional-grade Investment Terminal. This project has been rebuilt using a state-of-the-art full-stack JavaScript architecture to deliver a high-performance, Webull-style dashboard for analyzing 17 fundamental stock metrics across the top 500 global companies.

---

## 🏗️ Architecture & Stack

1. **Backend Server (`/backend`)**:
   - Built with **Node.js** & **Express**.
   - Leverages `yahoo-finance2` for real-time fundamental data extraction.
   - Implements a high-concurrency sliding window worker pool to query detailed statistics for all 500 stocks.
   - Caches responses locally inside JSON databases for instantaneous loading times.

2. **Frontend Web Dashboard (`/frontend`)**:
   - Built with **React** & **Next.js App Router** (compiled with Turbopack for ultra-fast performance).
   - Styled with **TailwindCSS** featuring a premium Dark HSL theme.
   - Features custom **Recharts** visualizations and interactive **Webull-style sorting** & **collapsible advanced filters**.

3. **Desktop Program Wrapper (`/frontend/src-tauri`)**:
   - Powered by **Tauri v2** (Rust backend wrapper).
   - Serves the static Next.js export in a native, lightweight window container.
   - Pre-configured to launch at a comfortable **1440x900** resolution.

---

## ⚡ Quick Start Instructions

We have created a master launcher in the root directory to make installing and running the terminal straightforward.

### 1. Installation
Install dependencies for both the frontend and backend in one command:
```bash
npm run install:all
```

### 2. Run the Development Servers
Open two terminal windows/tabs and run:

* **Terminal 1: Start the Backend API (runs on `127.0.0.1:4000`)**
  ```bash
  npm run dev:backend
  ```

* **Terminal 2: Start the Web UI (runs on `127.0.0.1:3000`)**
  ```bash
  npm run dev:frontend
  ```

Once both are running, open your web browser and go to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🖥️ Running as a Native Desktop App

To compile and launch the application as a standalone desktop app, you will need the Rust toolchain installed.

* **Run in Desktop Dev Mode:**
  ```bash
  npm run dev:desktop
  ```
  This launches a native window pointing directly to your live development server.

* **Build the Release Binary:**
  ```bash
  npm run build:desktop
  ```
  This exports Next.js to static files and compiles a lightweight, native, and optimized executable file under `frontend/src-tauri/target/release`.

---

## 💡 Key Terminal Features
* **Double Scrollable Matrix**: Scroll horizontally to compare 20 headers or vertically to scan all 500 global companies.
* **Full Metric Sorting**: Click on column headers like **ROIC**, **Forward PE**, **Gross Margin**, or **FCF** to instantly sort ascending/descending.
* **Collapsible Range Queries**: Real-time filtering using custom bounds (e.g. ROIC > 15%, PE < 20).
* **Fundamental Auditor Quadrants**: Access visual breakdowns, valuation charts, and automated efficiency ratings for any ticker.
