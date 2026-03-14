# Feature Implementation: Asynchronous Background Scraping

## 1. What Has Been Completed
We have successfully transitioned the application's core product scraping mechanism from a synchronous blocking process to an asynchronous background job queue. 
- Integrated a Redis-backed queue system using BullMQ.
- Refactored `app/actions.ts` to enqueue scraping jobs instead of executing them inline.
- Created an API polling route (`app/api/scrape/[jobId]/route.ts`) to allow the frontend to check the status of a queued search.
- Added a standalone Node.js Worker (`scripts/worker.ts`) to process incoming search queries in the background.
- Updated the main frontend search component (`app/page.tsx`) to recursively poll the API and provide immediate, non-blocking UI feedback to the user while scraping occurs.

## 2. The Need for Building This Feature
**Problem Statement:**
In the initial `v0` implementation, when a user searched for a product (e.g., "iPhone 15"), the Next.js server synchronously executed heavy web scraping logic across multiple platforms (Amazon, Flipkart, Myntra, etc.) before returning an HTTP response. 
- This resulted in severe **Performance Bottlenecks**, as API calls to ScrapingBee, ZenRows, or ScraperAPI can take over 10-20 seconds to complete. 
- It caused **Server Timeouts** on platforms like Vercel, which enforce strict time limits (e.g., 10s-15s for Serverless Functions) on incoming HTTP requests.
- It led to a **Poor User Experience**, as the user's browser would effectively freeze, waiting for the massive payload to return.

## 3. How We Built It
We implemented a publisher-subscriber model using a Message Broker:
1. **The Publisher (User/Frontend):** The user submits a search query. The Next.js Action (`enqueueScraping`) adds this query to a Redis queue and immediately returns a `jobId` to the frontend.
2. **The Frontend Polling:** The React component enters a loading state and pings `/api/scrape/[jobId]` every 2 seconds to check if the data is ready.
3. **The Subscriber (Background Worker):** A separate Node.js process (the `worker.ts` script) listens to the queue. When a job arrives, it executes the heavy, time-consuming scraping functions. Once finished, it saves the `ProductData[]` result back to the Redis job state.
4. **The Resolution:** The frontend's next poll sees the `status === 'completed'`, fetches the attached result data, and renders the UI.

## 4. Technology Stack & Design Justification

### Technology Used
- **Redis:** An in-memory data structure store, used here as the primary message broker and state manager.
- **BullMQ:** A fast, robust Node.js message queue system backed by Redis.
- **Next.js API Routes:** Used for the status polling endpoint.
- **Standalone `tsx` Worker Scripts:** Used to run the queue processor independently of incoming HTTP requests.

### Design Choice Justifications

#### Why Redis + BullMQ instead of a Database-backed Queue? (e.g., MongoDB)
While we already use MongoDB for the Wishlist feature, database-backed queues can suffer from performance issues (database lock contention, polling overhead) under high concurrency. Redis is strictly in-memory, providing vastly superior read/write speeds natively suited for pub/sub queue mechanisms. BullMQ provides out-of-the-box features like automatic retries, exponential backoff, concurrency control, and job state tracking, which would have required hundreds of lines of complex custom code to build from scratch in MongoDB.

#### Why Polling instead of WebSockets/Server-Sent Events (SSE)?
While WebSockets provide real-time push capabilities perfectly suited for job completion alerts, they add significant architectural complexity and continuous server overhead. For a feature where the expected wait time is 10-30 seconds, simple HTTP long-polling (or interval polling) via a Next.js standard API route is the most scalable, cost-effective, and robust mechanism. It natively handles network hiccups better and avoids the need for maintaining persistent connections.

#### Why a Standalone Worker Script?
By running the `Worker` in a separate `scripts/worker.ts` file rather than inside the main Next.js App Router, we decouple the heavy processing workload from the web server. This allows us to scale the "web tier" (handling UI and simple API requests) independently from the "worker tier" (handling heavy Headless Browser/Scraping API overhead). 
