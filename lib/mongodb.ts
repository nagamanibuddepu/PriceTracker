import { MongoClient } from "mongodb"

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

// Check if MongoDB URI is available
const uri = process.env.MONGODB_URI

if (!uri) {
  console.warn("MONGODB_URI is not set. Authentication will use fallback storage.")
} else {
  console.log("[MONGODB] URI is configured, attempting to connect...")
}

// Only try to connect if URI is available
if (uri) {
  try {
    if (process.env.NODE_ENV === "development") {
      // In development mode, use a global variable so that the value
      // is preserved across module reloads caused by HMR (Hot Module Replacement).
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>
      }

      if (!globalWithMongo._mongoClientPromise) {
        console.log("[MONGODB] Creating new client connection...")
        client = new MongoClient(uri)
        globalWithMongo._mongoClientPromise = client.connect()
      }
      clientPromise = globalWithMongo._mongoClientPromise
      console.log("[MONGODB] Using existing client connection")
    } else {
      // In production mode, it's best to not use a global variable.
      console.log("[MONGODB] Creating new client connection (production)...")
      client = new MongoClient(uri)
      clientPromise = client.connect()
    }
  } catch (error) {
    console.error("[MONGODB] Failed to initialize MongoDB client:", error)
    clientPromise = null
  }
}

export default clientPromise

export async function getDatabase() {
  try {
    if (!clientPromise) {
      console.warn("[MONGODB] Client not initialized. Using fallback storage.")
      return null
    }

    const client = await clientPromise
    console.log("[MONGODB] Successfully connected to database")
    return client.db("pricetracker")
  } catch (error) {
    console.error("[MONGODB] Failed to get database:", error)
    return null
  }
}

export function isMongoAvailable(): boolean {
  return !!uri && !!clientPromise
}

// Add a function to test the connection
export async function testConnection(): Promise<boolean> {
  try {
    if (!clientPromise) {
      return false
    }
    const client = await clientPromise
    await client.db("admin").command({ ping: 1 })
    return true
  } catch (error) {
    console.error("MongoDB connection test failed:", error)
    return false
  }
}
