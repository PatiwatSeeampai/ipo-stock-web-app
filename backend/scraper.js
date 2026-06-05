const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

async function scrapeCMC() {
    console.log("Scraping CompaniesMarketCap...");
    const companies = [];
    const base_url = "https://companiesmarketcap.com/";
    
    for (let page = 1; page <= 10; page++) {
        const url = page === 1 ? base_url : `${base_url}page/${page}/`;
        console.log(`  Downloading page ${page}/10...`);
        try {
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);
            const table = $('table');
            if (table.length === 0) continue;
            
            const rows = table.find('tr').slice(1);
            
            rows.each((idx, elem) => {
                const tds = $(elem).find('td');
                if (tds.length < 8) return;
                
                const rank = $(tds[1]).text().trim();
                
                const nameTd = $(tds[2]);
                const nameDiv = nameTd.find('.company-name');
                const codeDiv = nameTd.find('.company-code');
                
                const name = nameDiv.text().trim() || "N/A";
                const ticker = codeDiv.text().trim() || "N/A";
                
                const capTd = $(tds[3]);
                const capStr = capTd.text().trim();
                const capRaw = capTd.attr('data-sort');
                const capNumeric = capRaw ? parseInt(capRaw, 10) : null;
                
                const price = $(tds[4]).text().trim();
                const country = $(tds[7]).text().trim() || "N/A";
                
                companies.push({
                    rank: parseInt(rank, 10) || rank,
                    company_name: name,
                    ticker: ticker,
                    market_cap: capStr,
                    market_cap_raw: capNumeric,
                    share_price: price,
                    country: country
                });
            });
            
            // Wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.error(`  Error scraping page ${page}:`, e.message);
        }
    }
    
    const limitedList = companies.slice(0, 1000);
    const outputPath = path.join(__dirname, 'top_1000_companies.json');
    fs.writeFileSync(outputPath, JSON.stringify(limitedList, null, 2));
    console.log(`Scraped ${limitedList.length} companies and saved to top_1000_companies.json`);
    return limitedList;
}

module.exports = { scrapeCMC };
