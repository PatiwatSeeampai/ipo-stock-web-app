import sys
import invest_retriever

def print_metrics_table(symbol: str):
    print(f"\n========================================================")
    print(f"       INVESTMENT TERMINAL - FUNDAMENTAL AUDIT")
    print(f"========================================================")
    
    # Retrieve metrics
    data = invest_retriever.get_stock_data(symbol)
    if "error" in data:
        print(f"ERROR: {data['error']}")
        print(f"========================================================\n")
        return

    # Metadata
    print(f"  Company Name : {data.get('company_name')}")
    print(f"  Ticker       : {data.get('symbol')}")
    print(f"  Sector       : {data.get('sector')}")
    print(f"  Industry     : {data.get('industry')}")
    print(f"========================================================")
    print(f"  METRIC NAME                        VALUE")
    print(f"--------------------------------------------------------")

    # Metrics layout definitions
    metrics_mapping = [
        # Valuation Multiples
        ("Price per Share", data.get('price_per_share'), "currency"),
        ("Forward P/E Ratio", data.get('forward_pe_ratio'), "decimal"),
        ("Industry P/E Ratio", data.get('industry_pe'), "decimal"),
        ("P/S Ratio", data.get('ps_ratio'), "decimal"),
        ("EV/Sales Ratio", data.get('ev_sales'), "decimal"),
        
        # Profitability & Efficiency
        ("Return on Equity (ROE)", data.get('roe'), "percent_fraction"),
        ("Return on Invested Capital (ROIC)", data.get('roic'), "percent_fraction"),
        ("Gross Margin", data.get('gross_margin'), "percent_fraction"),
        ("EBIT Margin", data.get('ebit_margin'), "percent_fraction"),
        
        # Financial Health
        ("Debt/Equity Ratio", data.get('de_ratio'), "decimal"),
        ("Current Ratio", data.get('current_ratio'), "decimal"),
        ("Beta (Volatility)", data.get('beta'), "decimal"),
        ("Shares Outstanding", data.get('shares_outstanding'), "large_number"),
        
        # Growth & Forecasts
        ("EPS Forward", data.get('eps_forward'), "decimal"),
        ("EPS Growth 5Y CAGR", data.get('eps_growth_5y_forward_cagr'), "percent_value"),
        ("Free Cash Flow", data.get('free_cash_flow'), "large_number_currency"),
        ("Tax Rate", data.get('tax_rate'), "percent_fraction"),
    ]

    for label, val, val_type in metrics_mapping:
        formatted = "N/A"
        if val is not None and val != "":
            try:
                num = float(val)
                if val_type == "currency":
                    formatted = f"${num:,.2f}"
                elif val_type == "percent_fraction":
                    formatted = f"{num * 100.0:.2f}%"
                elif val_type == "percent_value":
                    formatted = f"{num:.2f}%"
                elif val_type == "large_number":
                    formatted = format_large_number(num, is_currency=False)
                elif val_type == "large_number_currency":
                    formatted = format_large_number(num, is_currency=True)
                else:
                    formatted = f"{num:,.2f}"
            except ValueError:
                formatted = str(val)
                
        print(f"  {label:<34} : {formatted}")
        
    print(f"========================================================\n")

def format_large_number(val: float, is_currency=False) -> str:
    abs_val = abs(val)
    suffix = ""
    divisor = 1.0
    
    if abs_val >= 1e12:
        suffix = " T"
        divisor = 1e12
    elif abs_val >= 1e9:
        suffix = " B"
        divisor = 1e9
    elif abs_val >= 1e6:
        suffix = " M"
        divisor = 1e6
        
    divided_val = val / divisor
    prefix = "$" if is_currency else ""
    return f"{prefix}{divided_val:,.2f}{suffix}"

if __name__ == "__main__":
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print_metrics_table(ticker)
