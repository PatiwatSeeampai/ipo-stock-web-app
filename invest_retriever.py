import re
import yfinance as yf

# Predefined industry average P/E ratios (NYU Stern/Damodaran averages as benchmarks)
SECTOR_PE_AVERAGES = {
    'Technology': 32.5,
    'Healthcare': 26.2,
    'Financial Services': 14.8,
    'Consumer Cyclical': 23.4,
    'Industrials': 21.0,
    'Communication Services': 24.5,
    'Consumer Defensive': 20.8,
    'Energy': 11.2,
    'Utilities': 17.5,
    'Real Estate': 28.6,
    'Basic Materials': 16.2
}

INDUSTRY_PE_AVERAGES = {
    'Consumer Electronics': 28.5,
    'Software - Infrastructure': 35.2,
    'Software - Application': 38.6,
    'Internet Content & Information': 26.0,
    'Semiconductors': 40.2,
    'Biotechnology': 32.0,
    'Drug Manufacturers - General': 22.5,
    'Drug Manufacturers - Specialty & Generic': 18.2,
    'Auto Manufacturers': 20.0,
    'Banks - Diversified': 11.5,
    'Banks - Regional': 10.2,
    'Oil & Gas Integrated': 10.5,
    'Oil & Gas E&P': 9.8,
    'Telecom Services': 15.0,
    'Discount Stores': 24.0,
    'Packaged Foods': 19.5,
    'Aerospace & Defense': 25.0,
    'Specialty Industrial Machinery': 22.0,
    'REIT - Specialized': 26.0,
    'REIT - Residential': 24.5,
    'REIT - Industrial': 28.0,
    'Entertainment': 23.0,
    'Internet Retail': 27.5,
    'Footwear & Accessories': 22.0,
    'Home Improvement Retail': 23.0,
    'Credit Services': 22.5,
    'Capital Markets': 18.0,
    'Insurance - Diversified': 12.5,
    'Medical Devices': 31.0,
    'Diagnostics & Research': 28.0,
    'Beverages - Non-Alcoholic': 25.0,
    'Beverages - Wineries & Distilleries': 24.0,
    'Tobacco': 12.0,
    'Chemicals': 18.5,
    'Steel': 9.5,
    'Gold': 22.0,
    'Utilities - Regulated Electric': 16.5,
    'Utilities - Regulated Gas': 17.0,
}

def validate_ticker(ticker: str) -> bool:
    """
    Validate stock ticker symbol to prevent security risks or invalid characters.
    Valid characters are letters, numbers, hyphens, and dots (max length 10).
    """
    return bool(re.match(r'^[A-Za-z0-9.-]{1,10}$', ticker))

def get_stock_data(symbol: str) -> dict:
    """
    Retrieve and calculate all 17 investment metrics for a given stock symbol.
    """
    symbol = symbol.upper().strip()
    if not validate_ticker(symbol):
        return {"error": "Invalid ticker format. Only letters, numbers, dots, and hyphens are allowed (max 10 characters)."}

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        # Validate that the ticker actually exists and has some data
        if not info or (not info.get('regularMarketPrice') and not info.get('currentPrice') and not info.get('symbol')):
            try:
                # Last ditch validation using fast_info
                price = ticker.fast_info.last_price
                if price is None:
                    return {"error": f"Ticker '{symbol}' not found or contains no data."}
            except Exception:
                return {"error": f"Ticker '{symbol}' not found or contains no data."}
    except Exception as e:
        return {"error": f"Error loading ticker '{symbol}': {str(e)}"}

    fast = ticker.fast_info
    
    # Fetch financials and balance sheet for computed metrics like ROIC
    try:
        financials = ticker.financials
        balance_sheet = ticker.balance_sheet
    except Exception:
        financials = None
        balance_sheet = None

    def get_financial_value(df, row_label, col_idx=0):
        """Safely extract the most recent value from a pandas DataFrame by index label."""
        if df is not None and not df.empty:
            matching_rows = [r for r in df.index if r.strip().lower() == row_label.lower()]
            if matching_rows:
                val = df.loc[matching_rows[0]].iloc[col_idx]
                import pandas as pd
                if pd.notna(val):
                    return float(val)
        return None

    data = {}
    data['symbol'] = symbol
    data['company_name'] = info.get('longName', symbol)
    data['sector'] = info.get('sector', 'N/A')
    data['industry'] = info.get('industry', 'N/A')

    # 1. Price per Share
    price = info.get('currentPrice') or info.get('regularMarketPrice')
    if price is None:
        try:
            price = fast.last_price
        except Exception:
            pass
    data['price_per_share'] = price

    # 2. Industry PE
    industry = info.get('industry')
    sector = info.get('sector')
    ind_pe = INDUSTRY_PE_AVERAGES.get(industry)
    if ind_pe is None and sector:
        ind_pe = SECTOR_PE_AVERAGES.get(sector)
    if ind_pe is None:
        ind_pe = 20.0  # default standard market PE benchmark
    data['industry_pe'] = ind_pe

    # 3. EPS Forward
    eps_forward = info.get('forwardEps')
    data['eps_forward'] = eps_forward

    # 4. Forward PE Ratio
    forward_pe = info.get('forwardPE')
    if forward_pe is None and price is not None and eps_forward is not None and eps_forward > 0:
        forward_pe = price / eps_forward
    data['forward_pe_ratio'] = forward_pe

    # 5. EPS growth 5y forward cagr (%)
    # Check growth_estimates first
    growth_5y = None
    try:
        ge = ticker.growth_estimates
        if ge is not None and not ge.empty and 'LTG' in ge.index:
            val = ge.loc['LTG', 'stockTrend']
            import pandas as pd
            if pd.notna(val):
                growth_5y = float(val) * 100.0
    except Exception:
        pass

    # If LTG is NaN, fallback to PEG-implied growth rate
    # PEG = PE / (Growth_Rate * 100) -> Growth_Rate = PE / PEG
    if growth_5y is None or growth_5y == 0:
        peg = info.get('pegRatio')
        fpe = info.get('forwardPE') or forward_pe
        if peg is not None and fpe is not None and peg > 0:
            growth_5y = fpe / peg
    data['eps_growth_5y_forward_cagr'] = growth_5y

    # 6. Free Cash Flow
    fcf = info.get('freeCashflow')
    if fcf is None:
        try:
            fcf = get_financial_value(ticker.cashflow, 'Free Cash Flow')
        except Exception:
            pass
    data['free_cash_flow'] = fcf

    # 7. Share Outstanding
    shares = info.get('sharesOutstanding')
    if shares is None:
        try:
            shares = fast.shares
        except Exception:
            pass
    data['shares_outstanding'] = shares

    # 8. Beta
    data['beta'] = info.get('beta')

    # 9. Tax Rate (calculated or fetched)
    tax_rate = None
    try:
        tax_prov = get_financial_value(financials, 'Tax Provision')
        pretax = get_financial_value(financials, 'Pretax Income')
        if tax_prov is not None and pretax is not None and pretax != 0:
            tax_rate = tax_prov / pretax
    except Exception:
        pass
    
    if tax_rate is None or tax_rate <= 0 or tax_rate > 1:
        tax_rate = info.get('taxRate')
    
    if tax_rate is None:
        tax_rate = 0.21  # 21% default corporate tax rate
    data['tax_rate'] = tax_rate

    # 10. EBIT Margin
    ebit_margin = info.get('operatingMargins')
    if ebit_margin is None:
        try:
            op_inc = get_financial_value(financials, 'Operating Income')
            tot_rev = get_financial_value(financials, 'Total Revenue')
            if op_inc is not None and tot_rev is not None and tot_rev != 0:
                ebit_margin = op_inc / tot_rev
        except Exception:
            pass
    data['ebit_margin'] = ebit_margin

    # 11. Gross Margin
    gross_margin = info.get('grossMargins')
    if gross_margin is None:
        try:
            gross_profit = get_financial_value(financials, 'Gross Profit')
            tot_rev = get_financial_value(financials, 'Total Revenue')
            if gross_profit is not None and tot_rev is not None and tot_rev != 0:
                gross_margin = gross_profit / tot_rev
        except Exception:
            pass
    data['gross_margin'] = gross_margin

    # 12. Return on Equity (ROE)
    roe = info.get('returnOnEquity')
    if roe is None:
        try:
            net_income = get_financial_value(financials, 'Net Income')
            equity = get_financial_value(balance_sheet, 'Stockholders Equity')
            if net_income is not None and equity is not None and equity != 0:
                roe = net_income / equity
        except Exception:
            pass
    data['roe'] = roe

    # 13. Debt/Equity ratio (DE)
    de = info.get('debtToEquity')
    if de is not None:
        de = de / 100.0  # yfinance returns debtToEquity as percent
    else:
        try:
            total_debt = get_financial_value(balance_sheet, 'Total Debt')
            equity = get_financial_value(balance_sheet, 'Stockholders Equity')
            if total_debt is not None and equity is not None and equity != 0:
                de = total_debt / equity
        except Exception:
            pass
    data['de_ratio'] = de

    # 14. Current Ratio
    curr_ratio = info.get('currentRatio')
    if curr_ratio is None:
        try:
            curr_assets = get_financial_value(balance_sheet, 'Current Assets')
            curr_liabs = get_financial_value(balance_sheet, 'Current Liabilities')
            if curr_assets is not None and curr_liabs is not None and curr_liabs != 0:
                curr_ratio = curr_assets / curr_liabs
        except Exception:
            pass
    data['current_ratio'] = curr_ratio

    # 15. EV/Sales
    ev_sales = info.get('enterpriseToRevenue')
    if ev_sales is None:
        ev = info.get('enterpriseValue')
        rev = info.get('totalRevenue')
        if ev is not None and rev is not None and rev != 0:
            ev_sales = ev / rev
    data['ev_sales'] = ev_sales

    # 16. PS Ratio
    ps_ratio = info.get('priceToSalesTrailing12Months')
    if ps_ratio is None and price is not None and shares is not None:
        rev = info.get('totalRevenue')
        if rev is not None and rev != 0:
            mcap = price * shares
            ps_ratio = mcap / rev
    data['ps_ratio'] = ps_ratio

    # 17. Return on Invested Capital (ROIC)
    # ROIC = EBIT * (1 - Tax Rate) / Invested Capital
    # Invested Capital = Total Debt + Stockholders Equity - Cash & Cash Equivalents
    roic = None
    try:
        ebit = get_financial_value(financials, 'EBIT')
        if ebit is None:
            ebit = get_financial_value(financials, 'Operating Income')
        if ebit is None and info.get('ebitda') is not None:
            ebitda = info.get('ebitda')
            dep_amort = get_financial_value(ticker.cashflow, 'Depreciation And Amortization')
            if dep_amort is not None:
                ebit = ebitda - dep_amort
            else:
                ebit = ebitda * 0.8  # EBIT estimation

        invested_cap = get_financial_value(balance_sheet, 'Invested Capital')
        if invested_cap is None:
            total_debt = get_financial_value(balance_sheet, 'Total Debt')
            if total_debt is None:
                lt_debt = get_financial_value(balance_sheet, 'Long Term Debt') or 0.0
                st_debt = get_financial_value(balance_sheet, 'Current Debt') or 0.0
                total_debt = lt_debt + st_debt
            
            equity = get_financial_value(balance_sheet, 'Stockholders Equity')
            
            cash = get_financial_value(balance_sheet, 'Cash Cash Equivalents And Short Term Investments')
            if cash is None:
                cash = get_financial_value(balance_sheet, 'Cash And Cash Equivalents') or 0.0
            
            if total_debt is not None and equity is not None:
                invested_cap = total_debt + equity - cash

        if ebit is not None and invested_cap is not None and invested_cap != 0:
            roic = (ebit * (1.0 - tax_rate)) / invested_cap
    except Exception:
        pass
    data['roic'] = roic

    return data

if __name__ == "__main__":
    # Small test CLI mode
    import sys
    test_symbol = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(f"Retrieving data for {test_symbol}...")
    res = get_stock_data(test_symbol)
    import json
    print(json.dumps(res, indent=2))
