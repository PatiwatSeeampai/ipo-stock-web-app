const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { getStockData } = require('./retriever');
const { scrapeCMC } = require('./scraper');
const { fetchAllDetails } = require('./fetch_details');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory status flags
let isUpdating = false;

// 1. GET basic rankings list
app.get('/api/screener', (req, res) => {
    const filePath = path.join(__dirname, 'top_1000_companies.json');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Screener data not found. Trigger a refresh first." });
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Failed to read database file." });
    }
});

// 2. GET detailed fundamentals for S&P 500 comparison
app.get('/api/screener/detailed', (req, res) => {
    const detailedPath = path.join(__dirname, 'top_1000_companies_detailed.json');
    const basicPath = path.join(__dirname, 'top_1000_companies.json');
    
    // Check if detailed cache exists
    if (fs.existsSync(detailedPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(detailedPath, 'utf8'));
            return res.json({ status: isUpdating ? "updating" : "ready", data });
        } catch (e) {
            return res.status(500).json({ error: "Failed to read detailed database." });
        }
    }
    
    // Fallback to basic list if detailed is not populated yet
    if (fs.existsSync(basicPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(basicPath, 'utf8'));
            return res.json({ status: "populating", data });
        } catch (e) {
            return res.status(500).json({ error: "Failed to read database." });
        }
    }
    
    res.status(404).json({ error: "Screener database is empty. Call POST /api/screener/refresh." });
});

// 3. GET detailed metrics for a specific stock
app.get('/api/stock/:ticker', async (req, res) => {
    const ticker = req.params.ticker;
    console.log(`API: Fetching details for ticker: ${ticker}`);
    
    try {
        const data = await getStockData(ticker);
        res.json(data);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// 4. POST trigger full update in background
app.post('/api/screener/refresh', (req, res) => {
    if (isUpdating) {
        return res.status(409).json({ message: "Update is already running in the background." });
    }
    
    isUpdating = true;
    res.status(202).json({ message: "Rankings refresh triggered in background." });
    
    // Run update in background
    (async () => {
        try {
            await scrapeCMC();
            await fetchAllDetails();
            console.log("BACKGROUND JOB: Database update complete!");
        } catch (err) {
            console.error("BACKGROUND JOB ERROR:", err.message);
        } finally {
            isUpdating = false;
        }
    })();
});

// Start Server on localhost only (security compliance check: MUST listen on 127.0.0.1 for testing)
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
