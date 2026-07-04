import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
const connectionOptions = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 30000,
  tls: true,
}

const globalWithMongo = global as typeof globalThis & {
  _mongoClient?: MongoClient | null
  _mongoClientPromise?: Promise<MongoClient | null> | null
}

let client: MongoClient | null = globalWithMongo._mongoClient ?? null
let clientPromise: Promise<MongoClient | null> | null = globalWithMongo._mongoClientPromise ?? null

if (!uri) {
  console.warn("[MONGODB] MONGODB_URI is not set. Authentication will use fallback storage.")
} else {
  console.log("[MONGODB] URI is configured, attempting to connect...")
}

let lastFailure = 0
const FAILURE_COOLDOWN = 60000 // 1 minute

function initializeClientPromise(): Promise<MongoClient | null> {
  const now = Date.now()
  if (client === null && now - lastFailure < FAILURE_COOLDOWN) {
    return Promise.resolve(null)
  }

  if (!uri) {
    return Promise.resolve(null)
  }

  if (!clientPromise || (client === null && uri)) {
    console.log("[MONGODB] Creating new client connection...")
    const mongoClient = new MongoClient(uri, connectionOptions)

    clientPromise = Promise.race([
      mongoClient.connect().then((connectedClient) => {
        console.log("[MONGODB] Connected successfully")
        client = connectedClient
        globalWithMongo._mongoClient = client
        return connectedClient
      }),
      new Promise<null>((resolve) => {
        // Increase timeout to 10 seconds
        setTimeout(() => {
          console.warn("[MONGODB] Connection attempt timed out after 10s")
          lastFailure = Date.now()
          resolve(null)
        }, 10000)
      }),
    ]).catch((error) => {
      console.error("[MONGODB] Failed to initialize MongoDB client:", error)
      lastFailure = Date.now()
      client = null
      globalWithMongo._mongoClient = null
      return null
    }) as Promise<MongoClient | null>

    globalWithMongo._mongoClientPromise = clientPromise
  }

  return clientPromise
}

export default clientPromise

export async function getDatabase() {
  try {
    const connectedClient = await initializeClientPromise()

    if (!connectedClient) {
      console.warn("[MONGODB] Client not initialized. Using fallback storage.")
      return null
    }

    console.log("[MONGODB] Successfully connected to database")
    return connectedClient.db("pricetracker")
  } catch (error) {
    console.error("[MONGODB] Failed to get database:", error)
    return null
  }
}

export function isMongoAvailable(): boolean {
  return !!uri && !!client
}

export async function testConnection(): Promise<boolean> {
  try {
    const connectedClient = await initializeClientPromise()
    if (!connectedClient) {
      return false
    }

    await connectedClient.db("admin").command({ ping: 1 })
    return true
  } catch (error) {
    console.error("MongoDB connection test failed:", error)
    return false
  }
}
