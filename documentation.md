# Project Features & Documentation

## Features and Functionalities
1. **Real-Time Cross-Platform Searching**: Simultaneously pulls data across leading Indian e-commerce hubs (Amazon, Flipkart, Myntra, etc.) to list current live prices.
2. **Infinite Pagination & Product Normalization**: Strips away generic formatting keywords so variant matching applies to identical SKUs across stores, presented gracefully in an infinite scroll feed.
3. **Advanced "View Deal" Redirection**: Decrypts Google Shopping payload redirects to send the user precisely to the actual merchant's valid webpage, bypassing the Search Engine result layer.
4. **AI-Powered "Style & Deal" Chatbot Assistant**: Integrated with the `Google Gemini` LLM to answer contextual fashion, specification, and shopping questions from the site using semantic APIs.
5. **Modern Premium Aesthetic**:
    - Complete support for Light Mode and Deep Navy/Electric Indigo Dark Mode.
    - Floating bento-grid cards with interactive, hardware-accelerated Framer Motion transitions and pure CSS Mesh Keyframe loops.
    - Fully accessible ARIA semantics natively handled with `radix-ui`.
6. **Background Asynchronous Workers (BullMQ + Redis)**: Scrapes the APIs completely in the background to avoid 30s Serverless Execution timeouts, streaming status directly back to the React UI via periodic polling.

---

## Tech Stack & Design Choices

| Area | Technologies | Reasoning |
|---|---|---|
| **Frontend Framework** | Next.js (App Router), React 18 | Excellent server-side rendering for SEO. Clean routing and simplified server actions out-of-the-box. |
| **Styling & UI Components** | Tailwind CSS, Shadcn/UI, Radix | Enables creating ultra-premium glassmorphism and bento grids easily without heavy CSS bundles. Accessible hooks out-of-the-box. |
| **Data Processing** | BullMQ, Redis, Node.js Worker (`tsx`) | Because web scraping operations from Python microservices or remote headless browsers take arbitrarily long (~10-30s), a job queue guarantees requests aren't randomly dropped due to Vercel/NextJS routing timeouts. |
| **Database & ORM** | MongoDB | Stores robust structured caches of search payloads and users' Price Alerts / Wishlist preferences. |
| **Web Scraping & APIs** | Puppeteer, Cheerio, SerpAPI, RapidAPI | Instead of building anti-bot avoidance manually, utilizing external proxy pipelines manages recaptcha walls seamlessly, providing HTML that Cheerio quickly parses. |
| **AI Integration** | Google Generative AI (Gemini 2.5 Flash) | Superior text generation latency which handles conversational chat flawlessly. |

---

## What is at its best?
* **UI/UX Aesthetics**: The dark mode palette combined with animated micro-interactions natively competes with premium SaaS or E-commerce native apps.
* **Component Modularity**: Every major block (`AI-Chatbot`, `Enhanced-Search`, `Product-Comparison`) is functionally decoupled, making it exceedingly easy to rewrite backend calls or switch external providers without touching the frontend.
* **Robust Redirection**: Safe fallback wrappers protect users handling broken scraper links inside the `ProductComparison` layout.

## What has to be improved?
* **Strict Scraping Limits**: Hitting 5+ endpoints per query currently dictates API exhaustion risk. Caching is present via Redis, but could be enhanced utilizing aggressive Static Gen policies from Next.js caching tools.
* **Normalization Engine**: Machine Learning approaches (like simple vector similarity) could yield a higher accuracy group of product groupings compared to regex-based text trimming.
* **Price Alert Polling Mechanism**: The current CRON alerts pull the database iteratively on a timer. Webhooks direct from retail data providers would be vastly lighter.

---

## Deployment Strategy & API Key Protection

> Deploying a project involving so many APIs is tough as public usage can rapidly exceed Free Tiers. 

### How to Stay Public, Showcase Work, and Not Get Caught

1. **Keep Secrets Locked**:
   - `GEMINI_API_KEY`, `MONGODB_URI`, `REDIS_URL` and all Scraper keys **must solely exist in Vercel/Render Environment Variables**. Never commit `.env.local`. I have just swept your `app/actions.ts` file to ensure the hardcoded `ZENROWS` key was completely deleted.
2. **Aggressive MongoDB/Redis Caching**:
   - You are securely caching the API lookup results inside the MongoDB `searchCache` database. Do not lower the 12-hour expiry threshold! If multiple users search "iPhone 15", the app retrieves the data from the DB instantly, charging your API limits *zero* times. 
3. **Limit the Demos**:
   - Implement an IP rate-limiter, perhaps via `upstash/ratelimit`, tracking searches on the edge middleware. Limit unauthorized users to ~3 searches every hour.
   - You can inject a banner to the UI: *"Demo limit: 3 searches per IP. You have 2 left."*
4. **Deploying the Infrastructure**:
   - **Frontend & App Logic:** Deploy seamlessly to **Vercel** simply by connecting your GitHub repo.
   - **Background Worker & Redis:** Deploy the `worker.ts` script on **Render.com** (using their background worker tier) or **Railway.app**. It connects to your remote Redis (like **Upstash Redis**).
   - **Database:** Deploy your MongoDB on **MongoDB Atlas** (Free Tier).
