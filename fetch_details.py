import sys
import os
import concurrent.futures
import json
import time
import invest_retriever

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def fetch_stock_details(c_item):
    symbol = c_item["ticker"]
    try:
        data = invest_retriever.get_stock_data(symbol)
        if "error" in data:
            # Fallback to CMC basic data if yfinance fails for a particular stock
            return {
                "rank": c_item.get("rank"),
                "ticker": symbol,
                "company_name": c_item.get("company_name"),
                "price_per_share": c_item.get("share_price"),
                "market_cap": c_item.get("market_cap"),
                "market_cap_raw": c_item.get("market_cap_raw"),
                "country": c_item.get("country"),
                "error": data["error"]
            }
        
        # Merge rank and formatted market cap from CMC
        data["rank"] = c_item.get("rank")
        data["market_cap_formatted"] = c_item.get("market_cap")
        data["market_cap_raw"] = c_item.get("market_cap_raw")
        data["country"] = c_item.get("country")
        return data
    except Exception as e:
        return {
            "rank": c_item.get("rank"),
            "ticker": symbol,
            "company_name": c_item.get("company_name"),
            "price_per_share": c_item.get("share_price"),
            "market_cap": c_item.get("market_cap"),
            "market_cap_raw": c_item.get("market_cap_raw"),
            "country": c_item.get("country"),
            "error": str(e)
        }

def run_fetch():
    print("Loading top 500 list...")
    try:
        with open("top_500_companies.json", "r", encoding="utf-8") as f:
            companies = json.load(f)
    except Exception as e:
        print(f"Error loading list: {e}. Please run get_top_500.py first.")
        return

    print(f"Starting parallel fetch of details for {len(companies)} stocks...")
    start_time = time.time()
    
    detailed_list = []
    
    # Run with 15 parallel workers for high speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(fetch_stock_details, c): c for c in companies}
        
        count = 0
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            detailed_list.append(res)
            count += 1
            if count % 25 == 0:
                print(f"  Progress: {count}/{len(companies)} stocks loaded...")
                
            # Intermittent autosave in case of interrupts
            if count % 100 == 0:
                with open("top_500_companies_detailed.json", "w", encoding="utf-8") as f:
                    json.dump(detailed_list, f, indent=2)

    # Sort detailed_list by rank so it stays in order
    def get_rank_sort(item):
        r = item.get("rank")
        try:
            return int(r)
        except (ValueError, TypeError):
            return 9999
            
    detailed_list.sort(key=get_rank_sort)

    # Final Save
    output_file = "top_500_companies_detailed.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(detailed_list, f, indent=2)
        
    print(f"\nCompleted! Fetched {len(detailed_list)} stocks in {time.time() - start_time:.2f} seconds!")
    print(f"Saved to: {output_file}")

if __name__ == "__main__":
    run_fetch()
