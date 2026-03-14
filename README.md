# PriceTracker — AI-Powered Price Comparison Platform

> Search once. Compare everywhere. Buy smarter.

PriceTracker is a full-stack, production-grade web application that aggregates product prices from multiple e-commerce sources into a single interface. Built with a distributed background scraping pipeline, intelligent caching, and an AI shopping assistant powered by Google Gemini — it solves the real problem of fragmented online shopping by bringing all the data to one place.

---
> 🌐 [View Portfolio Page →](https://nagamanibuddepu.github.io/PriceTracker)

## What It Does

When a user searches for a product, PriceTracker dispatches scraping jobs asynchronously via a BullMQ queue backed by Redis. Worker processes fetch and normalize product data from multiple sources — using a combination of scraping APIs and direct scrapers — then persist results to MongoDB. The frontend polls for job completion and renders a live, unified price comparison view. Price history is stored over time so users can spot trends and decide the best moment to buy.

An integrated AI chatbot (Google Gemini) answers shopping-related questions contextually — helping users choose between products, understand specs, or find alternatives.

---

## Features

### Real-Time Price Comparison
Search any product and see results from multiple e-commerce platforms side by side in one unified view. No tab-switching. No manual searching.

### Distributed Background Scraping Pipeline
Scraping jobs are offloaded to background workers via BullMQ + Redis queues. This prevents API timeouts and keeps the UI responsive — the frontend subscribes to job status and displays results as they arrive.

### AI Shopping Assistant
A chatbot powered by Google Gemini answers product-related queries in context. Ask it to compare two laptops, explain a spec, or suggest alternatives — it responds with shopping-aware guidance.

### Intelligent Product Title Normalization
Product titles vary wildly across platforms. The system normalizes them to match identical items across different marketplaces, reducing noise in search results.

### Price History Tracking
Price data is stored over time in MongoDB. Trends are visualized so users can see whether a product is cheaper now versus last week or last month.

### IP-Based Rate Limiting
Public demo endpoints are rate-limited per IP to protect external API quotas and prevent abuse — a necessary design for a scraping-heavy platform exposed to the internet.

---

## Tech Stack & Rationale

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js (App Router) | SSR + client routing in one framework; App Router enables layout-level data fetching |
| **UI Components** | Shadcn UI + Radix UI | Accessible, unstyled primitives with full design control |
| **Styling** | Tailwind CSS | Utility-first, fast iteration, no CSS file sprawl |
| **Animations** | Framer Motion | Declarative animations for job-status transitions and result reveals |
| **API Layer** | Next.js API Routes | Co-located backend routes; no separate Express server needed |
| **Job Queue** | BullMQ | Redis-backed job queue purpose-built for Node.js; handles retries, delays, concurrency |
| **Cache + Queue Broker** | Redis (Upstash) | Fast ephemeral store for BullMQ and result caching; Upstash for serverless-compatible Redis |
| **Database** | MongoDB (Atlas) | Flexible document schema for heterogeneous product data from different scrapers |
| **Scraping** | Puppeteer, Cheerio, SerpAPI, ZenRows, ScrapingBee, RapidAPI | Multi-source redundancy; headless browser for JS-rendered pages, fast HTML parsers for static pages |
| **AI** | Google Gemini API | Generous free tier; strong instruction-following for shopping assistant use case |
| **Deployment** | Vercel (frontend), Render/Railway (worker), MongoDB Atlas, Upstash Redis | Separation of concerns — long-running worker processes need persistent infra that Vercel's serverless functions can't provide |

---

## System Architecture

```
User Search
     │
     ▼
Next.js Frontend  ──────────────────────────┐
     │                                       │
     ▼                                       │ Polls job status
Next.js API Routes                           │
     │                                       │
     ▼                                       │
BullMQ Queue (Redis / Upstash)               │
     │                                       │
     ▼                                       │
Background Worker (Render/Railway)           │
     │                                       │
     ├── Puppeteer (JS-rendered pages)       │
     ├── Cheerio (static HTML parsing)       │
     ├── SerpAPI / ZenRows / ScrapingBee     │
     │                                       │
     ▼                                       │
MongoDB Atlas (cache + price history) ───────┘
     │
     ▼
Results returned to UI
```

**Why this architecture?**
Scraping is slow and unpredictable. Putting scraping work directly in an API route would time out in seconds. By offloading to a BullMQ queue processed by a dedicated worker, the API returns immediately with a job ID, and the frontend polls for completion. This is the same pattern used by production scraping and ETL systems.

---

## Key Engineering Decisions

- **BullMQ over simple async calls** — gives retry logic, job priorities, and concurrency control out of the box
- **Multi-source scraping strategy** — using several APIs (SerpAPI, ZenRows, ScrapingBee) in parallel increases coverage and reduces single-point-of-failure risk
- **MongoDB for product data** — product schemas differ per source; a document store avoids painful schema migrations as scrapers evolve
- **Upstash Redis** — Redis as a managed, serverless-compatible service; works seamlessly with Vercel's edge environment for rate limiting
- **Worker deployed separately** — Next.js on Vercel runs as serverless functions (max ~60s); background workers need persistent processes, so Render/Railway is the right separation

---

## Local Setup

```bash
git clone https://github.com/nagamanibuddepu/PriceTracker
cd PriceTracker
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

You'll need API keys for: Google Gemini, at least one scraping API (SerpAPI / ZenRows / ScrapingBee), a Redis instance (Upstash or local), and a MongoDB connection string.

---

## Deployment

| Service | Platform |
|---|---|
| Frontend + API Routes | Vercel |
| Background Worker | Render or Railway |
| Redis Queue | Upstash |
| Database | MongoDB Atlas |

The worker must be deployed as a **separate long-running service** — it cannot run on Vercel's serverless functions.

---

## Resume Description

> **PriceTracker — AI-Powered Price Comparison Platform**
> Built a full-stack price aggregation platform using Next.js, BullMQ, Redis, and MongoDB. Designed a distributed background scraping pipeline that decouples long-running jobs from API routes using a Redis-backed job queue, preventing timeouts under real-world scraping latency. Integrated Google Gemini as a contextual AI shopping assistant. Implemented IP-based rate limiting for public demo safety. Deployed frontend on Vercel with a separate long-running worker on Render, following production separation-of-concerns architecture.
> **Stack:** Next.js · Node.js · BullMQ · Redis · MongoDB · Google Gemini · Puppeteer · Tailwind CSS · Shadcn UI · Framer Motion

---

## Author

**Nagamani Buddepu**
[GitHub](https://github.com/nagamanibuddepu)
