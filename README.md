# Investment Fundamental Data Retriever Desktop App

This project retrieves and displays 17 key fundamental investment metrics for stocks using `yfinance` and provides a beautiful, modern desktop GUI built using `customtkinter`.

## Retrieved Metrics
The application displays details split into 4 core areas:
1. **Valuation**: Forward P/E, Industry P/E, Price/Sales, EV/Sales
2. **Profitability**: Return on Equity (ROE), Return on Invested Capital (ROIC), Gross Margin, EBIT Margin
3. **Financial Health**: Debt/Equity, Current Ratio, Beta (Volatility), Shares Outstanding
4. **Growth & Cash Flow**: EPS Forward, EPS Growth 5Y CAGR, Free Cash Flow, Tax Rate

---

## Installation & Setup

### 1. System Dependencies (Linux Only)
On Linux systems, python's standard GUI library `tkinter` is packaged separately. Install it via your package manager:

- **Debian / Ubuntu / Mint**:
  ```bash
  sudo apt-get update
  sudo apt-get install -y python3-tk
  ```
- **Fedora / CentOS / RHEL**:
  ```bash
  sudo dnf install -y python3-tkinter
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S tk
  ```

### 2. Python Packages
Create a virtual environment and install the required libraries:
```bash
# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## How to Run

### Desktop GUI Application
Run the main app file using Python:
```bash
python app.py
```
This opens a modern dark-mode application window where you can fetch ticker data and export records to **CSV** or **JSON**.

### Command-Line Interface (CLI) Quick-test
You can run the main terminal interface to print a beautifully formatted table of all 17 metrics:
```bash
python main.py AAPL
```
*(Replace `AAPL` with any desired stock ticker)*
