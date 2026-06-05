import os
import sys
import threading
import csv
import json

# Gracefully handle missing tkinter
try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    import customtkinter as ctk
except ModuleNotFoundError:
    print("\n" + "="*80)
    print("CRITICAL ERROR: The 'tkinter' or 'customtkinter' module is missing.")
    print("To run this desktop GUI application, you need to install python-tk.")
    print("\nOn Debian/Ubuntu systems, run:")
    print("    sudo apt-get update && sudo apt-get install -y python3-tk")
    print("\nOn Fedora/RedHat systems, run:")
    print("    sudo dnf install python3-tkinter")
    print("\nOn macOS (with Homebrew), run:")
    print("    brew install python-tk")
    print("="*80 + "\n")
    sys.exit(1)

# Import retriever module
try:
    import invest_retriever
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import invest_retriever

# Set appearance and theme
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class InvestmentApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Configure window settings
        self.title("Antigravity Investment Terminal & Screener")
        self.geometry("1200x850")
        self.minsize(1050, 750)

        # Cache variables
        self.stock_data = {}
        self.companies_list = []
        self.load_top_500_data()

        # Track sorting order for each column
        self.sort_states = {}
        self.show_advanced_filters = True  # Show filters by default

        # ---------------------------------------------
        # Main Layout Grid (Sidebar + Tabs Panel)
        # ---------------------------------------------
        self.grid_columnconfigure(0, weight=0, minsize=260)  # Left Sidebar
        self.grid_columnconfigure(1, weight=1)              # Main Content Area
        self.grid_rowconfigure(0, weight=1)

        # 1. Left Sidebar
        self.create_sidebar()

        # 2. Main Content Tabview
        self.tabview = ctk.CTkTabview(self, fg_color="#1A1A1E")
        self.tabview.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)

        # Create individual tabs
        self.screener_tab = self.tabview.add("Global Stock Screener")
        self.auditor_tab = self.tabview.add("Fundamental Auditor")

        # Set up contents for each tab
        self.setup_screener_tab()
        self.setup_auditor_tab()

    # ---------------------------------------------
    # Sidebar Setup
    # ---------------------------------------------
    def create_sidebar(self):
        self.sidebar_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="#121214")
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(11, weight=1)  # Spacer row

        # App Title
        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="📈 INVEST TERMINAL", 
            font=ctk.CTkFont(size=20, weight="bold")
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(30, 20), sticky="w")

        self.desc_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="Global Stock Screener & Fundamental\nAnalysis Terminal.",
            font=ctk.CTkFont(size=12),
            text_color="#8A8A8E",
            justify="left"
        )
        self.desc_label.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="w")

        # Custom Ticker Search Box
        self.ticker_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="Auditor Quick Search:", 
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.ticker_label.grid(row=2, column=0, padx=20, pady=(10, 5), sticky="w")

        self.ticker_entry = ctk.CTkEntry(
            self.sidebar_frame, 
            placeholder_text="Enter Ticker (e.g. NVDA)",
            height=35
        )
        self.ticker_entry.grid(row=3, column=0, padx=20, pady=5, sticky="ew")
        self.ticker_entry.bind("<Return>", lambda event: self.start_fetch_data())

        self.search_btn = ctk.CTkButton(
            self.sidebar_frame, 
            text="Fetch Fundamental Data", 
            command=self.start_fetch_data,
            height=35,
            font=ctk.CTkFont(weight="bold")
        )
        self.search_btn.grid(row=4, column=0, padx=20, pady=15, sticky="ew")

        # Status Label
        self.status_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="Status: Ready", 
            font=ctk.CTkFont(size=12, slant="italic"),
            text_color="#3B82F6"
        )
        self.status_label.grid(row=5, column=0, padx=20, pady=5, sticky="w")

        self.divider = ctk.CTkFrame(self.sidebar_frame, height=2, fg_color="#2E2E33")
        self.divider.grid(row=6, column=0, padx=20, pady=20, sticky="ew")

        # Export Tools
        self.actions_label = ctk.CTkLabel(
            self.sidebar_frame, 
            text="Auditor Export Options:", 
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.actions_label.grid(row=7, column=0, padx=20, pady=(0, 5), sticky="w")

        self.export_csv_btn = ctk.CTkButton(
            self.sidebar_frame, 
            text="📥 Export to CSV", 
            command=self.export_csv,
            fg_color="#1E293B",
            hover_color="#334155",
            state="disabled"
        )
        self.export_csv_btn.grid(row=8, column=0, padx=20, pady=5, sticky="ew")

        self.export_json_btn = ctk.CTkButton(
            self.sidebar_frame, 
            text="📥 Export to JSON", 
            command=self.export_json,
            fg_color="#1E293B",
            hover_color="#334155",
            state="disabled"
        )
        self.export_json_btn.grid(row=9, column=0, padx=20, pady=5, sticky="ew")

        self.crawler_btn = ctk.CTkButton(
            self.sidebar_frame,
            text="🔄 Refresh Screener Data",
            command=self.trigger_refresh_rankings,
            fg_color="#0F172A",
            hover_color="#1E293B",
            text_color="#94A3B8"
        )
        self.crawler_btn.grid(row=10, column=0, padx=20, pady=15, sticky="ew")

        self.footer_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="Powered by yfinance & CMC",
            font=ctk.CTkFont(size=10),
            text_color="#4B5563"
        )
        self.footer_label.grid(row=12, column=0, padx=20, pady=20, sticky="s")

    # ---------------------------------------------
    # Tab 1: Global Stock Screener Setup
    # ---------------------------------------------
    def setup_screener_tab(self):
        self.screener_tab.grid_columnconfigure(0, weight=1)
        self.screener_tab.grid_rowconfigure(0, weight=0)  # Basic Filter Row
        self.screener_tab.grid_rowconfigure(1, weight=0)  # Advanced Parameter Filters Row
        self.screener_tab.grid_rowconfigure(2, weight=1)  # Table Row

        # 1. Basic Filter Container Frame
        filter_frame = ctk.CTkFrame(self.screener_tab, fg_color="transparent")
        filter_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=5)
        filter_frame.grid_columnconfigure(3, weight=1)

        # Name/Ticker Filter Entry
        filter_lbl = ctk.CTkLabel(filter_frame, text="Filter Symbol/Name:", font=ctk.CTkFont(size=13, weight="bold"))
        filter_lbl.grid(row=0, column=0, padx=(5, 10), pady=5, sticky="w")

        self.filter_entry = ctk.CTkEntry(filter_frame, placeholder_text="Type to filter...", width=200)
        self.filter_entry.grid(row=0, column=1, padx=(0, 20), pady=5)
        self.filter_entry.bind("<KeyRelease>", lambda e: self.apply_screener_filters())

        # Country Filter Options
        country_lbl = ctk.CTkLabel(filter_frame, text="Country:", font=ctk.CTkFont(size=13, weight="bold"))
        country_lbl.grid(row=0, column=2, padx=(5, 10), pady=5, sticky="w")

        self.country_option = ctk.CTkOptionMenu(
            filter_frame, 
            values=["All"] + self.get_available_countries(),
            command=lambda v: self.apply_screener_filters()
        )
        self.country_option.grid(row=0, column=3, padx=(0, 20), pady=5, sticky="w")

        # Toggle Button for Advanced Filters
        self.toggle_filters_btn = ctk.CTkButton(
            filter_frame,
            text="Filter Parameters ⚙️",
            command=self.toggle_filter_panel,
            width=140,
            fg_color="#1E293B",
            hover_color="#334155"
        )
        self.toggle_filters_btn.grid(row=0, column=4, padx=5, pady=5, sticky="e")

        # 2. Advanced Parameter Filters Grid Panel (Initially visible)
        self.filter_panel_frame = ctk.CTkFrame(
            self.screener_tab, 
            fg_color="#1E1E22", 
            border_width=1, 
            border_color="#2E2E33",
            corner_radius=8
        )
        self.filter_panel_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
        self.setup_advanced_filter_widgets()

        # 3. Table Setup
        # Configure tkinter style dictionary to customize standard Treeview to match Dark Mode
        style = ttk.Style()
        style.theme_use("default")
        style.configure("Treeview", 
                        background="#1A1A1E", 
                        foreground="#F3F4F6", 
                        rowheight=28, 
                        fieldbackground="#1A1A1E", 
                        bordercolor="#2E2E33", 
                        borderwidth=0)
        style.map('Treeview', background=[('selected', '#1D4ED8')])
        style.configure("Treeview.Heading", 
                        background="#27272A", 
                        foreground="#E5E7EB", 
                        font=("Calibri", 11, "bold"),
                        relief="flat")
        style.map("Treeview.Heading", background=[('active', '#3F3F46')])

        # Table Wrapper Frame (Allows Grid with Scrollbars)
        self.table_container = ctk.CTkFrame(self.screener_tab, fg_color="#1E1E22", border_width=1, border_color="#2E2E33")
        self.table_container.grid(row=2, column=0, sticky="nsew", padx=10, pady=(5, 10))
        self.table_container.grid_columnconfigure(0, weight=1)
        self.table_container.grid_rowconfigure(0, weight=1)

        # Giant list of columns (showing all 17 fundamental parameters)
        self.columns = (
            "Rank", "Ticker", "Company Name", "Price", "Market Cap", 
            "Forward PE", "Forward EPS", "5Y Growth", "FCF", "Beta", 
            "ROIC", "PS Ratio", "EBIT Margin", "Tax Rate", "Gross Margin", 
            "ROE", "DE Ratio", "Current Ratio", "EV Sales", "Country"
        )
        
        self.tree = ttk.Treeview(
            self.table_container, 
            columns=self.columns, 
            show="headings", 
            style="Treeview"
        )
        self.tree.grid(row=0, column=0, sticky="nsew")

        v_scrollbar = ttk.Scrollbar(self.table_container, orient="vertical", command=self.tree.yview)
        v_scrollbar.grid(row=0, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=v_scrollbar.set)

        h_scrollbar = ttk.Scrollbar(self.table_container, orient="horizontal", command=self.tree.xview)
        h_scrollbar.grid(row=1, column=0, sticky="ew")
        self.tree.configure(xscrollcommand=h_scrollbar.set)

        column_widths = {
            "Rank": 50, "Ticker": 80, "Company Name": 200, "Price": 85, "Market Cap": 110,
            "Forward PE": 95, "Forward EPS": 95, "5Y Growth": 95, "FCF": 115, "Beta": 65,
            "ROIC": 85, "PS Ratio": 85, "EBIT Margin": 95, "Tax Rate": 85, "Gross Margin": 95,
            "ROE": 85, "DE Ratio": 85, "Current Ratio": 95, "EV Sales": 85, "Country": 100
        }

        for col in self.columns:
            width = column_widths.get(col, 90)
            anchor = "w" if col in ["Company Name"] else "center"
            self.tree.column(col, width=width, minwidth=width - 20, anchor=anchor)

        # Setup Header Actions (Sorting)
        for col in self.columns:
            self.sort_states[col] = False
            self.tree.heading(
                col, 
                text=col, 
                command=lambda c=col: self.sort_column_header(c)
            )

        # Event Bindings
        self.tree.bind("<Double-1>", self.on_tree_double_click)

        # Load data initially
        self.apply_screener_filters()

    # ---------------------------------------------
    # Advanced Parameter Filter Grid Layout
    # ---------------------------------------------
    def setup_advanced_filter_widgets(self):
        """Build the numeric range inputs grid for filtering each metric."""
        self.filter_panel_frame.grid_columnconfigure((0, 1, 2, 3, 4, 5), weight=1)

        # Helper to create label and min/max inputs
        def create_range_filter(row, col, title, key_name):
            frame = ctk.CTkFrame(self.filter_panel_frame, fg_color="transparent")
            frame.grid(row=row, column=col, padx=10, pady=8, sticky="ew")
            frame.grid_columnconfigure((1, 3), weight=1)

            lbl = ctk.CTkLabel(frame, text=title, font=ctk.CTkFont(size=11, weight="bold"), text_color="#A1A1AA")
            lbl.grid(row=0, column=0, columnspan=4, sticky="w", pady=(0, 2))

            min_in = ctk.CTkEntry(frame, placeholder_text="Min", height=24, font=ctk.CTkFont(size=11))
            min_in.grid(row=1, column=1, sticky="ew")
            min_in.bind("<KeyRelease>", lambda e: self.apply_screener_filters())

            to_lbl = ctk.CTkLabel(frame, text="to", font=ctk.CTkFont(size=10))
            to_lbl.grid(row=1, column=2, padx=4)

            max_in = ctk.CTkEntry(frame, placeholder_text="Max", height=24, font=ctk.CTkFont(size=11))
            max_in.grid(row=1, column=3, sticky="ew")
            max_in.bind("<KeyRelease>", lambda e: self.apply_screener_filters())

            return min_in, max_in

        # Row 0: Valuation
        self.filter_price_min, self.filter_price_max = create_range_filter(0, 0, "Stock Price ($):", "price")
        self.filter_pe_min, self.filter_pe_max = create_range_filter(0, 1, "Forward PE Ratio:", "pe")
        self.filter_roic_min, self.filter_roic_max = create_range_filter(0, 2, "ROIC (%):", "roic")
        self.filter_de_min, self.filter_de_max = create_range_filter(0, 3, "Debt/Equity Ratio:", "de")
        self.filter_gross_min, self.filter_gross_max = create_range_filter(0, 4, "Gross Margin (%):", "gross")
        self.filter_fcf_min, self.filter_fcf_max = create_range_filter(0, 5, "Free Cash Flow ($B):", "fcf")

        # Bottom Row: Apply / Clear Controls
        control_frame = ctk.CTkFrame(self.filter_panel_frame, fg_color="transparent")
        control_frame.grid(row=1, column=0, columnspan=6, padx=10, pady=(5, 10), sticky="e")

        apply_btn = ctk.CTkButton(
            control_frame, 
            text="Apply Screener Filters", 
            command=self.apply_screener_filters, 
            width=140, 
            height=26, 
            font=ctk.CTkFont(size=11, weight="bold")
        )
        apply_btn.grid(row=0, column=0, padx=5)

        reset_btn = ctk.CTkButton(
            control_frame, 
            text="Reset Parameters", 
            command=self.clear_all_filters, 
            width=120, 
            height=26, 
            fg_color="#334155", 
            hover_color="#475569", 
            font=ctk.CTkFont(size=11)
        )
        reset_btn.grid(row=0, column=1, padx=5)

    def toggle_filter_panel(self):
        """Expand or collapse the parameter filters panel."""
        self.show_advanced_filters = not self.show_advanced_filters
        if self.show_advanced_filters:
            self.filter_panel_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
            self.toggle_filters_btn.configure(text="Hide Parameters ⚙️")
        else:
            self.filter_panel_frame.grid_forget()
            self.toggle_filters_btn.configure(text="Filter Parameters ⚙️")

    def clear_all_filters(self):
        """Empty all inputs and refresh rankings."""
        for entry in [
            self.filter_price_min, self.filter_price_max,
            self.filter_pe_min, self.filter_pe_max,
            self.filter_roic_min, self.filter_roic_max,
            self.filter_de_min, self.filter_de_max,
            self.filter_gross_min, self.filter_gross_max,
            self.filter_fcf_min, self.filter_fcf_max
        ]:
            entry.delete(0, tk.END)

        self.filter_entry.delete(0, tk.END)
        self.country_option.set("All")
        self.apply_screener_filters()

    # ---------------------------------------------
    # Tab 2: Fundamental Auditor Setup
    # ---------------------------------------------
    def setup_auditor_tab(self):
        self.auditor_tab.grid_columnconfigure(0, weight=1)
        self.auditor_tab.grid_rowconfigure(0, weight=1)

        self.active_frame = ctk.CTkFrame(self.auditor_tab, fg_color="transparent")
        self.active_frame.grid(row=0, column=0, sticky="nsew")
        self.active_frame.grid_columnconfigure(0, weight=1)
        self.active_frame.grid_rowconfigure(0, weight=0)
        self.active_frame.grid_rowconfigure(1, weight=1)

        # Header Overview Card
        self.header_card = ctk.CTkFrame(self.active_frame, fg_color="#27272A", corner_radius=12, height=110)
        self.header_card.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 10))
        self.header_card.grid_columnconfigure(0, weight=1)
        self.header_card.grid_columnconfigure(1, weight=0)

        # Left Details
        self.header_left = ctk.CTkFrame(self.header_card, fg_color="transparent")
        self.header_left.grid(row=0, column=0, padx=20, pady=15, sticky="w")
        
        self.comp_name_label = ctk.CTkLabel(
            self.header_left, 
            text="No Stock Loaded", 
            font=ctk.CTkFont(size=22, weight="bold")
        )
        self.comp_name_label.grid(row=0, column=0, sticky="w")
        
        self.meta_label = ctk.CTkLabel(
            self.header_left, 
            text="Double-click any stock in the Screener tab or search above.", 
            font=ctk.CTkFont(size=13),
            text_color="#A1A1AA"
        )
        self.meta_label.grid(row=1, column=0, sticky="w", pady=(5, 0))

        # Right Price
        self.header_right = ctk.CTkFrame(self.header_card, fg_color="transparent")
        self.header_right.grid(row=0, column=1, padx=20, pady=15, sticky="e")

        self.price_label = ctk.CTkLabel(
            self.header_right, 
            text="$—", 
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color="#10B981"
        )
        self.price_label.grid(row=0, column=0, sticky="e")
        
        self.price_sub_label = ctk.CTkLabel(
            self.header_right, 
            text="Price per Share", 
            font=ctk.CTkFont(size=11),
            text_color="#A1A1AA"
        )
        self.price_sub_label.grid(row=1, column=0, sticky="e")

        # Scrollable metric grid panel
        self.scroll_container = ctk.CTkScrollableFrame(self.active_frame, fg_color="transparent")
        self.scroll_container.grid(row=1, column=0, sticky="nsew", padx=20, pady=(10, 20))
        
        self.setup_metric_grids()

    def setup_metric_grids(self):
        self.scroll_container.grid_columnconfigure(0, weight=1, pad=15)
        self.scroll_container.grid_columnconfigure(1, weight=1, pad=15)

        self.val_card = self.create_category_card("Valuation Multiples", 0, 0)
        self.val_metrics = self.populate_metric_slots(self.val_card, [
            ("Forward P/E", "forward_pe_ratio"),
            ("Industry P/E", "industry_pe"),
            ("P/S Ratio", "ps_ratio"),
            ("EV/Sales", "ev_sales")
        ])

        self.prof_card = self.create_category_card("Profitability & Efficiency", 0, 1)
        self.prof_metrics = self.populate_metric_slots(self.prof_card, [
            ("Return on Equity (ROE)", "roe"),
            ("Return on Invested Capital (ROIC)", "roic"),
            ("Gross Margin", "gross_margin"),
            ("EBIT Margin", "ebit_margin")
        ])

        self.health_card = self.create_category_card("Financial Health & Debt", 1, 0)
        self.health_metrics = self.populate_metric_slots(self.health_card, [
            ("Debt/Equity Ratio", "de_ratio"),
            ("Current Ratio", "current_ratio"),
            ("Beta (Volatility)", "beta"),
            ("Shares Outstanding", "shares_outstanding")
        ])

        self.growth_card = self.create_category_card("Growth & Forecasts", 1, 1)
        self.growth_metrics = self.populate_metric_slots(self.growth_card, [
            ("EPS Forward", "eps_forward"),
            ("EPS Growth 5Y CAGR", "eps_growth_5y_forward_cagr"),
            ("Free Cash Flow", "free_cash_flow"),
            ("Tax Rate", "tax_rate")
        ])

        self.metric_widgets = {}
        self.metric_widgets.update(self.val_metrics)
        self.metric_widgets.update(self.prof_metrics)
        self.metric_widgets.update(self.health_metrics)
        self.metric_widgets.update(self.growth_metrics)

    def create_category_card(self, title: str, row: int, col: int) -> ctk.CTkFrame:
        card_frame = ctk.CTkFrame(
            self.scroll_container, 
            fg_color="#1E1E22", 
            border_width=1, 
            border_color="#2E2E33",
            corner_radius=10
        )
        card_frame.grid(row=row, column=col, sticky="nsew", padx=10, pady=10)
        card_frame.grid_columnconfigure(0, weight=1)
        card_frame.grid_columnconfigure(1, weight=1)

        title_label = ctk.CTkLabel(
            card_frame, 
            text=title, 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#3B82F6"
        )
        title_label.grid(row=0, column=0, columnspan=2, padx=15, pady=(15, 10), sticky="w")
        
        card_divider = ctk.CTkFrame(card_frame, height=1, fg_color="#2E2E33")
        card_divider.grid(row=1, column=0, columnspan=2, padx=15, pady=(0, 10), sticky="ew")

        return card_frame

    def populate_metric_slots(self, card_frame: ctk.CTkFrame, metrics: list) -> dict:
        widgets = {}
        for idx, (label_text, key_name) in enumerate(metrics):
            row_idx = 2 + idx
            lbl = ctk.CTkLabel(card_frame, text=label_text, font=ctk.CTkFont(size=12), text_color="#9CA3AF")
            lbl.grid(row=row_idx, column=0, padx=15, pady=8, sticky="w")
            
            val_lbl = ctk.CTkLabel(card_frame, text="—", font=ctk.CTkFont(size=13, weight="bold"), text_color="#F3F4F6")
            val_lbl.grid(row=row_idx, column=1, padx=15, pady=8, sticky="e")
            widgets[key_name] = val_lbl
        return widgets

    # ---------------------------------------------
    # Data Loading
    # ---------------------------------------------
    def load_top_500_data(self):
        self.companies_list = []
        
        if os.path.exists("top_500_companies_detailed.json"):
            try:
                with open("top_500_companies_detailed.json", "r", encoding="utf-8") as f:
                    self.companies_list = json.load(f)
                    print(f"Loaded {len(self.companies_list)} stocks with full parameters.")
                    return
            except Exception as e:
                print("Error loading detailed JSON:", e)

        if os.path.exists("top_500_companies.json"):
            try:
                with open("top_500_companies.json", "r", encoding="utf-8") as f:
                    self.companies_list = json.load(f)
            except Exception as e:
                print("Error loading basic JSON:", e)

    def get_available_countries(self) -> list:
        countries = set()
        for c in self.companies_list:
            if c.get("country"):
                countries.add(c["country"])
        return sorted(list(countries))

    def populate_screener_table(self, dataset: list):
        self.tree.delete(*self.tree.get_children())
        for c in dataset:
            price_raw = c.get("price_per_share") or c.get("share_price")
            price_formatted = self.format_val(price_raw, "currency")
            
            mcap_formatted = c.get("market_cap") or c.get("market_cap_formatted") or self.format_val(c.get("market_cap_raw"), "large_number")
            
            f_pe = self.format_val(c.get("forward_pe_ratio"), "decimal")
            f_eps = self.format_val(c.get("eps_forward"), "decimal")
            growth = self.format_val(c.get("eps_growth_5y_forward_cagr"), "percent_value")
            fcf = self.format_val(c.get("free_cash_flow"), "large_number")
            beta = self.format_val(c.get("beta"), "decimal")
            roic = self.format_val(c.get("roic"), "percent_fraction")
            ps = self.format_val(c.get("ps_ratio"), "decimal")
            ebit = self.format_val(c.get("ebit_margin"), "percent_fraction")
            tax = self.format_val(c.get("tax_rate"), "percent_fraction")
            gross = self.format_val(c.get("gross_margin"), "percent_fraction")
            roe = self.format_val(c.get("roe"), "percent_fraction")
            de = self.format_val(c.get("de_ratio"), "decimal")
            curr = self.format_val(c.get("current_ratio"), "decimal")
            ev_sales = self.format_val(c.get("ev_sales"), "decimal")

            self.tree.insert("", "end", values=(
                c.get("rank", "—"),
                c.get("ticker") or c.get("symbol") or "—",
                c.get("company_name", "—"),
                price_formatted,
                mcap_formatted,
                f_pe,
                f_eps,
                growth,
                fcf,
                beta,
                roic,
                ps,
                ebit,
                tax,
                gross,
                roe,
                de,
                curr,
                ev_sales,
                c.get("country", "—")
            ))

    # ---------------------------------------------
    # Screener Filter Logic
    # ---------------------------------------------
    def apply_screener_filters(self):
        query = self.filter_entry.get().strip().lower()
        country_filter = self.country_option.get()

        # Parse inputs for advanced filters
        def get_min_max_values(min_entry, max_entry, divide_100=False, mult_billion=False):
            min_v = None
            max_v = None
            
            min_s = min_entry.get().strip()
            max_s = max_entry.get().strip()
            
            if min_s:
                try:
                    min_v = float(min_s)
                    if divide_100: min_v /= 100.0
                    if mult_billion: min_v *= 1e9
                except ValueError: pass
            if max_s:
                try:
                    max_v = float(max_s)
                    if divide_100: max_v /= 100.0
                    if mult_billion: max_v *= 1e9
                except ValueError: pass
                
            return min_v, max_v

        # Read advanced filters
        price_min, price_max = get_min_max_values(self.filter_price_min, self.filter_price_max)
        pe_min, pe_max = get_min_max_values(self.filter_pe_min, self.filter_pe_max)
        roic_min, roic_max = get_min_max_values(self.filter_roic_min, self.filter_roic_max, divide_100=True)
        de_min, de_max = get_min_max_values(self.filter_de_min, self.filter_de_max)
        gross_min, gross_max = get_min_max_values(self.filter_gross_min, self.filter_gross_max, divide_100=True)
        fcf_min, fcf_max = get_min_max_values(self.filter_fcf_min, self.filter_fcf_max, mult_billion=True)

        filtered_list = []
        for c in self.companies_list:
            # Text filters
            ticker_match = query in (c.get("ticker") or c.get("symbol") or "").lower()
            name_match = query in c.get("company_name", "").lower()
            if not (ticker_match or name_match):
                continue
                
            # Country filter
            if country_filter != "All" and c.get("country") != country_filter:
                continue

            # Numeric range filters helper
            def evaluate_range(field_val, min_f, max_f):
                if min_f is None and max_f is None:
                    return True
                if field_val is None or field_val == "":
                    return False
                try:
                    num_val = float(field_val)
                    if min_f is not None and num_val < min_f:
                        return False
                    if max_f is not None and num_val > max_f:
                        return False
                    return True
                except ValueError:
                    return False

            # Check all parameters
            price_val = c.get("price_per_share") or c.get("share_price")
            if isinstance(price_val, str):
                price_val = price_val.replace("$", "").replace(",", "").strip()

            if not evaluate_range(price_val, price_min, price_max): continue
            if not evaluate_range(c.get("forward_pe_ratio"), pe_min, pe_max): continue
            if not evaluate_range(c.get("roic"), roic_min, roic_max): continue
            if not evaluate_range(c.get("de_ratio"), de_min, de_max): continue
            if not evaluate_range(c.get("gross_margin"), gross_min, gross_max): continue
            if not evaluate_range(c.get("free_cash_flow"), fcf_min, fcf_max): continue

            filtered_list.append(c)

        self.populate_screener_table(filtered_list)

    # ---------------------------------------------
    # Webull-style Header Column Sorting
    # ---------------------------------------------
    def sort_column_header(self, col: str):
        reverse = not self.sort_states[col]
        self.sort_states[col] = reverse

        col_key_map = {
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
        }
        
        target_key = col_key_map.get(col, "ticker")
        rows = [(self.tree.set(k, col), k) for k in self.tree.get_children('')]

        def get_sort_key(item):
            ticker = self.tree.set(item[1], "Ticker")
            comp = next((c for c in self.companies_list if (c.get("ticker") == ticker or c.get("symbol") == ticker)), None)
            
            if comp:
                val = comp.get(target_key)
                if target_key == "ticker" and val is None:
                    val = comp.get("symbol")
                if target_key == "price_per_share" and val is None:
                    val = comp.get("share_price")
                
                if val is not None and val != "":
                    try:
                        if isinstance(val, str):
                            val = val.replace("$", "").replace("%", "").replace(",", "").replace('"', '').strip()
                        return float(val)
                    except ValueError:
                        return str(val).lower()
            
            return float('-inf') if reverse else float('inf')

        rows.sort(key=get_sort_key, reverse=reverse)

        for idx, (val, k) in enumerate(rows):
            self.tree.move(k, '', idx)

        for c in self.columns:
            indicator = " 🔽" if self.sort_states[c] else " 🔼"
            header_text = c + (indicator if c == col else "")
            self.tree.heading(c, text=header_text)

    # ---------------------------------------------
    # Navigation Events
    # ---------------------------------------------
    def on_tree_double_click(self, event):
        selected_item = self.tree.selection()
        if not selected_item:
            return

        ticker = self.tree.item(selected_item[0], "values")[1]
        self.tabview.set("Fundamental Auditor")
        self.ticker_entry.delete(0, tk.END)
        self.ticker_entry.insert(0, ticker)
        self.start_fetch_data()

    # ---------------------------------------------
    # Fundamental Auditor Fetching Thread
    # ---------------------------------------------
    def start_fetch_data(self):
        symbol = self.ticker_entry.get().strip().upper()
        if not symbol:
            messagebox.showwarning("Input Needed", "Please enter a valid stock ticker symbol.")
            return

        if not invest_retriever.validate_ticker(symbol):
            messagebox.showerror("Invalid Symbol", "Ticker has invalid characters or is too long.")
            return

        self.status_label.configure(text="Status: Fetching data...", text_color="#F59E0B")
        self.search_btn.configure(state="disabled")
        
        # Start background thread
        threading.Thread(target=self.fetch_data_thread, args=(symbol,), daemon=True).start()

    def fetch_data_thread(self, symbol: str):
        res = invest_retriever.get_stock_data(symbol)
        self.after(0, lambda: self.update_auditor_ui(res))

    def update_auditor_ui(self, result: dict):
        self.search_btn.configure(state="normal")

        if "error" in result:
            self.status_label.configure(text="Status: Error", text_color="#EF4444")
            messagebox.showerror("Retrieval Failed", result["error"])
            return

        self.stock_data = result

        # Load values into labels
        self.comp_name_label.configure(text=f"{result.get('company_name')} ({result.get('symbol')})")
        self.meta_label.configure(text=f"Sector: {result.get('sector')}   |   Industry: {result.get('industry')}")
        
        price = result.get('price_per_share')
        self.price_label.configure(text=self.format_val(price, "currency"))

        for key_name, label_widget in self.metric_widgets.items():
            val = result.get(key_name)
            
            f_type = "decimal"
            if key_name in ["roe", "roic", "gross_margin", "ebit_margin", "tax_rate"]:
                f_type = "percent_fraction"
            elif key_name in ["eps_growth_5y_forward_cagr"]:
                f_type = "percent_value"
            elif key_name in ["free_cash_flow", "shares_outstanding"]:
                f_type = "large_number"
            elif key_name in ["de_ratio"]:
                f_type = "ratio"

            formatted_str = self.format_val(val, f_type)
            label_widget.configure(text=formatted_str)

        self.export_csv_btn.configure(state="normal")
        self.export_json_btn.configure(state="normal")
        self.status_label.configure(text="Status: Data Loaded", text_color="#10B981")

    # ---------------------------------------------
    # Formatting
    # ---------------------------------------------
    def format_val(self, val, format_type="decimal") -> str:
        if val is None or val == "":
            return "—"

        try:
            val = float(val)
        except ValueError:
            return str(val)

        if format_type == "currency":
            return f"${val:,.2f}"
        elif format_type == "percent_fraction":
            return f"{val * 100.0:.2f}%"
        elif format_type == "percent_value":
            return f"{val:.2f}%"
        elif format_type == "ratio":
            return f"{val:.2fx}"
        elif format_type == "large_number":
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
            return f"{divided_val:,.2f}{suffix}"
        else:
            return f"{val:,.2f}"

    # ---------------------------------------------
    # Refresh/Screener Downloader Integration
    # ---------------------------------------------
    def trigger_refresh_rankings(self):
        """Trigger update of CMC lists AND details downloading sequentially."""
        if not messagebox.askyesno("Confirm Update", "This will: \n1. Scrape the latest top 500 company list (~5s)\n2. Retrieve detailed fundamental analysis for all 500 stocks in parallel (~1.5 minutes).\n\nDo you wish to proceed?"):
            return

        self.status_label.configure(text="Status: Refreshing list...", text_color="#F59E0B")
        self.crawler_btn.configure(state="disabled")
        
        threading.Thread(target=self.run_full_update_thread, daemon=True).start()

    def run_full_update_thread(self):
        success = False
        try:
            # 1. Fetch CMC rankings list
            import get_top_500
            get_top_500.fetch_top_500_companies()
            
            # 2. Fetch yfinance details in parallel
            self.after(0, lambda: self.status_label.configure(text="Status: Downloading details...", text_color="#F59E0B"))
            import fetch_details
            fetch_details.run_fetch()
            success = True
        except Exception as e:
            print("Refresh Exception:", e)
            
        self.after(0, lambda: self.on_refresh_complete(success))

    def on_refresh_complete(self, success: bool):
        self.crawler_btn.configure(state="normal")
        if success:
            self.status_label.configure(text="Status: Full Database Updated", text_color="#10B981")
            self.load_top_500_data()
            self.country_option.configure(values=["All"] + self.get_available_countries())
            self.apply_screener_filters()
            messagebox.showinfo("Update Complete", "Screener database updated! All 500 companies have been populated with 17 metrics.")
        else:
            self.status_label.configure(text="Status: Update Error", text_color="#EF4444")
            messagebox.showerror("Update Error", "An error occurred during list refresh. View console for logs.")

    # ---------------------------------------------
    # Exports
    # ---------------------------------------------
    def export_csv(self):
        if not self.stock_data:
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv"), ("All Files", "*.*")],
            title="Save Investment Metrics to CSV",
            initialfile=f"{self.stock_data.get('symbol')}_metrics.csv"
        )
        if not file_path:
            return

        try:
            with open(file_path, mode='w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Metric", "Value"])
                writer.writerow(["Ticker", self.stock_data.get("symbol")])
                writer.writerow(["Company Name", self.stock_data.get("company_name")])
                writer.writerow(["Sector", self.stock_data.get("sector")])
                writer.writerow(["Industry", self.stock_data.get("industry")])
                
                for key_name, label_widget in self.metric_widgets.items():
                    label_text = label_widget.master.grid_slaves(row=label_widget.grid_info()["row"], column=0)[0].cget("text")
                    writer.writerow([label_text, label_widget.cget("text")])

            messagebox.showinfo("Export Successful", f"Data exported successfully to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Failed", f"Could not write CSV file:\n{str(e)}")

    def export_json(self):
        if not self.stock_data:
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON Files", "*.json"), ("All Files", "*.*")],
            title="Save Investment Metrics to JSON",
            initialfile=f"{self.stock_data.get('symbol')}_metrics.json"
        )
        if not file_path:
            return

        try:
            export_dict = {
                "Metadata": {
                    "Ticker": self.stock_data.get("symbol"),
                    "CompanyName": self.stock_data.get("company_name"),
                    "Sector": self.stock_data.get("sector"),
                    "Industry": self.stock_data.get("industry"),
                    "PricePerShare": self.format_val(self.stock_data.get("price_per_share"), "currency")
                },
                "Metrics": {}
            }

            for key_name, label_widget in self.metric_widgets.items():
                label_text = label_widget.master.grid_slaves(row=label_widget.grid_info()["row"], column=0)[0].cget("text")
                export_dict["Metrics"][label_text] = label_widget.cget("text")

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(export_dict, f, indent=2)

            messagebox.showinfo("Export Successful", f"Data exported successfully to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Failed", f"Could not write JSON file:\n{str(e)}")

if __name__ == "__main__":
    app = InvestmentApp()
    app.mainloop()
