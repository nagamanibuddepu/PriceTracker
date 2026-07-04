"use server"

import puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { headers } from 'next/headers'
import { enqueueScrapeJob } from '../lib/queue'
import { getDatabase, isMongoAvailable } from '../lib/mongodb'
import { isDemoModeEnabled, checkRateLimit } from '../lib/rate-limit'
import { isRedisAvailable } from '../lib/redis'
import { recordPriceHistory } from '../lib/price-history'

interface ScrapedProduct {
  name: string
  price: number
  site: string
  imageUrl: string
  url: string
  description?: string
  rating?: number
  reviews?: number
  availability?: string
  brand?: string
  category?: string
  specifications?: Record<string, string>
  originalPrice?: number
  discount?: number
  seller?: string
  shipping?: string
  inStock?: boolean
  lastUpdated?: string
}

interface Retailer {
  site: string
  price: number
  url: string
  imageUrl: string
  rating?: number
  reviews?: number
  availability?: string
}

interface ProductData {
  productName: string
  retailers: Retailer[]
  lowestPrice: number
  lowestPriceSite: string
  category?: string
  avgRating?: number
}

// ScrapingBee configuration
// Ensure we fetch the key at runtime in the function as well so it doesn't fail if the module is loaded before dotenv
const getScrapingBeeKey = () => process.env.SCRAPINGBEE_API_KEY;

// Debug logging for API key
console.log('ScrapingBee API Key status (at module load):', process.env.SCRAPINGBEE_API_KEY ? 'Configured' : 'Not configured')

// ZenRows configuration
const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY

const RATE_LIMIT_DELAY = 2000
const MAX_RETRIES = 3
const FETCH_TIMEOUT = 12000
const API_TIMEOUT = 4000
const PRODUCTS_PER_PAGE = 48

// Request tracking
const lastRequestTimes: { [key: string]: number } = {}

// Add more sites to scrape
const SUPPORTED_SITES = [
  'amazon',
  'flipkart',
  'myntra',
  'meesho',
  'ajio',
  'nykaa',
  'nykaafashion',
  'savana',
  'ebay',
  'shein'
] as const

// Update scraping configuration
const SCRAPING_CONFIG = {
  amazon: {
    baseUrl: 'https://www.amazon.in',
    searchUrl: (query: string, page: number) =>
      `https://www.amazon.in/s?k=${encodeURIComponent(query)}&page=${page}`,
    selectors: {
      products: 'div[data-component-type="s-search-result"]',
      name: 'h2 a span',
      price: '.a-price .a-offscreen',
      image: 'img.s-image',
      rating: '.a-icon-star-small',
      reviews: '.a-size-small .a-link-normal',
      description: '.a-size-base-plus',
      availability: '.a-color-success',
      brand: '.a-size-base-plus.a-color-secondary',
      category: '.a-color-secondary .a-link-normal',
      specifications: '.a-unordered-list',
      originalPrice: '.a-text-price .a-offscreen',
      discount: '.a-badge-text',
      seller: '.a-size-small.a-color-secondary',
      shipping: '.a-size-small.a-color-secondary',
      inStock: '.a-color-success',
      lastUpdated: '.a-size-small.a-color-secondary'
    }
  },
  flipkart: {
    baseUrl: 'https://www.flipkart.com',
    searchUrl: (query: string, page: number) =>
      `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&page=${page}`,
    selectors: {
      products: 'div._1AtVbE',
      name: 'div._4rR01T',
      price: 'div._30jeq3._1_WHN1',
      image: 'img._396cs4',
      rating: 'div._3LWZlK',
      reviews: 'span._2_R_DZ',
      description: 'div._1PBCrt',
      availability: 'div._16FRp0',
      brand: 'div._2WkVRV',
      category: 'div._1kidPb',
      specifications: 'div._14cfVK',
      originalPrice: 'div._3I9_wc._27UcVY',
      discount: 'div._3Ay6Sb',
      seller: 'div._1RLviY',
      shipping: 'div._2Tpdn3',
      inStock: 'div._16FRp0',
      lastUpdated: 'div._2Tpdn3'
    }
  },
  myntra: {
    baseUrl: 'https://www.myntra.com',
    searchUrl: (query: string, page: number) =>
      `https://www.myntra.com/${encodeURIComponent(query)}?p=${page}`,
    selectors: {
      products: 'li.product-base',
      name: 'h3.product-brand',
      price: 'span.product-discountedPrice',
      image: 'img.img-responsive',
      rating: 'div.product-ratingsContainer',
      reviews: 'span.product-ratingsCount',
      description: 'h4.product-product',
      availability: 'span.product-sizes',
      brand: 'h3.product-brand',
      category: 'span.product-category',
      specifications: 'div.product-specifications',
      originalPrice: 'span.product-strike',
      discount: 'span.product-discountPercentage',
      seller: 'span.product-seller',
      shipping: 'span.product-shipping',
      inStock: 'span.product-sizes',
      lastUpdated: 'span.product-lastUpdated'
    }
  }
}

// Initialize browser instance
let browser: puppeteer.Browser | null = null

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  return browser
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function enforceRateLimit(site: string): Promise<void> {
  const now = Date.now()
  const lastRequest = lastRequestTimes[site] || 0
  const timeSinceLastRequest = now - lastRequest

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest
    await delay(waitTime)
  }

  lastRequestTimes[site] = Date.now()
}

function extractPrice(priceText: string): number {
  if (!priceText) return 0
  const cleanPrice = priceText.replace(/[₹,\s]/g, "").replace(/[^\d.]/g, "")
  const price = Number.parseFloat(cleanPrice)
  return isNaN(price) ? 0 : price
}

function extractRating(ratingText: string): number {
  if (!ratingText) return 0
  const rating = Number.parseFloat(ratingText.replace(/[^\d.]/g, ""))
  return isNaN(rating) ? 0 : Math.min(rating, 5)
}

function extractReviews(reviewText: string): number {
  if (!reviewText) return 0
  const reviews = Number.parseInt(reviewText.replace(/[^\d]/g, ""))
  return isNaN(reviews) ? 0 : reviews
}

function cleanProductName(name: string): string {
  if (!name) return ''

  return name
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\b(?:size|color|pack|set|of|with|and|the|for|in|on|at)\b/gi, '') // Remove common words
    .replace(/\s+/g, ' ') // Normalize spaces again
    .trim()
}

// Enhanced URL normalization
function normalizeUrl(url: string, baseUrl: string): string {
  if (!url || url === '#') {
    return '#'
  }

  try {
    // If URL is already absolute, validate it
    if (url.startsWith('http')) {
      new URL(url) // Validate URL
      return url
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`
    }

    // Handle relative URLs
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`
    }

    // Handle www URLs
    if (url.startsWith('www.')) {
      return `https://${url}`
    }

    // Handle other relative URLs
    return `${baseUrl}/${url}`
  } catch (error) {
    console.error("[URL] Error normalizing URL:", error, "URL:", url)
    return '#'
  }
}

// Enhanced image URL normalization
function normalizeImageUrl(url: string, baseUrl: string): string {
  if (!url) return '/placeholder.svg?height=200&width=200'

  try {
    const normalizedUrl = normalizeUrl(url, baseUrl)

    // Handle data URLs
    if (normalizedUrl.startsWith('data:')) {
      return normalizedUrl
    }

    // Handle relative image paths
    if (normalizedUrl.startsWith('/')) {
      return `${baseUrl}${normalizedUrl}`
    }

    // Handle protocol-relative image URLs
    if (normalizedUrl.startsWith('//')) {
      return `https:${normalizedUrl}`
    }

    // Handle absolute URLs
    if (normalizedUrl.startsWith('http')) {
      return normalizedUrl
    }

    // Default case: prepend base URL
    return `${baseUrl}/${normalizedUrl}`
  } catch (error) {
    console.error('Error normalizing image URL:', error)
    return '/placeholder.svg?height=200&width=200'
  }
}

// Enhanced scraping function using ScrapingBee
async function scrapeWithScrapingBee(url: string, site: string): Promise<string | null> {
  try {
    const apiKey = getScrapingBeeKey();
    if (!apiKey) {
      console.error("ScrapingBee API key not configured")
      return null
    }

    const scrapingBeeUrl = new URL("https://app.scrapingbee.com/api/v1/")
    scrapingBeeUrl.searchParams.append("api_key", apiKey)
    scrapingBeeUrl.searchParams.append("url", url)
    scrapingBeeUrl.searchParams.append("render_js", "true")
    scrapingBeeUrl.searchParams.append("premium_proxy", "true")
    scrapingBeeUrl.searchParams.append("country_code", "in")
    scrapingBeeUrl.searchParams.append("wait", "5000")
    scrapingBeeUrl.searchParams.append("timeout", "20000")
    scrapingBeeUrl.searchParams.append("block_ads", "true")
    scrapingBeeUrl.searchParams.append("block_resources", "false")

    console.log(`ScrapingBee: Fetching ${site} from ${url}`)
    console.log('ScrapingBee URL:', scrapingBeeUrl.toString().replace(apiKey, 'REDACTED'))

    const response = await fetch(scrapingBeeUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
    })

    if (response.ok) {
      const html = await response.text()
      console.log(`ScrapingBee: Success for ${site} (${html.length} chars)`)

      // Debug: Log first 500 chars to see what we got
      console.log(`ScrapingBee: First 500 chars: ${html.substring(0, 500)}`)

      return html
    } else {
      const errorText = await response.text()
      console.error(`ScrapingBee: Failed for ${site} (${response.status}): ${errorText}`)
      return null
    }
  } catch (error) {
    console.error(`ScrapingBee error for ${site}:`, error)
    return null
  }
}

// Enhanced product extraction with better error handling
function extractProducts(html: string, site: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = []
  const $ = cheerio.load(html)
  const config = SCRAPING_CONFIG[site as keyof typeof SCRAPING_CONFIG]

  if (!config) {
    console.error(`No configuration found for site: ${site}`)
    return products
  }

  console.log(`Extracting products from ${site} using selectors:`, config.selectors)

  $(config.selectors.products).each((_, element) => {
    try {
      const name = $(element).find(config.selectors.name).text().trim()
      const priceText = $(element).find(config.selectors.price).text()
      const price = extractPrice(priceText)
      const imageUrl = $(element).find(config.selectors.image).attr('src')
      const productUrl = $(element).find('a').first().attr('href')

      console.log(`Found product on ${site}:`, {
        name,
        price,
        imageUrl,
        productUrl
      })

      if (name && price > 0 && imageUrl && productUrl) {
        const cleanName = cleanProductName(name)
        if (cleanName) {
          const normalizedImageUrl = normalizeImageUrl(imageUrl, config.baseUrl)
          const normalizedProductUrl = normalizeUrl(productUrl, config.baseUrl)

          console.log(`Processed product on ${site}:`, {
            cleanName,
            normalizedImageUrl,
            normalizedProductUrl
          })

          products.push({
            name: cleanName,
            price,
            site,
            imageUrl: normalizedImageUrl,
            url: normalizedProductUrl,
            description: $(element).find(config.selectors.description).text().trim(),
            rating: extractRating($(element).find(config.selectors.rating).text()),
            reviews: extractReviews($(element).find(config.selectors.reviews).text()),
            availability: $(element).find(config.selectors.availability).text().trim(),
            brand: $(element).find(config.selectors.brand).text().trim(),
            category: $(element).find(config.selectors.category).text().trim(),
            specifications: extractSpecifications($(element).find(config.selectors.specifications)),
            originalPrice: extractPrice($(element).find(config.selectors.originalPrice).text()),
            discount: extractDiscount($(element).find(config.selectors.discount).text()),
            seller: $(element).find(config.selectors.seller).text().trim(),
            shipping: $(element).find(config.selectors.shipping).text().trim(),
            inStock: $(element).find(config.selectors.inStock).text().includes('In Stock'),
            lastUpdated: $(element).find(config.selectors.lastUpdated).text().trim()
          })
        }
      }
    } catch (error) {
      console.error(`Error extracting product from ${site}:`, error)
    }
  })

  console.log(`Extracted ${products.length} products from ${site}`)
  return products
}

// Helper function to extract specifications
function extractSpecifications(element: Element | null): Record<string, string> {
  const specs: Record<string, string> = {}
  if (!element) return specs

  element.querySelectorAll('li').forEach(li => {
    const [key, value] = li.textContent?.split(':').map(s => s.trim()) || []
    if (key && value) {
      specs[key] = value
    }
  })

  return specs
}

// Helper function to extract discount percentage
function extractDiscount(text: string): number {
  if (!text) return 0
  const match = text.match(/(\d+)%/)
  return match ? parseInt(match[1]) : 0
}

// Enhanced product comparison with better grouping
function groupSimilarProducts(products: ScrapedProduct[]): ProductData[] {
  const groups: Map<string, ScrapedProduct[]> = new Map()

  products.forEach(product => {
    const key = generateProductKey(product)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(product)
  })

  return Array.from(groups.entries()).map(([key, products]) => {
    const lowestPrice = Math.min(...products.map(p => p.price))
    const lowestPriceSite = products.find(p => p.price === lowestPrice)?.site || ''

    return {
      productName: products[0].name,
      retailers: products.map(p => ({
        site: p.site,
        price: p.price,
        url: p.url,
        imageUrl: p.imageUrl,
        rating: p.rating,
        reviews: p.reviews,
        availability: p.availability
      })),
      lowestPrice,
      lowestPriceSite,
      category: products[0].category,
      avgRating: products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length
    }
  })
}

// Enhanced product key generation for better grouping
function generateProductKey(product: ScrapedProduct): string {
  // Clean and normalize the product name
  const cleanName = product.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()

  // Extract key identifiers (brand, model, size, etc.)
  const parts = cleanName.split(' ')
  const keyParts = parts.filter(part =>
    part.length > 2 && // Skip very short words
    !['for', 'and', 'the', 'with', 'in', 'on', 'at'].includes(part) // Skip common words
  )

  return keyParts.join(' ')
}

// RapidAPI configuration
const RAPIDAPI_CONFIG = {
  amazon: {
    url: 'https://real-time-amazon-data.p.rapidapi.com/search',
    params: {
      query: '',
      page: '1',
      country: 'IN',
      category_id: 'aps'
    }
  },
  flipkart: {
    url: 'https://real-time-flipkart-data2.p.rapidapi.com/search',
    params: {
      query: '',
      page: '1',
    }
  },
  productSearch: {
    url: 'https://real-time-product-search.p.rapidapi.com/search',
    params: {
      q: '',
      page: '1',
      language: 'en',
      region: 'in'
    }
  },
  megaProductSearch: {
    url: 'https://real-time-product-search-mega.p.rapidapi.com/product-search',
    apiKeyEnv: 'RAPIDAPI_MEGA_KEY', // Use a separate environment variable for this API
    params: {
      q: '',
      country: 'in',
      language: 'en',
      limit: '10'
    }
  }
};

async function fetchFromRapidAPI(site: string, query: string, page: number = 1) {
  try {
    const config = RAPIDAPI_CONFIG[site as keyof typeof RAPIDAPI_CONFIG];
    if (!config) {
      throw new Error(`No configuration found for site: ${site}`);
    }

    const queryKey = config.params.hasOwnProperty('q') ? 'q' : 'query';
    const params = {
      ...config.params,
      [queryKey]: query,
      page: page.toString()
    };

    const apiKey = (config as any).apiKeyEnv 
      ? process.env[(config as any).apiKeyEnv] 
      : process.env.RAPIDAPI_KEY;

    const response = await axios.get(config.url, {
      params,
      timeout: API_TIMEOUT,
      headers: {
        'X-RapidAPI-Key': apiKey || '',
        'X-RapidAPI-Host': new URL(config.url).host
      }
    });

    if (!response.data) {
      throw new Error('No data received from RapidAPI');
    }

    let products: ScrapedProduct[] = [];
    if (site === 'amazon') {
      products = response.data.data?.products?.map((p: any) => {
        const price = parseFloat(p.product_price?.replace(/[^0-9.]/g, '')) || 0;
        const originalPrice = parseFloat(p.product_original_price?.replace(/[^0-9.]/g, '')) || 0;

        return {
          name: p.product_title || 'Unknown Product',
          price: price,
          imageUrl: p.product_photo || '/placeholder.svg',
          url: normalizeUrl(p.product_url || '#', 'https://www.amazon.in'),
          rating: parseFloat(p.product_star_rating) || 0,
          reviews: parseInt(p.product_num_reviews) || 0,
          description: p.product_description || '',
          brand: p.product_brand || '',
          category: p.product_category || '',
          specifications: p.product_specifications || '',
          originalPrice: originalPrice,
          discount: originalPrice > 0 ? ((originalPrice - price) / originalPrice * 100) : 0,
          seller: p.product_seller || '',
          shipping: p.product_shipping || '',
          inStock: p.product_in_stock || false,
          lastUpdated: new Date().toISOString(),
          site: 'Amazon'
        };
      }) || [];
    } else if (site === 'productSearch' || site === 'megaProductSearch') {
      products = response.data.data?.products?.map((p: any) => {
        const price = parseFloat(p.price?.replace(/[^0-9.]/g, '')) || 0;
        return {
          name: p.title || 'Unknown Product',
          price: price,
          imageUrl: p.image || '/placeholder.svg',
          url: normalizeUrl(p.link || '#', 'https://google.com'),
          rating: p.rating || 0,
          reviews: p.reviews_count || 0,
          site: p.store || 'Google Shopping',
          lastUpdated: new Date().toISOString(),
        };
      }) || [];
    }

    return products;
  } catch (error) {
    console.error(`Error fetching from ${site} RapidAPI:`, error);
    return [];
  }
}

// Update ScrapingBee configuration
const SCRAPINGBEE_CONFIG = {
  flipkart: {
    url: 'https://www.flipkart.com/search',
    params: {
      q: '',
      page: '1'
    },
    selectors: {
      productContainer: 'div._1AtVbE',
      name: 'div._4rR01T',
      price: 'div._30jeq3._1_WHN1',
      image: 'img._396cs4',
      rating: 'div._3LWZlK',
      reviews: 'span._2_R_DZ',
      description: 'div._1fQZEK',
      brand: 'div._2WkVRV',
      category: 'div._1fQZEK',
      specifications: 'div._14cfVK',
      originalPrice: 'div._3I9_wc._27UcVY',
      discount: 'div._3Ay6Sb',
      seller: 'div._1fQZEK',
      shipping: 'div._1fQZEK',
      inStock: 'div._16FRp0'
    }
  }
};

// Update the compareProducts function
export async function compareProducts(
  query: string, 
  page: number = 1,
  onProgress?: (partial: ProductData[]) => void
): Promise<ProductData[]> {
  console.log(`Starting product comparison for "${query}" (page ${page})`);

  const cacheKey = `${query.toLowerCase().trim()}_page_${page}`;
  try {
    const db = await getDatabase();
    if (db && isMongoAvailable()) {
      const searchCache = db.collection('searchCache');
      const cached = await searchCache.findOne({ cacheKey });
      
      // Cache valid for 12 hours
      if (cached && (Date.now() - cached.timestamp < 12 * 60 * 60 * 1000)) {
        console.log(`[Cache Hit] Returning cached results for "${query}"`);
        // Apply filtering to cached results as well to handle updated logic
        const filtered = filterIrrelevantProducts(cached.data, query);
        return filtered;
      }
    }
  } catch (error) {
    console.error("[Cache Error Check]", error);
  }

  let allProducts: ScrapedProduct[] = [];

  // Track unique products by name/price to avoid duplicates while fetching
  const seenKeys = new Set<string>();
  const addProducts = (newProducts: any[]) => {
    newProducts.forEach(p => {
      const key = `${p.name}-${p.price}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allProducts.push(p);
      }
    });
    if (onProgress) {
      const filtered = filterIrrelevantProducts(allProducts, query);
      onProgress(groupSimilarProducts(filtered));
    }
  };

  const handleChunk = (chunk: ScrapedProduct[]) => {
    if (chunk && chunk.length > 0) {
      addProducts(chunk);
    }
  };

  // Run primary APIs in parallel, but don't wait for SerpAPI if others finish quickly
  const primaryPromises = [
    fetchFromSerpAPI(query, page).then(handleChunk).catch(e => console.warn("SerpAPI slow/failed")),
    fetchFromRapidAPI('amazon', query, page).then(handleChunk).catch(e => console.warn("Amazon slow/failed")),
    fetchFromRapidAPI('flipkart', query, page).then(handleChunk).catch(e => console.warn("Flipkart slow/failed")),
    fetchFromRapidAPI('productSearch', query, page).then(handleChunk).catch(e => console.warn("ProductSearch slow/failed")),
    fetchFromRapidAPI('megaProductSearch', query, page).then(handleChunk).catch(e => console.warn("MegaProductSearch slow/failed"))
  ];

  // Wait for at least 1 fast API to finish, then cap additional wait at 3 seconds
  await Promise.race([
    Promise.allSettled(primaryPromises),
    new Promise(resolve => setTimeout(resolve, 3000)) // Cap the wait at 3 seconds for Thunder Speed
  ]);

  console.log(`Found ${allProducts.length} products from primary APIs.`);

  // If we still found nothing or very few (under 2), run fallbacks in parallel immediately
  if (allProducts.length < 2) {
    console.log('Running faster fallbacks in parallel...');
    await Promise.allSettled([
      fetchFromScraperAPI(query, page).then(handleChunk).catch(e => console.warn("ScraperAPI error")),
      fetchFromScrapingBee('amazon', query).then(handleChunk).catch(e => console.warn("ScrapingBee error")),
      fetchFromZenRows('amazon', query).then(handleChunk).catch(e => console.warn("ZenRows error"))
    ]);
  }

  // If no products found, use fallback data
  if (allProducts.length === 0) {
    console.log('No products found, using fallback data');
    allProducts = generateTestProducts(query);
  }

  // Filter out irrelevant products before grouping
  const filteredProducts = filterIrrelevantProducts(allProducts, query);
  
  // If we filtered out almost everything, be less strict
  const finalToGroup = filteredProducts.length > 0 ? filteredProducts : allProducts;

  // Group similar products
  const groupedProducts = groupSimilarProducts(finalToGroup);

  // Record price history in background
  Promise.all(
    groupedProducts.flatMap(group => {
      // Use sanitized productName as productId identifier
      const productId = generateProductKey({ name: group.productName } as any);
      return group.retailers.map(r => 
        recordPriceHistory(productId, r.site, r.price).catch(e => console.error("Price DB Error:", e))
      );
    })
  ).catch(console.error);

  try {
    const db = await getDatabase();
    if (db && isMongoAvailable()) {
      const searchCache = db.collection('searchCache');
      await searchCache.updateOne(
        { cacheKey },
        { $set: { data: groupedProducts, timestamp: Date.now() } },
        { upsert: true }
      );
      console.log(`[Cache Miss] Saved new results to cache for key "${cacheKey}"`);
    }
  } catch (error) {
    console.error("[Cache Error Save]", error);
  }

  return groupedProducts;
}

// Enqueue scraping; falls back to direct execution when Redis is unavailable
export async function enqueueScraping(query: string, page: number = 1) {
  const headersList = headers();
  const adminKey = headersList.get('x-admin-key');
  const isAdmin = adminKey === process.env.ADMIN_API_KEY && !!process.env.ADMIN_API_KEY;

  if (!isAdmin && await isDemoModeEnabled()) {
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
    const result = await checkRateLimit(ip, 'search', 5, 3600);
    if (!result.success) {
      console.log(`Rate limit exceeded for search by IP: ${ip}`);
      return { success: false, error: 'Demo Mode Limit Reached\nOnly 5 searches per hour allowed in demo.' };
    }
  }

  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    console.warn('[Search] Redis unavailable, running search directly');
    return { success: true, useDirect: true as const };
  }

  try {
    const job = await enqueueScrapeJob(query);
    return { success: true, jobId: job.id as string, useDirect: false as const };
  } catch (error) {
    console.error('Failed to enqueue scrape job, falling back to direct search:', error);
    return { success: true, useDirect: true as const };
  }
}

// Function to fetch products using SerpAPI
async function fetchFromSerpAPI(query: string, page: number = 1) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        api_key: process.env.SERPAPI_KEY,
        engine: 'google',
        q: query,
        google_domain: 'google.co.in',
        gl: 'in',
        hl: 'en',
        tbm: 'shop',
        num: 40
      },
      timeout: API_TIMEOUT,
    });

    if (!response.data?.shopping_results) {
      return [];
    }

    return response.data.shopping_results.map((item: any) => {
      // Extract price from the price string (e.g., "₹45,999" -> 45999)
      const priceStr = item.price || '0';
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

      // Extract real merchant link from Google redirect if necessary
      let finalLink = item.link || '#';
      if (finalLink.includes('google.com/url') || finalLink.includes('google.co.in/url')) {
        try {
          const urlObj = new URL(finalLink);
          const redirectUrl = urlObj.searchParams.get('url') || urlObj.searchParams.get('q');
          if (redirectUrl) {
            finalLink = redirectUrl;
          }
        } catch (e) {
          console.error("Failed to parse Google redirect URL:", finalLink);
        }
      }

      return {
        name: item.title || 'Unknown Product',
        price: price,
        imageUrl: item.thumbnail || '/placeholder.svg',
        url: normalizeUrl(finalLink, 'https://google.com'),
        rating: parseFloat(item.rating) || 0,
        reviews: parseInt(item.reviews) || 0,
        description: item.description || '',
        brand: item.brand || '',
        category: item.category || '',
        specifications: item.specifications || '',
        originalPrice: parseFloat(item.original_price?.replace(/[^0-9.]/g, '')) || 0,
        discount: parseFloat(item.discount?.replace(/[^0-9.]/g, '')) || 0,
        seller: item.seller || '',
        shipping: item.shipping || '',
        inStock: true,
        lastUpdated: new Date().toISOString(),
        site: item.source || 'Unknown Store'
      };
    });
  } catch (error) {
    console.error('Error fetching from SerpAPI:', error);
    return [];
  }
}

// Function to fetch products using ScraperAPI
async function fetchFromScraperAPI(query: string, page: number = 1) {
  try {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&page=${page}`;
    const response = await axios.get('https://api.scraperapi.com', {
      params: {
        api_key: process.env.SCRAPERAPI_KEY,
        url: url,
        render: true,
        country_code: 'in',
        premium: true,
        retry: 3,
        timeout: 30000
      },
      timeout: API_TIMEOUT,
    });

    const $ = cheerio.load(response.data);
    const products: ScrapedProduct[] = [];

    $('div[data-component-type="s-search-result"]').each((_, element) => {
      // Extract price from the price element
      const priceText = $(element).find('.a-price-whole').text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

      // Extract original price if available
      const originalPriceText = $(element).find('.a-text-strike').text().trim();
      const originalPrice = parseFloat(originalPriceText.replace(/[^0-9.]/g, '')) || 0;

      products.push({
        name: $(element).find('h2 a span').text().trim() || 'Unknown Product',
        price: price,
        imageUrl: $(element).find('img.s-image').attr('src') || '/placeholder.svg',
        url: normalizeUrl($(element).find('h2 a').attr('href') || '#', 'https://www.amazon.in'),
        rating: parseFloat($(element).find('.a-icon-star-small').text()) || 0,
        reviews: parseInt($(element).find('.a-size-small .a-link-normal').text()) || 0,
        description: $(element).find('.a-size-base-plus').text().trim() || '',
        brand: $(element).find('.a-size-base-plus').text().trim() || '',
        category: $(element).find('.a-color-secondary .a-size-base').text().trim() || '',
        specifications: $(element).find('.a-unordered-list').text().trim() || '',
        originalPrice: originalPrice,
        discount: originalPrice > 0 ? ((originalPrice - price) / originalPrice * 100) : 0,
        seller: $(element).find('.a-size-base-plus').text().trim() || '',
        shipping: $(element).find('.a-size-base-plus').text().trim() || '',
        inStock: $(element).find('.a-color-success').length > 0,
        lastUpdated: new Date().toISOString(),
        site: 'Amazon'
      });
    });

    return products;
  } catch (error) {
    console.error('Error fetching from ScraperAPI:', error);
    return [];
  }
}

// Function to fetch products using ScrapingBee
async function fetchFromScrapingBee(site: string, query: string): Promise<ScrapedProduct[]> {
  try {
    const apiKey = getScrapingBeeKey()
    if (!apiKey) {
      console.error('ScrapingBee API key not configured')
      return []
    }

    const config = SCRAPING_CONFIG[site as keyof typeof SCRAPING_CONFIG]
    if (!config) {
      console.error(`No configuration found for ${site}`)
      return []
    }

    const searchUrl = encodeURI(config.searchUrl(query, 1))
    console.log(`Fetching from ${site} using ScrapingBee:`, searchUrl)

    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        api_key: apiKey,
        url: searchUrl,
        render_js: 'true',
        premium_proxy: 'true'
      },
      timeout: API_TIMEOUT,
    })

    if (!response.data) {
      console.error(`ScrapingBee request failed for ${site}: No data received`)
      return []
    }

    return extractProductsFromHtml(response.data, site)
  } catch (error) {
    console.error(`Error fetching from ${site} using ScrapingBee:`, error)
    return []
  }
}

// Function to fetch products using ZenRows
async function fetchFromZenRows(site: string, query: string): Promise<ScrapedProduct[]> {
  try {
    if (!ZENROWS_API_KEY) {
      console.error('ZenRows API key not configured')
      return []
    }

    const config = SCRAPING_CONFIG[site as keyof typeof SCRAPING_CONFIG]
    if (!config) {
      console.error(`No configuration found for ${site}`)
      return []
    }

    const searchUrl = encodeURI(config.searchUrl(query, 1))
    console.log(`Fetching from ${site} using ZenRows:`, searchUrl)

    const response = await axios.get('https://api.zenrows.com/v1/', {
      params: {
        apikey: ZENROWS_API_KEY,
        url: searchUrl,
        js_render: 'true',
        premium_proxy: 'true',
        antibot: 'true'
      },
      timeout: API_TIMEOUT,
    })

    if (!response.data) {
      console.error(`ZenRows request failed for ${site}: No data received`)
      return []
    }

    return extractProductsFromHtml(response.data, site)
  } catch (error) {
    console.error(`Error fetching from ${site} using ZenRows:`, error)
    return []
  }
}

// Function to extract products from HTML
function extractProductsFromHtml(html: string, site: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = []
  const config = SCRAPING_CONFIG[site as keyof typeof SCRAPING_CONFIG]

  if (!config) return products

  const $ = cheerio.load(html)
  const productElements = $(config.selectors.products)

  productElements.each((_, element) => {
    try {
      const $element = $(element)
      const name = $element.find(config.selectors.name).first().text().trim()
      const priceText = $element.find(config.selectors.price).first().text().trim()
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0
      const imageUrl = $element.find(config.selectors.image).first().attr('src') || ''
      const ratingText = $element.find(config.selectors.rating).first().text().trim()
      const rating = parseFloat(ratingText) || 0
      const reviewsText = $element.find(config.selectors.reviews).first().text().trim()
      const reviews = parseInt(reviewsText.replace(/[^0-9]/g, '')) || 0
      const description = $element.find(config.selectors.description).first().text().trim()
      const availability = $element.find(config.selectors.availability).first().text().trim()
      const brand = $element.find(config.selectors.brand).first().text().trim()
      const category = $element.find(config.selectors.category).first().text().trim()
      const specifications = $element.find(config.selectors.specifications).first().text().trim()
      const originalPriceText = $element.find(config.selectors.originalPrice).first().text().trim()
      const originalPrice = parseFloat(originalPriceText.replace(/[^0-9.]/g, '')) || 0
      const discountText = $element.find(config.selectors.discount).first().text().trim()
      const discount = parseFloat(discountText.replace(/[^0-9.]/g, '')) || 0
      const seller = $element.find(config.selectors.seller).first().text().trim()
      const shipping = $element.find(config.selectors.shipping).first().text().trim()
      const inStock = $element.find(config.selectors.inStock).first().text().trim().includes('In Stock')
      const lastUpdated = $element.find(config.selectors.lastUpdated).first().text().trim()

      // Get product URL
      const productUrl = $element.find('a').first().attr('href') || ''
      const url = productUrl.startsWith('http') ? productUrl :
        productUrl.startsWith('//') ? `https:${productUrl}` :
          productUrl.startsWith('/') ? `${config.baseUrl}${productUrl}` :
            productUrl

      if (name && price > 0) {
        products.push({
          name,
          price,
          site,
          imageUrl: imageUrl.startsWith('http') ? imageUrl :
            imageUrl.startsWith('//') ? `https:${imageUrl}` :
              imageUrl.startsWith('/') ? `${config.baseUrl}${imageUrl}` :
                '/placeholder.svg?height=200&width=200',
          url,
          description,
          rating,
          reviews,
          availability,
          brand,
          category,
          specifications: { text: specifications },
          originalPrice,
          discount,
          seller,
          shipping,
          inStock,
          lastUpdated
        })
      }
    } catch (error) {
      console.error(`Error extracting product from ${site}:`, error)
    }
  })

  return products
}

// Update the test products generation to include more realistic data
function generateTestProducts(query: string): ScrapedProduct[] {
  const testProducts: ScrapedProduct[] = []
  const sites = ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio']

  // Generate 5 test products
  for (let i = 0; i < 5; i++) {
    const basePrice = Math.floor(Math.random() * 2000) + 500
    const discount = Math.floor(Math.random() * 40) + 10

    sites.forEach(site => {
      const price = Math.floor(basePrice * (1 - discount / 100))
      testProducts.push({
        name: `${query} ${i + 1}`,
        price,
        site,
        imageUrl: `/placeholder.svg?height=200&width=200`,
        url: `https://${site}.com/product/${i + 1}`,
        description: `Test ${query} product ${i + 1}`,
        rating: 3.5 + Math.random() * 1.5,
        reviews: Math.floor(Math.random() * 1000) + 100,
        availability: 'In Stock',
        brand: 'Test Brand',
        category: query,
        specifications: {
          'Material': 'Cotton',
          'Size': 'M',
          'Color': 'Blue'
        },
        originalPrice: basePrice,
        discount,
        seller: 'Test Seller',
        shipping: 'Free Delivery',
        inStock: true,
        lastUpdated: new Date().toISOString()
      })
    })
  }

  return testProducts
}

/**
 * Filters out products that are irrelevant to the user's query.
 * For example, if searching for 'iPhone', it removes 'Samsung' or 'OnePlus' results.
 */
function filterIrrelevantProducts(products: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  
  // Extract brand and numbers from query
  const brands = ['apple', 'iphone', 'samsung', 'oneplus', 'oppo', 'vivo', 'realme', 'xiaomi', 'redmi', 'google', 'pixel', 'sony', 'one plus'];
  const targetBrand = brands.find(b => queryLower.includes(b));
  const queryNumbers = queryLower.match(/\d+/g) || [];

  return products.filter(p => {
    // Determine if it's a grouped product or raw product
    const pName = p.productName || p.name;
    if (!pName) return false;
    const nameLower = pName.toLowerCase();
    
    // 1. Brand Enforcement
    if (targetBrand) {
      const isApple = targetBrand === 'iphone' || targetBrand === 'apple';
      if (isApple) {
        if (!nameLower.includes('apple') && !nameLower.includes('iphone')) return false;
      } else {
        const brandToMatch = targetBrand === 'one plus' ? 'oneplus' : targetBrand;
        if (!nameLower.includes(brandToMatch) && !nameLower.includes(targetBrand)) return false;
      }
    }

    // 2. Strict Model/Number Matching
    // If user specifies a number (like '15' in 'iPhone 15'), the product MUST have that number
    // to avoid showing 'iPhone 14' or 'OnePlus 12'.
    for (const num of queryNumbers) {
      if (num.length >= 2) { // Only check for 2+ digit numbers like '15', '14', '256'
        const regex = new RegExp(`\\b${num}\\b`); 
        if (!regex.test(nameLower)) return false;
      }
    }

    // 3. Keyword Match
    const matchCount = queryWords.filter(word => nameLower.includes(word)).length;
    if (queryWords.length > 0 && matchCount === 0) return false;

    // 4. Accessory Filtering
    const irrelevantKeywords = ['case', 'cover', 'tempered', 'adapter', 'cable', 'charger', 'strap', 'pouch'];
    if (irrelevantKeywords.some(key => nameLower.includes(key)) && !queryLower.includes(key)) {
      return false;
    }

    return true;
  });
}
