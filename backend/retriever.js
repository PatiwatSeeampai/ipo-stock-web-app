const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const axios = require('axios');
const cheerio = require('cheerio');

// Predefined industry average P/E ratios (NYU Stern/Damodaran averages as benchmarks)
const SECTOR_PE_AVERAGES = {
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
};

const INDUSTRY_PE_AVERAGES = {
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
};

function validateTicker(ticker) {
    return /^[A-Za-z0-9.-]{1,10}$/.test(ticker);
}

// Scraping StockAnalysis statistics page
async function scrapeStockAnalysis(ticker) {
    const symbol = ticker.toUpperCase().trim();
    const saTicker = symbol.toLowerCase();
    const url = `https://stockanalysis.com/stocks/${saTicker}/statistics/`;
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    try {
        const response = await axios.get(url, { headers, timeout: 12000 });
        const $ = cheerio.load(response.data);
        const stats = {};
        
        $('tr').each((idx, elem) => {
            const tds = $(elem).find('td');
            if (tds.length >= 2) {
                const key = $(tds[0]).text().trim();
                const value = $(tds[1]).text().trim();
                stats[key] = value;
            }
        });

        // Parse price from page
        const priceText = $('.text-4xl.font-bold').first().text().trim() || 
                           $('.text-3xl.font-bold').first().text().trim();
        if (priceText) {
            const parsedPrice = parseFloat(priceText.replace(/[$,]/g, ''));
            if (!isNaN(parsedPrice) && parsedPrice > 0) {
                stats['_price'] = parsedPrice;
            }
        }
        
        return stats;
    } catch (e) {
        console.warn(`[StockAnalysis Scraper] Warning: Failed to scrape statistics for ${symbol}: ${e.message}`);
        return null;
    }
}

// Helper to parse StockAnalysis string values
function parseSAValue(valStr) {
    if (!valStr) return null;
    const clean = valStr.trim();
    if (clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'n/s' || clean === '-' || clean === '—') {
        return null;
    }
    
    if (clean.endsWith('%')) {
        const parsed = parseFloat(clean.replace(/[%,]/g, ''));
        return isNaN(parsed) ? null : parsed / 100.0;
    }
    
    let multiplier = 1.0;
    let numStr = clean.replace(/[$,]/g, '');
    
    if (numStr.endsWith('T')) {
        multiplier = 1e12;
        numStr = numStr.slice(0, -1);
    } else if (numStr.endsWith('B')) {
        multiplier = 1e9;
        numStr = numStr.slice(0, -1);
    } else if (numStr.endsWith('M')) {
        multiplier = 1e6;
        numStr = numStr.slice(0, -1);
    } else if (numStr.endsWith('K')) {
        multiplier = 1e3;
        numStr = numStr.slice(0, -1);
    }
    
    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? null : parsed * multiplier;
}

async function getStockData(symbol) {
    symbol = symbol.toUpperCase().trim();
    if (!validateTicker(symbol)) {
        throw new Error("Invalid ticker format. Only letters, numbers, dots, and hyphens are allowed (max 10 characters).");
    }

    try {
        // Step 1: Fetch consensus/estimate metrics from Yahoo Finance
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile']
        });

        const sd = result.summaryDetail || {};
        const dk = result.defaultKeyStatistics || {};
        const fd = result.financialData || {};
        const ap = result.assetProfile || {};

        const data = {};
        data.symbol = symbol;
        data.company_name = sd.longName || dk.longName || symbol;
        data.sector = ap.sector || "N/A";
        data.industry = ap.industry || "N/A";

        // Initial mapping from Yahoo Finance data (to serve as fallback)
        const price = fd.currentPrice || sd.regularMarketPrice || sd.regularMarketPreviousClose || null;
        data.price_per_share = price;

        let ind_pe = INDUSTRY_PE_AVERAGES[data.industry];
        if (ind_pe === undefined && data.sector) {
            ind_pe = SECTOR_PE_AVERAGES[data.sector];
        }
        data.industry_pe = ind_pe !== undefined ? ind_pe : 20.0;

        // Seeking Alpha Estimates: EPS Forward, Forward PE, EPS Growth 5Y Forward CAGR
        data.eps_forward = dk.forwardEps !== undefined ? dk.forwardEps : null;
        
        let forward_pe = dk.forwardPE !== undefined ? dk.forwardPE : null;
        if (forward_pe === null && price !== null && data.eps_forward !== null && data.eps_forward > 0) {
            forward_pe = price / data.eps_forward;
        }
        data.forward_pe_ratio = forward_pe;

        let growth_5y = null;
        const peg = dk.pegRatio !== undefined ? dk.pegRatio : sd.pegRatio;
        const fpe = dk.forwardPE || forward_pe;
        if (peg !== undefined && peg !== null && fpe !== null && peg > 0) {
            growth_5y = fpe / peg;
        }
        if (growth_5y === null) {
            const earningsGrowth = dk.earningsGrowth || fd.earningsGrowth || null;
            if (earningsGrowth !== null) {
                growth_5y = earningsGrowth * 100;
            } else {
                const revenueGrowth = fd.revenueGrowth || dk.revenueGrowth || null;
                if (revenueGrowth !== null) {
                    growth_5y = revenueGrowth * 100;
                }
            }
        }
        data.eps_growth_5y_forward_cagr = growth_5y;

        // Default initial fallbacks for StockAnalysis metrics
        data.free_cash_flow = fd.freeCashflow !== undefined ? fd.freeCashflow : null;
        data.shares_outstanding = dk.sharesOutstanding !== undefined ? dk.sharesOutstanding : null;
        data.beta = dk.beta !== undefined ? dk.beta : (sd.beta !== undefined ? sd.beta : null);
        data.tax_rate = 0.21;
        data.ebit_margin = fd.operatingMargins !== undefined ? fd.operatingMargins : null;
        data.gross_margin = fd.grossMargins !== undefined ? fd.grossMargins : null;
        data.roe = fd.returnOnEquity !== undefined ? fd.returnOnEquity : null;
        
        let de = fd.debtToEquity !== undefined ? fd.debtToEquity : null;
        if (de !== null) {
            de = de / 100.0;
        }
        data.de_ratio = de;
        
        data.current_ratio = fd.currentRatio !== undefined ? fd.currentRatio : null;
        data.ev_sales = dk.enterpriseToRevenue !== undefined ? dk.enterpriseToRevenue : null;
        
        data.ps_ratio = sd.priceToSalesTrailing12Months !== undefined ? sd.priceToSalesTrailing12Months : null;
        if (data.ps_ratio === null && price !== null && data.shares_outstanding !== null && fd.totalRevenue) {
            data.ps_ratio = (price * data.shares_outstanding) / fd.totalRevenue;
        }

        let roic = null;
        try {
            const ebit = (fd.operatingMargins || 0) * (fd.totalRevenue || 0);
            const totalDebt = fd.totalDebt || 0;
            const totalCash = fd.totalCash || 0;
            const debtToEquity = fd.debtToEquity || 0;
            const bookValue = dk.bookValue || 0;
            const sharesOut = dk.sharesOutstanding || data.shares_outstanding || 0;
            let totalEquity = bookValue * sharesOut;
            if (totalEquity <= 0 && totalDebt > 0 && debtToEquity > 0) {
                totalEquity = totalDebt / (debtToEquity / 100.0);
            }
            if (ebit > 0 && totalEquity > 0) {
                const investedCap = totalDebt + totalEquity - totalCash;
                if (investedCap > 0) {
                    roic = (ebit * (1.0 - data.tax_rate)) / investedCap;
                }
            }
        } catch (e) {
            // Ignore
        }
        data.roic = roic;

        // Step 2: Overlay metrics by scraping StockAnalysis statistics directly
        const saStats = await scrapeStockAnalysis(symbol);
        if (saStats) {
            if (saStats['_price'] !== undefined) {
                data.price_per_share = saStats['_price'];
            }
            if (saStats['Free Cash Flow'] !== undefined) {
                data.free_cash_flow = parseSAValue(saStats['Free Cash Flow']) ?? data.free_cash_flow;
            }
            if (saStats['Shares Outstanding'] !== undefined) {
                data.shares_outstanding = parseSAValue(saStats['Shares Outstanding']) ?? data.shares_outstanding;
            }
            if (saStats['Beta (5Y)'] !== undefined) {
                data.beta = parseSAValue(saStats['Beta (5Y)']) ?? data.beta;
            }
            if (saStats['Return on Invested Capital (ROIC)'] !== undefined) {
                data.roic = parseSAValue(saStats['Return on Invested Capital (ROIC)']) ?? data.roic;
            }
            if (saStats['PS Ratio'] !== undefined) {
                data.ps_ratio = parseSAValue(saStats['PS Ratio']) ?? data.ps_ratio;
            }
            if (saStats['EBIT Margin'] !== undefined) {
                data.ebit_margin = parseSAValue(saStats['EBIT Margin']) ?? data.ebit_margin;
            }
            if (saStats['Effective Tax Rate'] !== undefined) {
                data.tax_rate = parseSAValue(saStats['Effective Tax Rate']) ?? data.tax_rate;
            }
            if (saStats['Gross Margin'] !== undefined) {
                data.gross_margin = parseSAValue(saStats['Gross Margin']) ?? data.gross_margin;
            }
            if (saStats['Return on Equity (ROE)'] !== undefined) {
                data.roe = parseSAValue(saStats['Return on Equity (ROE)']) ?? data.roe;
            }
            if (saStats['Debt / Equity'] !== undefined) {
                data.de_ratio = parseSAValue(saStats['Debt / Equity']) ?? data.de_ratio;
            }
            if (saStats['Current Ratio'] !== undefined) {
                data.current_ratio = parseSAValue(saStats['Current Ratio']) ?? data.current_ratio;
            }
            if (saStats['EV / Sales'] !== undefined) {
                data.ev_sales = parseSAValue(saStats['EV / Sales']) ?? data.ev_sales;
            }
        }

        return data;
    } catch (err) {
        console.error(`Error fetching ticker ${symbol}:`, err.message);
        throw err;
    }
}

module.exports = { getStockData, validateTicker };
