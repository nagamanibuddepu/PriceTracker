# 🛒 StreetSolve: Advanced E-Commerce Price Comparison Engine

## 📖 What is this Project?
This project is a high-performance, real-time **Price Comparison and Tracking Engine**. It behaves as an aggregator, scraping leading e-commerce websites (Amazon, Flipkart, Myntra, Nykaa, etc.) to fetch the live prices of any requested product. It then normalizes, groups, and displays these products side-by-side, allowing users to instantly find the absolute lowest price across the internet.

## 🎯 Need for this Project
In today's highly fragmented e-commerce market, prices for the exact same product naturally fluctuate wildly between different platforms due to dynamic pricing algorithms, flash sales, and platform-specific discounts. 
Consumers are forced to manually open dozens of tabs to compare prices, wasting time and often missing out on the best deals. This project solves that problem by providing a single, unified interface that does the heavy lifting instantly.

## 🚀 Objectives
1. **Instant Convergence:** To provide a single search bar that queries the entire Indian internet for a specific product.
2. **Data Normalization:** To intelligently group identical SKUs (e.g., matching the "iPhone 15 128GB Black" from Amazon with the exact same model on Flipkart), despite differing titles.
3. **Price Tracking:** To algorithmically build a historical database of price fluctuations so users understand if they are getting a good deal right now.
4. **Intelligent Assistance:** To provide an AI chatbot that can guide users on purchase decisions, specifications, or summarize reviews.

---

## 🛠️ Tech Stack & Architecture

### **Frontend layer**
- **Next.js 14 (App Router):** Chosen for its exceptional Server-Side Rendering (SSR) capabilities which are crucial for e-commerce SEO, and its native support for React Server Components.
- **React 18:** For building concurrent, highly interactive UI components like infinite scrolling arrays and tabbed data views.
- **Tailwind CSS & Shadcn/UI:** Utilized to build a stunning, performant "glassmorphism" aesthetic with dark/light mode support without shipping heavy CSS bundles.
- **Recharts:** Selected for rendering lightweight, interactive SVG-based price history line charts natively inside React.

### **Backend layer**
- **Node.js & Next Server Actions:** Serverless functions handle the secure routing of API requests without exposing sensitive keys to the browser.
- **BullMQ & Redis (ioredis):** *Crucial architectural choice.* Web scraping takes 10-20 seconds. Standard Serverless functions timeout after 10s. By using a Redis-backed message queue (BullMQ) running on a separate Worker (`scripts/worker.ts`), we can process heavy scraping tasks in the background asynchronously and stream partial progress back to the UI.
- **Puppeteer & Cheerio:** Used for headless browser automation and lightning-fast HTML DOM traversal to parse product names, prices, and images out of the scraped websites.
- **External Scraper APIs (ScrapingBee, ZenRows, SerpAPI):** Since Amazon and Flipkart heavily employ bot-protection (Cloudflare, reCAPTCHA), these premium rotating-proxy networks are used to bypass blocks and deliver raw HTML.
- **Google Generative AI (Gemini 1.5):** Powers the contextual shopping assistant chatbot due to its high speed and generous free-tier limits.

### **Database layer**
- **MongoDB:** A NoSQL approach is perfect here because the shape of scraped data (specifications, nested reviews, varying image arrays) is highly unstructured and differs wildly between Flipkart vs. Myntra. It stores our 12-hour `searchCache` and our `priceHistory` timeline.

---

## ✨ Features Implemented

1. **Progressive Search Streaming:** As the background worker finishes scraping Amazon, it immediately streams those results to the UI. It doesn't wait for Flipkart to finish. This creates a highly responsive feeling.
2. **Algorithmic Grouping:** A custom utility scrubs brand names, capacities, and colors to mathematically group identical products together in a unified card.
3. **Price Tracking & Mocking:** 30-day historical line charts are drawn for products. If a product is newly tracked, the system generates a realistic algorithmic 30-day mock history to populate the chart immediately.
4. **AI Shopping Assistant:** A floating chat window that maintains conversational context and can advise on products.
5. **Toggleable Rate Limiter System:** A robust Redis-backed rate limiter that restricts users to 3 searches/hour and 10 chats/hour in "Demo Mode" to protect API costs, bypassing the block for admins via a secret header.

---

## 🚧 Challenges & Solutions

### 1. The Serverless Timeout Execution Limit
* **Challenge:** Vercel/Next.js routes timeout and kill the connection if they take longer than 10-15 seconds. Scraping 6 websites sequentially took 30+ seconds.
* **Solution:** Extracted the heavy lifting from the frontend API directly into a separated `Node.js` background worker running `BullMQ`. The frontend simply says "start this job" and polls Redis for progress.

### 2. Getting Blocked by E-commerce Firewalls
* **Challenge:** Directly utilizing `fetch()` or `puppeteer` from our servers resulted in immediate 403 Forbidden Recaptcha walls from Amazon.
* **Solution:** Integrated ZenRows and ScrapingBee rotating proxy pipelines that natively solve CAPTCHAs before returning the parsed DOM payload to our Cheerio extractors.

### 3. GET Method Body Rejections
* **Challenge:** Modern strict APIs (like ZenRows) abruptly threw `Request with GET/HEAD method cannot have body` errors, completely breaking the core scraping loop.
* **Solution:** Refactored the Axios HTTP request interceptors from dynamic configuration objects into strictly typed `axios.get(url, { params })` to guarantee the underlying C++ networking engine dropped any null bodies.

### 4. Hydration & Ghost Server Crashes
* **Challenge:** The Next.js HMR (Hot Module Reloading) on Windows would corrupt the `.next` cache, throwing `ChunkLoadError` and destroying the UI's interactivity (buttons wouldn't click).
* **Solution:** Implemented low-level process termination (`taskkill`) to nuke hanging Ghost processes on port 3000, purged the `.next` cache, and rebuilt the AST cleanly.

---

## 🔄 Project Workflow (End-to-End)

1. **User Action (Frontend):** The user types "iPhone 15" and hits Search.
2. **Rate Limiting Check:** The Next.js API intercepts the request. It checks the user's IP against the Redis `ratelimit:search:{ip}` key. If within limits, it proceeds.
3. **Job Delegation:** The API pushes the query string into the Redis `scrape-queue` and returns a `jobId` to the browser.
4. **Background Execution (Worker):** The separated Node.js worker wakes up, grabs the `jobId`, and concurrently fires HTTP requests to ZenRows, ScrapingBee, and SerpAPI.
5. **Streaming Progress:** As Amazon resolves (e.g., 2 seconds in), the Worker pushes the partial Amazon array into the BullMQ job progress.
6. **UI Rendering:** The frontend, which has been polling the `/api/scrape/[jobId]` endpoint every 1.5s, sees the progress, parses the JSON, and dynamically expands the React DOM.
7. **Database Storage:** Once all scrapers resolve, the complete normalized array is cached in MongoDB for 12 hours. Any price differences from historical norms are inserted into the `priceHistory` collection for future graph rendering.
