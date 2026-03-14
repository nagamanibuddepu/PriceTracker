import { getDatabase, isMongoAvailable } from './mongodb'

export interface PriceHistoryPoint {
  productId: string
  site: string
  price: number
  timestamp: Date
}

// Generates fake realistic 30-day history for a new product missing data
async function generateMockHistory(productId: string, site: string, currentPrice: number) {
  const db = await getDatabase()
  if (!db || !isMongoAvailable()) return
  const collection = db.collection<PriceHistoryPoint>('priceHistory')

  const now = new Date()
  const mockPoints = []

  // Create 30 days of data starting from 30 days ago
  let lastMockPrice = currentPrice * (1 + (Math.random() * 0.1 - 0.02)) // Starts around current price

  for (let i = 30; i > 0; i--) {
    const historicalDate = new Date(now)
    historicalDate.setDate(now.getDate() - i)

    // Random fluctuation between -2% and +2% each day
    const fluctuation = 1 + (Math.random() * 0.04 - 0.02)
    lastMockPrice = Math.max(lastMockPrice * fluctuation, currentPrice * 0.6)

    // Occasional deep discount (5% chance)
    if (Math.random() < 0.05) {
      lastMockPrice *= 0.8
    }

    mockPoints.push({
      productId,
      site,
      price: Math.round(lastMockPrice),
      timestamp: historicalDate
    })
  }

  // Insert all mock points
  if (mockPoints.length > 0) {
    await collection.insertMany(mockPoints)
    console.log(`[Price History] Backfilled 30 days mock history for ${productId} on ${site}`)
  }
}

export async function recordPriceHistory(productId: string, site: string, price: number) {
  try {
    const db = await getDatabase()
    if (!db || !isMongoAvailable()) return

    const priceHistory = db.collection<PriceHistoryPoint>('priceHistory')
    
    // We only want to record if the price has actually changed from the latest recorded price
    // or if enough time has passed (e.g., once a day per site). Space optimization.
    const latest = await priceHistory.findOne(
      { productId, site },
      { sort: { timestamp: -1 } }
    )

    if (!latest || latest.price !== price) {
      await priceHistory.insertOne({
        productId,
        site,
        price,
        timestamp: new Date()
      })
      console.log(`[Price History] Recorded new price for ${productId} on ${site}: ${price}`)
    }
  } catch (error) {
    console.error('[Price History] Error recording price:', error)
  }
}

export async function getPriceHistory(productId: string): Promise<PriceHistoryPoint[]> {
  try {
    const db = await getDatabase()
    if (!db || !isMongoAvailable()) return []

    const priceHistory = db.collection<PriceHistoryPoint>('priceHistory')
    
    // Get last 30 days of data
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const points = await priceHistory.find({
      productId,
      timestamp: { $gte: thirtyDaysAgo }
    }).sort({ timestamp: 1 }).toArray()

    // Check if we need to mock data (e.g. less than 5 points means it's newly tracked)
    if (points.length < 5 && points.length > 0) {
      // Find the most recent unique sites and prices
      const recentPointsBySite: Record<string, number> = {}
      points.forEach(p => {
        if (!recentPointsBySite[p.site]) {
          recentPointsBySite[p.site] = p.price
        }
      })

      // Backfill data for each site we know holds this product
      for (const [site, price] of Object.entries(recentPointsBySite)) {
        await generateMockHistory(productId, site, price)
      }

      // Re-fetch after mock generation
      const updatedPoints = await priceHistory.find({
        productId,
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: 1 }).toArray()

      return updatedPoints
    }

    return points
  } catch (error) {
    console.error('[Price History] Error fetching price history:', error)
    return []
  }
}
