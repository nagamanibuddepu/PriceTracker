PriceTracker – AI Powered Price Comparison Platform

An AI-powered price comparison platform that aggregates product prices from multiple e-commerce sources and presents them in a unified interface. The system performs background scraping, caching, and AI-assisted shopping guidance to help users discover the best deals efficiently.

Features
Real-Time Price Comparison

Search products and compare prices across multiple e-commerce platforms in one interface.

Background Scraping Pipeline

Product data is scraped asynchronously using a distributed job queue to avoid API timeouts.

AI Shopping Assistant

An integrated chatbot powered by Google Gemini that answers product and shopping related queries.

Intelligent Product Matching

Product titles are normalized to identify identical items across different marketplaces.

Price History Tracking

Stores price data over time and visualizes trends for better purchasing decisions.

Rate Limited Demo Mode

IP-based rate limiting protects API quotas while allowing public demonstrations.

Modern UI

Responsive interface built with modern component libraries and smooth animations.

Tech Stack
Frontend

Next.js (App Router)

React

Tailwind CSS

Shadcn UI

Radix UI

Framer Motion

Backend

Node.js

Next.js API Routes

BullMQ

Data & Infrastructure

MongoDB

Redis

Web Scraping

Puppeteer

Cheerio

SerpAPI

RapidAPI

ZenRows

ScrapingBee

AI Integration

Google Gemini API

System Architecture
User
 ↓
Next.js Frontend
 ↓
API Routes
 ↓
BullMQ Queue (Redis)
 ↓
Background Worker
 ↓
Scraping APIs
 ↓
MongoDB Cache
 ↓
Results sent to UI

This architecture prevents long-running scraping tasks from blocking API requests.

Deployment Architecture

Frontend & API
Vercel

Background Worker
Render / Railway

Queue
Upstash Redis

Database
MongoDB Atlas

Key Engineering Highlights

• Implemented distributed scraping pipeline using BullMQ and Redis
• Designed caching system to reduce external API calls
• Integrated AI chatbot for contextual product assistance
• Built rate limiting system for controlled public demos
• Developed scalable architecture separating frontend, worker, and queue

Local Setup
git clone https://github.com/nagamanibuddepu/PriceTracker
cd PriceTracker

npm install
npm run dev

Create .env.local using .env.example.
