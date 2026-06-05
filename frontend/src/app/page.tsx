"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Search, 
  Settings, 
  Download, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  ClipboardList,
  Activity,
  DollarSign,
  Briefcase,
  Layers,
  Percent,
  TrendingDown
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from "recharts";

const API_BASE = "http://127.0.0.1:4000/api";

export default function InvestmentTerminal() {
  // Tabs: 'screener', 'auditor', or 'checklist'
  const [activeTab, setActiveTab] = useState<"screener" | "auditor" | "checklist">("screener");
  
  // Checklist Sorting
  const [checklistSortOrder, setChecklistSortOrder] = useState<"asc" | "desc">("desc");
  
  // Data States
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<any[]>([]);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  
  // Scraper status
  const [dbStatus, setDbStatus] = useState<string>("loading"); // 'loading', 'populating', 'updating', 'ready'
  
  // Basic Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [countries, setCountries] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  // Advanced Range Filters
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [peMin, setPeMin] = useState("");
  const [peMax, setPeMax] = useState("");
  const [roicMin, setRoicMin] = useState("");
  const [roicMax, setRoicMax] = useState("");
  const [deMin, setDeMin] = useState("");
  const [deMax, setDeMax] = useState("");
  const [grossMin, setGrossMin] = useState("");
  const [grossMax, setGrossMax] = useState("");
  const [fcfMin, setFcfMin] = useState("");
  const [fcfMax, setFcfMax] = useState("");

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>("Rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Auditor States
  const [auditorTicker, setAuditorTicker] = useState("");
  const [auditorLoading, setAuditorLoading] = useState(false);
  const [auditorError, setAuditorError] = useState<string | null>(null);

  // ------------------------------------------------
  // Fetch Screener Data on Mount
  // ------------------------------------------------
  useEffect(() => {
    fetchScreenerData();
  }, []);

  const fetchScreenerData = async () => {
    setDbStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/screener/detailed`);
      if (!res.ok) throw new Error("Database endpoint failed.");
      const resJson = await res.json();
      
      const list = resJson.data || [];
      setAllStocks(list);
      setFilteredStocks(list);
      setDbStatus(resJson.status || "ready");

      // Extract unique countries
      const distinctCountries = Array.from(
        new Set(list.map((s: any) => s.country).filter(Boolean))
      ) as string[];
      setCountries(distinctCountries.sort());
    } catch (e) {
      console.error(e);
      setDbStatus("error");
    }
  };

  // ------------------------------------------------
  // Filter Evaluation
  // ------------------------------------------------
  useEffect(() => {
    applyFilters();
  }, [
    searchQuery,
    selectedCountry,
    priceMin,
    priceMax,
    peMin,
    peMax,
    roicMin,
    roicMax,
    deMin,
    deMax,
    grossMin,
    grossMax,
    fcfMin,
    fcfMax,
    allStocks
  ]);

  const applyFilters = () => {
    let list = [...allStocks];

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.ticker || s.symbol || "").toLowerCase().includes(q) ||
          (s.company_name || "").toLowerCase().includes(q)
      );
    }

    // Country Filter
    if (selectedCountry !== "All") {
      list = list.filter((s) => s.country === selectedCountry);
    }

    // Helper for range checks
    const inRange = (val: any, min: string, max: string, isPercent = false, isBillion = false) => {
      if (!min && !max) return true;
      if (val === undefined || val === null || val === "") return false;
      
      let num = parseFloat(val);
      if (isNaN(num)) return false;

      // Normalize comparison scale
      let checkMin = min ? parseFloat(min) : null;
      let checkMax = max ? parseFloat(max) : null;

      if (isPercent) {
        // e.g. input 15% is compared to fraction 0.15
        if (checkMin !== null) checkMin /= 100;
        if (checkMax !== null) checkMax /= 100;
      }
      if (isBillion) {
        // e.g. input 1 ($B) is compared to raw number 1,000,000,000
        if (checkMin !== null) checkMin *= 1e9;
        if (checkMax !== null) checkMax *= 1e9;
      }

      if (checkMin !== null && num < checkMin) return false;
      if (checkMax !== null && num > checkMax) return false;
      return true;
    };

    // Advanced Numeric filters
    list = list.filter((s) => {
      // Stock price check
      const priceVal = s.price_per_share || s.share_price;
      const priceClean = typeof priceVal === "string" ? priceVal.replace(/[$,]/g, "") : priceVal;
      
      return (
        inRange(priceClean, priceMin, priceMax) &&
        inRange(s.forward_pe_ratio, peMin, peMax) &&
        inRange(s.roic, roicMin, roicMax, true) &&
        inRange(s.de_ratio, deMin, deMax) &&
        inRange(s.gross_margin, grossMin, grossMax, true) &&
        inRange(s.free_cash_flow, fcfMin, fcfMax, false, true)
      );
    });

    // Reapply sorting
    sortDataset(list, sortColumn, sortOrder);
  };

  // ------------------------------------------------
  // Sort Logic (Webull Style)
  // ------------------------------------------------
  const handleSort = (columnName: string) => {
    let order: "asc" | "desc" = "asc";
    if (sortColumn === columnName) {
      order = sortOrder === "asc" ? "desc" : "asc";
    }
    setSortColumn(columnName);
    setSortOrder(order);
    sortDataset(filteredStocks, columnName, order);
  };

  const sortDataset = (list: any[], colName: string, order: "asc" | "desc") => {
    const keyMap: any = {
      "Rank": "rank",
      "Ticker": "ticker",
      "Company Name": "company_name",
      "Price": "price_per_share",
      "Market Cap": "market_cap_raw",
      "Forward PE": "forward_pe_ratio",
      "Forward EPS": "eps_forward",
      "5Y Growth": "eps_growth_5y_forward_cagr",
      "FCF": "free_cash_flow",
      "Beta": "beta",
      "ROIC": "roic",
      "PS Ratio": "ps_ratio",
      "EBIT Margin": "ebit_margin",
      "Tax Rate": "tax_rate",
      "Gross Margin": "gross_margin",
      "ROE": "roe",
      "DE Ratio": "de_ratio",
      "Current Ratio": "current_ratio",
      "EV Sales": "ev_sales",
      "Country": "country"
    };

    const targetKey = keyMap[colName] || "ticker";
    
    list.sort((a, b) => {
      let valA = a[targetKey];
      let valB = b[targetKey];

      // Handle Price check fallback
      if (targetKey === "price_per_share") {
        valA = valA || a.share_price;
        valB = valB || b.share_price;
      }

      // Convert String Prices/Percentages to Floats
      if (typeof valA === "string" && !isNaN(parseFloat(valA.replace(/[$,%]/g, "")))) {
        valA = parseFloat(valA.replace(/[$,%]/g, ""));
      }
      if (typeof valB === "string" && !isNaN(parseFloat(valB.replace(/[$,%]/g, "")))) {
        valB = parseFloat(valB.replace(/[$,%]/g, ""));
      }

      // Handle nulls and place them at the end
      if (valA === undefined || valA === null || valA === "") return order === "asc" ? 1 : -1;
      if (valB === undefined || valB === null || valB === "") return order === "asc" ? -1 : 1;

      if (typeof valA === "number" && typeof valB === "number") {
        return order === "asc" ? valA - valB : valB - valA;
      }

      // String comparison
      return order === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });

    setFilteredStocks(list);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCountry("All");
    setPriceMin(""); setPriceMax("");
    setPeMin(""); setPeMax("");
    setRoicMin(""); setRoicMax("");
    setDeMin(""); setDeMax("");
    setGrossMin(""); setGrossMax("");
    setFcfMin(""); setFcfMax("");
  };

  // ------------------------------------------------
  // Auditor Core Fetch
  // ------------------------------------------------
  const runStockAudit = async (ticker: string) => {
    if (!ticker) return;
    setAuditorLoading(true);
    setAuditorError(null);
    setActiveTab("auditor");
    
    try {
      const res = await fetch(`${API_BASE}/stock/${ticker.toUpperCase().trim()}`);
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || `Failed to fetch ticker '${ticker}'.`);
      }
      const data = await res.json();
      setSelectedStock(data);
      setAuditorTicker(data.symbol);
    } catch (e: any) {
      console.error(e);
      setAuditorError(e.message || "An unexpected error occurred.");
    } finally {
      setAuditorLoading(false);
    }
  };

  const triggerDbRefresh = async () => {
    if (confirm("This will scrape rankings and retrieve full detailed metrics. Takes up to 1.5 minutes. Continue?")) {
      try {
        await fetch(`${API_BASE}/screener/refresh`, { method: "POST" });
        alert("Background rankings refresh triggered. Please check again in 1 minute!");
        fetchScreenerData();
      } catch (e) {
        alert("Failed to trigger update.");
      }
    }
  };

  // ------------------------------------------------
  // Formatting Helpers
  // ------------------------------------------------
  const formatVal = (val: any, formatType = "decimal") => {
    if (val === undefined || val === null || val === "") return "—";
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);

    switch (formatType) {
      case "currency":
        return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "percent_fraction":
        return `${(num * 100).toFixed(2)}%`;
      case "percent_value":
        return `${num.toFixed(2)}%`;
      case "ratio":
        return `${num.toFixed(2)}x`;
      case "large_number": {
        const absVal = Math.abs(num);
        let divisor = 1;
        let suffix = "";
        if (absVal >= 1e12) { divisor = 1e12; suffix = " T"; }
        else if (absVal >= 1e9) { divisor = 1e9; suffix = " B"; }
        else if (absVal >= 1e6) { divisor = 1e6; suffix = " M"; }
        return `${(num / divisor).toFixed(2)}${suffix}`;
      }
      default:
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  // ------------------------------------------------
  // Charts Data Prep
  // ------------------------------------------------
  const getMarginsChartData = () => {
    if (!selectedStock) return [];
    return [
      {
        name: "Gross Margin",
        value: (selectedStock.gross_margin || 0) * 100,
        fill: "#4f46e5"
      },
      {
        name: "EBIT Margin",
        value: (selectedStock.ebit_margin || 0) * 100,
        fill: "#10b981"
      },
      {
        name: "Tax Rate",
        value: (selectedStock.tax_rate || 0) * 100,
        fill: "#ef4444"
      }
    ];
  };

  const getEfficiencyChartData = () => {
    if (!selectedStock) return [];
    return [
      {
        name: "ROE (Return on Equity)",
        value: (selectedStock.roe || 0) * 100,
        fill: "#8b5cf6"
      },
      {
        name: "ROIC (Invested Capital)",
        value: (selectedStock.roic || 0) * 100,
        fill: "#3b82f6"
      }
    ];
  };

  const getScreenerCsvData = () => {
    const headers = ["Rank", "Ticker", "Company Name", "Price", "Market Cap", "Country"];
    const rows = filteredStocks.map(s => [
      s.rank,
      s.ticker || s.symbol,
      s.company_name,
      s.price_per_share || s.share_price,
      s.market_cap || s.market_cap_formatted,
      s.country
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "screener_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleChecklistSort = () => {
    setChecklistSortOrder(checklistSortOrder === "asc" ? "desc" : "asc");
  };

  const getSortedChecklistStocks = () => {
    const list = [...filteredStocks];
    list.sort((a, b) => {
      const scoreA = evaluateChecklist(a).totalScore;
      const scoreB = evaluateChecklist(b).totalScore;
      
      if (scoreA !== scoreB) {
        return checklistSortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
      }
      return (a.rank || 999) - (b.rank || 999);
    });
    return list;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d11]">
      
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-[#0a0a0f] border-r border-[#1a1a24] flex flex-col justify-between shrink-0">
        <div>
          {/* Header Title */}
          <div className="p-6 border-b border-[#1a1a24] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25">📈</div>
            <span className="font-bold text-lg tracking-wider text-white">INVEST.API</span>
          </div>

          {/* Quick Search */}
          <div className="p-4 border-b border-[#1a1a24]">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Auditor Quick Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Ticker (e.g. AAPL)"
                value={auditorTicker}
                onChange={(e) => setAuditorTicker(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runStockAudit(auditorTicker)}
                className="w-full bg-[#14141e] border border-[#232332] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button 
                onClick={() => runStockAudit(auditorTicker)}
                className="absolute right-2 top-2 text-slate-400 hover:text-white"
              >
                <Search size={16} />
              </button>
            </div>
            {auditorLoading && <p className="text-xs text-amber-500 mt-2 animate-pulse">Fetching details...</p>}
            {auditorError && <p className="text-xs text-rose-500 mt-2 font-medium">{auditorError}</p>}
          </div>

          {/* Side Menu Tab selectors */}
          <nav className="p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab("screener")}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm transition-all ${
                activeTab === "screener"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                  : "text-slate-400 hover:bg-[#14141e] hover:text-white"
              }`}
            >
              <Activity size={18} />
              Global Stock Screener
            </button>

            <button
              onClick={() => setActiveTab("checklist")}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm transition-all ${
                activeTab === "checklist"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                  : "text-slate-400 hover:bg-[#14141e] hover:text-white"
              }`}
            >
              <ClipboardList size={18} />
              Checklist Ranker
            </button>

            <button
              onClick={() => setActiveTab("auditor")}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 font-semibold text-sm transition-all ${
                activeTab === "auditor"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                  : "text-slate-400 hover:bg-[#14141e] hover:text-white"
              }`}
            >
              <SlidersHorizontal size={18} />
              Fundamental Auditor
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-[#1a1a24] flex flex-col gap-3">
          <button
            onClick={getScreenerCsvData}
            disabled={filteredStocks.length === 0}
            className="w-full bg-[#161622] hover:bg-[#202030] text-slate-300 hover:text-white border border-[#262638] rounded-xl py-2 px-4 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Export Selected to CSV
          </button>

          <button
            onClick={triggerDbRefresh}
            disabled={dbStatus === "updating"}
            className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl py-2 px-4 text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={dbStatus === "updating" ? "animate-spin" : ""} />
            {dbStatus === "updating" ? "Database Scraper Active..." : "Update Screener Rankings"}
          </button>

          <div className="text-[10px] text-slate-500 text-center font-medium">
            Database Status: <span className="text-emerald-500 font-bold uppercase">{dbStatus}</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content panel */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0d0d11]">
        
        {/* Tab 1: Global Stock Screener */}
        {activeTab === "screener" && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
            
            {/* Header section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">Global Stock Screener</h1>
                <p className="text-xs text-slate-400 mt-1">Screen and filter the top 1000 largest global companies across 17 fundamental variables.</p>
              </div>
              <div className="flex items-center gap-4 bg-[#14141e] border border-[#232332] rounded-xl px-4 py-2 text-xs">
                <span className="text-slate-400">Total Filtered:</span>
                <span className="font-bold text-white text-sm">{filteredStocks.length}</span>
              </div>
            </div>

            {/* Filter Bar Row */}
            <div className="flex items-center justify-between gap-4 bg-[#14141e] border border-[#222230] rounded-xl p-4 shrink-0">
              <div className="flex items-center gap-4 flex-1">
                {/* Text Filter */}
                <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or ticker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Country Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Country:</span>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="bg-[#0d0d12] border border-[#22222f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="All">All Countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="bg-[#0d0d12] border border-[#22222f] text-slate-300 hover:text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <SlidersHorizontal size={14} />
                  {showAdvancedFilters ? "Hide Filters" : "Show Filters"}
                </button>

                <button
                  onClick={clearAllFilters}
                  className="text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Collapsible Parameter Ranges Frame */}
            {showAdvancedFilters && (
              <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6 grid grid-cols-6 gap-6 shrink-0 shadow-lg shadow-black/20">
                
                {/* 1. Price */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Stock Price ($)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Forward PE */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Forward PE</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={peMin} onChange={(e) => setPeMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={peMax} onChange={(e) => setPeMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. ROIC */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">ROIC (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={roicMin} onChange={(e) => setRoicMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={roicMax} onChange={(e) => setRoicMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Debt/Equity */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Debt / Equity</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={deMin} onChange={(e) => setDeMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={deMax} onChange={(e) => setDeMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 5. Gross Margin */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Gross Margin (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={grossMin} onChange={(e) => setGrossMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={grossMax} onChange={(e) => setGrossMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 6. Free Cash Flow */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">FCF ($B)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" placeholder="Min" value={fcfMin} onChange={(e) => setFcfMin(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="number" placeholder="Max" value={fcfMax} onChange={(e) => setFcfMax(e.target.value)}
                      className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* Giant Screener Table Frame (with double scrollbars) */}
            <div className="flex-1 min-h-0 bg-[#14141e] border border-[#222230] rounded-xl overflow-hidden flex flex-col">
              
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left select-none relative">
                  <thead className="sticky top-0 bg-[#20202e] border-b border-[#2d2d3e] text-slate-300 font-bold z-10">
                    <tr>
                      {self_columns.map((col) => (
                        <th 
                          key={col} 
                          onClick={() => handleSort(col)}
                          className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-[#2d2d3e] text-center whitespace-nowrap"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {col}
                            {sortColumn === col ? (
                              sortOrder === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            ) : null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-[#1e1e2c]">
                    {filteredStocks.map((s, idx) => (
                      <tr 
                        key={s.symbol || s.ticker || idx}
                        onDoubleClick={() => runStockAudit(s.ticker || s.symbol)}
                        className="hover:bg-[#1c1c2b] active:bg-[#202030] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">{s.rank}</td>
                        <td className="px-4 py-3 text-xs font-bold text-white text-center">{s.ticker || s.symbol}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-200 text-left min-w-[200px]">{s.company_name}</td>
                        <td className="px-4 py-3 text-xs text-emerald-400 font-bold text-center">
                          {formatVal(s.price_per_share || s.share_price, "currency")}
                        </td>
                        <td className="px-4 py-3 text-xs text-center font-medium">
                          {s.market_cap || s.market_cap_formatted || formatVal(s.market_cap_raw, "large_number")}
                        </td>
                        
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.forward_pe_ratio, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.eps_forward, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium text-amber-500 font-bold">{formatVal(s.eps_growth_5y_forward_cagr, "percent_value")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.free_cash_flow, "large_number")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.beta, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-bold text-blue-400">{formatVal(s.roic, "percent_fraction")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.ps_ratio, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.ebit_margin, "percent_fraction")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.tax_rate, "percent_fraction")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.gross_margin, "percent_fraction")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.roe, "percent_fraction")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.de_ratio, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.current_ratio, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center font-medium">{formatVal(s.ev_sales, "decimal")}</td>
                        <td className="px-4 py-3 text-xs text-center text-slate-400 font-medium">{s.country}</td>
                      </tr>
                    ))}
                    {filteredStocks.length === 0 && (
                      <tr>
                        <td colSpan={20} className="text-center py-20 text-slate-500 font-medium">
                          No stocks found matching the criteria. Click "Reset" to clear filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Fundamental Auditor */}
        {activeTab === "auditor" && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-6">
            
            {/* Ticker Information Header */}
            {selectedStock ? (
              <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6 flex justify-between items-center shrink-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white">{selectedStock.company_name}</h2>
                    <span className="bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                      {selectedStock.symbol}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Sector: <span className="font-semibold text-white">{selectedStock.sector}</span>   |   
                    Industry: <span className="font-semibold text-white">{selectedStock.industry}</span>
                  </p>
                </div>
                
                {/* Price Display */}
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-emerald-400">
                    {formatVal(selectedStock.price_per_share, "currency")}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">Price per Share</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#14141e] border border-[#222230] rounded-xl py-40">
                <span className="text-5xl mb-6">📊</span>
                <h3 className="font-bold text-lg text-white">No stock selected for fundamental audit</h3>
                <p className="text-xs text-slate-400 mt-2">Double-click a row in the Stock Screener or type a symbol in the sidebar.</p>
              </div>
            )}

            {selectedStock && (
              <div className="flex flex-col gap-6">
                
                {/* Quadrants Grid */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* Category 1: Valuation */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6">
                    <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-4">Valuation Multiples</h4>
                    <div className="divide-y divide-[#1f1f2e]">
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Forward PE Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.forward_pe_ratio, "decimal")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Industry PE Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.industry_pe, "decimal")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">P/S Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.ps_ratio, "decimal")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">EV/Sales Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.ev_sales, "decimal")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: Profitability */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6">
                    <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-4">Profitability & Efficiency</h4>
                    <div className="divide-y divide-[#1f1f2e]">
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Return on Equity (ROE)</span>
                        <span className="text-sm font-bold text-emerald-400">{formatVal(selectedStock.roe, "percent_fraction")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Return on Invested Capital (ROIC)</span>
                        <span className="text-sm font-bold text-blue-400">{formatVal(selectedStock.roic, "percent_fraction")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Gross Margin</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.gross_margin, "percent_fraction")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">EBIT Margin</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.ebit_margin, "percent_fraction")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Financial Health */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6">
                    <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-4">Financial Health & Debt</h4>
                    <div className="divide-y divide-[#1f1f2e]">
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Debt/Equity Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.de_ratio, "ratio")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Current Ratio</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.current_ratio, "ratio")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Beta (Volatility)</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.beta, "decimal")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Shares Outstanding</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.shares_outstanding, "large_number")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Category 4: Growth & Cash Flow */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6">
                    <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-4">Growth & Cash Flow</h4>
                    <div className="divide-y divide-[#1f1f2e]">
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">EPS Forward</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.eps_forward, "decimal")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">EPS Growth 5Y CAGR</span>
                        <span className="text-sm font-bold text-amber-500">{formatVal(selectedStock.eps_growth_5y_forward_cagr, "percent_value")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Free Cash Flow</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.free_cash_flow, "large_number")}</span>
                      </div>
                      <div className="flex justify-between py-3">
                        <span className="text-xs text-slate-400">Estimated Tax Rate</span>
                        <span className="text-sm font-bold text-white">{formatVal(selectedStock.tax_rate, "percent_fraction")}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Animated Recharts Visuals Row */}
                <div className="grid grid-cols-2 gap-6 pb-12">
                  
                  {/* Chart 1: Profitability Margins comparison */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6 flex flex-col h-96">
                    <h4 className="font-bold text-sm text-slate-300 mb-6 uppercase tracking-wider">Profitability Margins (%)</h4>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getMarginsChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222230" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#1e1e2a", borderColor: "#2d2d3e" }} 
                            labelStyle={{ color: "#ffffff" }}
                          />
                          <Bar dataKey="value" name="Margin %" radius={[4, 4, 0, 0]} barSize={40}>
                            {getMarginsChartData().map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Capital Efficiency (ROE vs ROIC) */}
                  <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6 flex flex-col h-96">
                    <h4 className="font-bold text-sm text-slate-300 mb-6 uppercase tracking-wider">Capital Return Efficiency (%)</h4>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getEfficiencyChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222230" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#1e1e2a", borderColor: "#2d2d3e" }}
                            labelStyle={{ color: "#ffffff" }}
                          />
                          <Bar dataKey="value" name="Return %" radius={[4, 4, 0, 0]} barSize={40}>
                            {getEfficiencyChartData().map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* Single Stock Checklist Audit Section */}
                <div className="bg-[#14141e] border border-[#222230] rounded-xl p-6 mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ClipboardList size={16} className="text-blue-500" />
                      Portfolio Checklist Audit
                    </h4>
                    <div className="text-xs bg-slate-900 px-3 py-1 rounded-full text-slate-400 font-semibold">
                      Total Score: <span className="font-bold text-white">{evaluateChecklist(selectedStock).totalScore} / {evaluateChecklist(selectedStock).maxScore} Passed</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {evaluateChecklist(selectedStock).checks.map((chk, i) => (
                      <div 
                        key={i} 
                        className={`flex items-start gap-3 p-4 rounded-xl border ${
                          chk.pass 
                            ? "bg-emerald-500/5 border-emerald-500/10" 
                            : "bg-red-500/5 border-red-500/10"
                        }`}
                      >
                        <span className="text-lg mt-0.5">{chk.pass ? "✅" : "⚠️"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-slate-300">{chk.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                              chk.pass ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {chk.pass ? "PASS" : "FAIL"}
                            </span>
                          </div>
                          <p className="text-xs text-white font-medium mt-1.5 leading-relaxed">{chk.text}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{chk.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Tab 3: Checklist Ranker */}
        {activeTab === "checklist" && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">Excel Checklist Ranker</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Ranks the top 1000 global stocks by how many criteria they pass from your portfolio checklist (out of 12 checks).
                </p>
              </div>
              <div className="flex items-center gap-4 bg-[#14141e] border border-[#232332] rounded-xl px-4 py-2 text-xs">
                <span className="text-slate-400">Total Analyzed:</span>
                <span className="font-bold text-white text-sm">{filteredStocks.length}</span>
              </div>
            </div>

            {/* Search & Country Filter Row */}
            <div className="flex items-center justify-between gap-4 bg-[#14141e] border border-[#222230] rounded-xl p-4 shrink-0">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or ticker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0d0d12] border border-[#22222f] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Country:</span>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="bg-[#0d0d12] border border-[#22222f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="All">All Countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={clearAllFilters}
                className="text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Clear Filters
              </button>
            </div>

            {/* Table Container */}
            <div className="flex-1 min-h-0 bg-[#14141e] border border-[#222230] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/20">
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left select-none relative">
                  <thead className="sticky top-0 bg-[#20202e] border-b border-[#2d2d3e] text-slate-300 font-bold z-10">
                    <tr>
                      <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-center">Rank</th>
                      <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wider">Ticker</th>
                      <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wider">Company Name</th>
                      <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-[#20202e]" onClick={handleChecklistSort}>
                        <div className="flex items-center justify-center gap-1.5">
                          Score
                          {checklistSortOrder === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </div>
                      </th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">PE vs Group</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">Under Valued</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">PEG &lt; 1</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">ROIC vs WACC</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">PE vs ROIC</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">EV/Sales Check</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">Growth &ge; 10%</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">Gross Marg</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">D/E &lt; 1.0</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">ROE vs CoE</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">Capital Return</th>
                      <th className="px-2 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap">Price/Growth</th>
                      <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2c]">
                    {getSortedChecklistStocks().map((s) => {
                      const { checks, totalScore, maxScore } = evaluateChecklist(s);
                      return (
                        <tr 
                          key={s.symbol || s.ticker}
                          className="hover:bg-[#1a1a26] transition-colors cursor-pointer border-b border-[#1e1e2c]"
                          onClick={() => {
                            setSelectedStock(s);
                            setAuditorTicker(s.symbol || s.ticker);
                          }}
                          onDoubleClick={() => {
                            setSelectedStock(s);
                            setAuditorTicker(s.symbol || s.ticker);
                            setActiveTab("auditor");
                          }}
                        >
                          <td className="px-4 py-3 text-xs text-center text-slate-400 font-mono">{s.rank}</td>
                          <td className="px-4 py-3 text-xs font-bold text-white font-mono">{s.symbol || s.ticker}</td>
                          <td className="px-4 py-3 text-xs text-slate-300 max-w-[200px] truncate">{s.company_name}</td>
                          <td className="px-2 py-3 text-xs text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-extrabold px-2 py-0.5 rounded text-xs ${
                                totalScore >= 9 ? "bg-emerald-500/10 text-emerald-400" :
                                totalScore >= 6 ? "bg-amber-500/10 text-amber-400" :
                                "bg-red-500/10 text-red-400"
                              }`}>
                                {totalScore} / {maxScore}
                              </span>
                              {/* Micro Progress Bar */}
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={`h-full ${
                                    totalScore >= 9 ? "bg-emerald-400" :
                                    totalScore >= 6 ? "bg-amber-400" :
                                    "bg-red-400"
                                  }`}
                                  style={{ width: `${(totalScore / maxScore) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-xs text-center">{checks[0].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[1].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[2].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[3].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[4].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[5].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[6].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[7].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[8].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[9].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[10].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">{checks[11].pass ? "✅" : "❌"}</td>
                          <td className="px-2 py-3 text-xs text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStock(s);
                                setAuditorTicker(s.symbol || s.ticker);
                                setActiveTab("auditor");
                              }}
                              className="bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded px-2.5 py-1 text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              Audit Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}



// ------------------------------------------------
// Checklist Evaluation Logic (Port.xlsx replication)
// ------------------------------------------------
function evaluateChecklist(s: any) {
  if (!s) return { checks: [], totalScore: 0, maxScore: 11 };

  const priceVal = s.price_per_share || s.share_price || 0;
  const price = typeof priceVal === "string" ? parseFloat(priceVal.replace(/[$,]/g, "")) : parseFloat(priceVal) || 0;
  const industry_pe = parseFloat(s.industry_pe) || 20.0;
  const eps_forward = parseFloat(s.eps_forward) || 0;
  const forward_pe = parseFloat(s.forward_pe_ratio) || 0;
  const growth = parseFloat(s.eps_growth_5y_forward_cagr) || 0;
  const roic = parseFloat(s.roic) || 0; 
  const roe = parseFloat(s.roe) || 0; 
  const de_ratio = parseFloat(s.de_ratio) || 0;
  const gross_margin = parseFloat(s.gross_margin) || 0; 
  const ebit_margin = parseFloat(s.ebit_margin) || 0; 
  const ev_sales = parseFloat(s.ev_sales) || 0;
  const beta = parseFloat(s.beta) || 1.0;
  const tax_rate = 0.21; 
  
  const peg_ratio = growth > 0 ? (forward_pe / growth) : 999;

  // WACC and CoE Calculation
  const risk_free_rate = 0.0458;
  const equity_risk_premium = 0.0433;
  const coe = equity_risk_premium + risk_free_rate * beta;
  
  const cod = 0.06;
  const weight_equity = 1.0 / (1.0 + de_ratio);
  const weight_debt = de_ratio / (1.0 + de_ratio);
  const wacc = weight_equity * coe + weight_debt * cod * (1.0 - tax_rate);

  const checks = [];

  // Check 1: PE vs Industry PE
  const peVsIndustryPass = forward_pe > 0 && forward_pe < industry_pe;
  checks.push({
    name: "PE vs Group Benchmark",
    pass: peVsIndustryPass,
    text: peVsIndustryPass ? "✅ PE ต่ำกว่ากลุ่มเดียวกัน" : "⚠️ PE สูงกว่ากลุ่มเดียวกัน",
    details: `PE: ${forward_pe.toFixed(2)}x vs Industry: ${industry_pe.toFixed(2)}x`
  });

  // Check 2: Price vs Estimated Valuation (Industry PE * EPS Forward)
  const estValuation = industry_pe * eps_forward;
  const priceVsValuationPass = eps_forward > 0 && price < estValuation;
  let valText = "";
  if (eps_forward <= 0) {
    valText = "⚠️ ไม่มีข้อมูลกำไรคาดการณ์";
  } else {
    const diffPct = Math.abs((estValuation - price) / estValuation) * 100;
    valText = priceVsValuationPass
      ? `✅ ต่ำกว่าราคาประเมินอยู่ ${diffPct.toFixed(2)}%`
      : `⚠️ สูงกว่าราคาประเมินอยู่ ${diffPct.toFixed(2)}%`;
  }
  checks.push({
    name: "Price vs Valuation",
    pass: priceVsValuationPass,
    text: valText,
    details: eps_forward > 0 ? `Est: $${estValuation.toFixed(2)} vs Price: $${price.toFixed(2)}` : "No EPS data"
  });

  // Check 3: PEG Ratio < 1
  const pegPass = growth > 0 && peg_ratio < 1;
  checks.push({
    name: "PEG Ratio Check",
    pass: pegPass,
    text: pegPass ? "✅ PEG < 1 = โตเร็วแต่ยังถูก" : "⚠️ PEG > 1 = ต้องโตให้คุ้มราคานี้",
    details: growth > 0 ? `PEG: ${peg_ratio.toFixed(2)}x` : "No growth data"
  });

  // Check 4: ROIC vs WACC
  const roicVsWaccPass = roic > wacc;
  checks.push({
    name: "ROIC vs WACC (Value Creation)",
    pass: roicVsWaccPass,
    text: roicVsWaccPass ? "✅ เพิ่มมูลค่า (ROIC > WACC)" : "⚠️ ทำลายมูลค่า (ROIC < WACC)",
    details: `ROIC: ${(roic * 100).toFixed(2)}% vs WACC: ${(wacc * 100).toFixed(2)}%`
  });

  // Check 5: PE vs ROIC
  const peVsRoicPass = roic > 0 && forward_pe < (roic * 100);
  checks.push({
    name: "PE vs ROIC Benchmark",
    pass: peVsRoicPass,
    text: peVsRoicPass ? "✅ PE ต่ำกว่า ROIC = น่าสนใจ" : "⚠️ PE สูงกว่า ROIC = ต้องโตให้คุ้ม",
    details: `PE: ${forward_pe.toFixed(2)}x vs ROIC: ${(roic * 100).toFixed(2)}%`
  });

  // Check 6: EV/Sales vs Op Margin / 2
  const atomHalf = (ebit_margin * 100 * (1.0 - tax_rate)) / 2.0;
  const evSalesPass = ev_sales > 0 && ev_sales <= atomHalf;
  checks.push({
    name: "EV/Sales Valuation Limit",
    pass: evSalesPass,
    text: evSalesPass ? "✅ EV/Sales ต่ำกว่าหรือเท่ากับ ATOM ÷ 2" : "⚠️ EV/Sales แพงเกินกำไรตอนนี้",
    details: `EV/Sales: ${ev_sales.toFixed(2)}x vs ATOM/2 Limit: ${atomHalf.toFixed(2)}%`
  });

  // Check 7: Growth Rate (SGR)
  const growthPass = growth > 20; // Only pass if it is in the "Very Good" (Growth Stock) category
  let growthText = "⚠️ โตช้าเหมาะ Defensive";
  if (growth > 20) growthText = "✅ โตเร็วระดับ Growth Stock";
  else if (growth >= 10) growthText = "⚡ โตดีระดับ Core Holding";
  checks.push({
    name: "Growth Classification",
    pass: growthPass,
    text: growthText,
    details: `5Y Growth: ${growth.toFixed(2)}%`
  });

  // Check 8: Gross Margin Moat
  const grossMarginPass = gross_margin > 0.60; // Only pass if it is "Very Good" (>60%)
  let gmText = "❌ Margin ต่ำ ต้องใช้ Volume หรือ Scale เล่น";
  if (gross_margin > 0.60) gmText = "✅ Margin สูง แข่งขันได้ด้วย Brand/Technology";
  else if (gross_margin > 0.40) gmText = "⚠️ Margin ปานกลาง ต้องดู Efficiency เพิ่ม";
  checks.push({
    name: "Gross Margin Moat",
    pass: grossMarginPass,
    text: gmText,
    details: `Gross Margin: ${(gross_margin * 100).toFixed(2)}%`
  });

  // Check 9: Debt / Equity Safety
  const dePass = de_ratio < 0.5; // Only pass if D/E is Low (<0.5)
  let deText = "❌ D/E สูง ระวังความเสี่ยงด้านเงินกู้";
  if (de_ratio < 0.5) deText = "✅ D/E ต่ำ ความเสี่ยงต่ำ";
  else if (de_ratio <= 1.0) deText = "⚠️ D/E ปานกลาง ต้องดู FCF ประกอบ";
  checks.push({
    name: "Financial Leverage (D/E)",
    pass: dePass,
    text: deText,
    details: `D/E Ratio: ${de_ratio.toFixed(2)}`
  });

  // Check 10: ROE vs Cost of Equity
  const roeVsCoePass = roe > coe;
  checks.push({
    name: "ROE vs Cost of Equity",
    pass: roeVsCoePass,
    text: roeVsCoePass ? "✅ ROE > CoE = เพิ่มมูลค่า" : "❌ ROE < CoE = ไม่สร้างมูลค่า",
    details: `ROE: ${(roe * 100).toFixed(2)}% vs CoE: ${(coe * 100).toFixed(2)}%`
  });

  // Check 11: ROE and DE Matrix
  let matrixText = "กลาง ๆ: กำไรไม่เด่น หนี้ไม่เยอะ";
  let matrixPass = false;
  const roePct = roe * 100;
  if (roePct > 50 && de_ratio < 0.5) {
    matrixText = "ดีมาก: ROE สูงมาก หนี้ต่ำ";
    matrixPass = true; // Only pass if "Very Good" (ดีมาก)
  } else if (roePct > 15 && de_ratio < 1.0) {
    matrixText = "ดีพอใช้: กำไรดี หนี้ไม่เยอะ";
    matrixPass = false; // Medium (ดีพอใช้) does not pass
  } else if (roePct > 15 && de_ratio >= 1.0) {
    matrixText = "เสี่ยง: กำไรดีแต่หนี้สูง";
    matrixPass = false;
  } else if (roePct < 10 && de_ratio >= 1.0) {
    matrixText = "อ่อนแอ: กำไรต่ำ หนี้สูง";
    matrixPass = false;
  }
  checks.push({
    name: "Capital Efficiency Matrix",
    pass: matrixPass,
    text: matrixText,
    details: `ROE: ${roePct.toFixed(1)}%, DE: ${de_ratio.toFixed(2)}`
  });

  // Check 12: Price vs Growth check (using PEG)
  checks.push({
    name: "Price Valuation vs Growth",
    pass: pegPass,
    text: pegPass ? "✅ ราคาต่ำเมื่อเทียบกับ Growth" : "✘ ราคานำหน้า Growth",
    details: growth > 0 ? `PEG: ${peg_ratio.toFixed(2)}x` : "No growth data"
  });

  const totalScore = checks.filter(c => c.pass).length;

  return {
    checks,
    totalScore,
    maxScore: checks.length
  };
}

// Full Columns list variable
const self_columns = [
  "Rank", "Ticker", "Company Name", "Price", "Market Cap", 
  "Forward PE", "Forward EPS", "5Y Growth", "FCF", "Beta", 
  "ROIC", "PS Ratio", "EBIT Margin", "Tax Rate", "Gross Margin", 
  "ROE", "DE Ratio", "Current Ratio", "EV Sales", "Country"
];
