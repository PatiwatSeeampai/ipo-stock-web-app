const fs = require('fs');
const path = require('path');
const { getStockData } = require('./retriever');

async function fetchAllDetails() {
    console.log("Loading top 1000 list from cache...");
    const inputPath = path.join(__dirname, 'top_1000_companies.json');
    if (!fs.existsSync(inputPath)) {
        console.error("top_1000_companies.json not found. Run scraper first.");
        return;
    }
    
    const companies = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Starting parallel fetch of details for ${companies.length} stocks...`);
    
    const detailedList = [];
    const limit = 15; // Concurrency limit
    let index = 0;
    
    const startAll = Date.now();
    
    async function worker() {
        while (index < companies.length) {
            const currentIdx = index++;
            const item = companies[currentIdx];
            console.log(`[${currentIdx+1}/${companies.length}] Fetching details for ${item.ticker}...`);
            const start = Date.now();
            try {
                const data = await getStockData(item.ticker);
                
                // Merge rank, country, and CMC market cap
                const merged = {
                    ...data,
                    rank: item.rank,
                    ticker: item.ticker, // Ensure 'ticker' key exists
                    market_cap_formatted: item.market_cap,
                    market_cap_raw: item.market_cap_raw,
                    country: item.country
                };
                detailedList.push(merged);
                console.log(`  Finished ${item.ticker} in ${((Date.now() - start)/1000).toFixed(2)}s`);
            } catch (e) {
                console.error(`  Error fetching ${item.ticker}:`, e.message);
                detailedList.push({
                    rank: item.rank,
                    ticker: item.ticker,
                    company_name: item.company_name,
                    price_per_share: parseFloat(item.share_price.replace(/[$,]/g, '')) || null,
                    market_cap: item.market_cap,
                    market_cap_raw: item.market_cap_raw,
                    country: item.country,
                    error: e.message
                });
            }
            
            // Intermittent save
            if (detailedList.length % 50 === 0) {
                fs.writeFileSync(
                    path.join(__dirname, 'top_1000_companies_detailed.json'),
                    JSON.stringify(detailedList, null, 2)
                );
            }
        }
    }
    
    const promises = [];
    for (let i = 0; i < Math.min(limit, companies.length); i++) {
        promises.push(worker());
    }
    
    await Promise.all(promises);
    
    // Sort by rank
    detailedList.sort((a, b) => (parseInt(a.rank) || 9999) - (parseInt(b.rank) || 9999));
    
    const outputPath = path.join(__dirname, 'top_1000_companies_detailed.json');
    fs.writeFileSync(outputPath, JSON.stringify(detailedList, null, 2));
    
    console.log(`\nCompleted! Fetched ${detailedList.length} stocks in ${((Date.now() - startAll)/1000).toFixed(2)} seconds.`);
    console.log(`Saved database to ${outputPath}`);
    return detailedList;
}

if (require.main === module) {
    fetchAllDetails();
}

module.exports = { fetchAllDetails };
