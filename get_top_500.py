import requests
from bs4 import BeautifulSoup
import csv
import json
import time

def fetch_top_500_companies():
    companies = []
    base_url = "https://companiesmarketcap.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    print("Fetching top 500 companies by market cap globally...")
    
    for page in range(1, 6):
        url = base_url if page == 1 else f"{base_url}page/{page}/"
        print(f"  Downloading page {page}/5...")
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                print(f"  Error: Received status code {response.status_code} for page {page}. Skipping.")
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            table = soup.find('table')
            if not table:
                print(f"  Error: Table element not found on page {page}. Skipping.")
                continue
                
            rows = table.find_all('tr')[1:] # Skip header row
            for r in rows:
                tds = r.find_all('td')
                if len(tds) < 8:
                    continue
                
                # Column index mappings based on table structure:
                # td 1: Rank
                # td 2: Name & Ticker
                # td 3: Market Cap
                # td 4: Share Price
                # td 7: Country
                
                rank = tds[1].text.strip()
                
                # Parse Name and Ticker
                name_td = tds[2]
                name_div = name_td.find('div', class_='company-name')
                code_div = name_td.find('div', class_='company-code')
                
                name = name_div.text.strip() if name_div else "N/A"
                ticker = code_div.text.strip() if code_div else "N/A"
                
                # Parse Market Cap
                cap_td = tds[3]
                cap_str = cap_td.text.strip()
                # Extract exact numeric cap from data-sort attribute if available
                cap_raw = cap_td.get('data-sort')
                try:
                    cap_numeric = int(cap_raw) if cap_raw else None
                except ValueError:
                    cap_numeric = None
                    
                # Parse Share Price
                price_td = tds[4]
                price = price_td.text.strip()
                
                # Parse Country
                country_td = tds[7]
                country = country_td.text.strip() if country_td else "N/A"
                
                companies.append({
                    "rank": int(rank) if rank.isdigit() else rank,
                    "company_name": name,
                    "ticker": ticker,
                    "market_cap": cap_str,
                    "market_cap_raw": cap_numeric,
                    "share_price": price,
                    "country": country
                })
                
            # Respectful scraping delay
            time.sleep(1.0)
            
        except Exception as e:
            print(f"  Exception while processing page {page}: {str(e)}")
            
    # Limit to top 500 just in case
    companies = companies[:500]
    
    # Save as CSV
    csv_file = "top_500_companies.csv"
    try:
        with open(csv_file, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["Rank", "Company Name", "Ticker", "Market Cap", "Market Cap Raw", "Share Price", "Country"])
            for c in companies:
                writer.writerow([
                    c["rank"], c["company_name"], c["ticker"], 
                    c["market_cap"], c["market_cap_raw"], c["share_price"], 
                    c["country"]
                ])
        print(f"Successfully saved {len(companies)} records to {csv_file}")
    except Exception as e:
        print(f"Failed to write CSV file: {str(e)}")

    # Save as JSON
    json_file = "top_500_companies.json"
    try:
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(companies, f, indent=2)
        print(f"Successfully saved {len(companies)} records to {json_file}")
    except Exception as e:
        print(f"Failed to write JSON file: {str(e)}")

    return companies

if __name__ == "__main__":
    fetch_top_500_companies()
