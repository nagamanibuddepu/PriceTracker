"use server"

import { getCurrentUser } from "./auth"
import { getDatabase, isMongoAvailable } from "./mongodb"

interface WishlistItem {
  _id?: any
  id: string
  userId: string
  productName: string
  imageUrl: string
  currentPrice: number
  targetPrice?: number
  lowestSeenPrice: number
  retailers: Array<{
    site: string
    price: number
    url: string
  }>
  alertEnabled: boolean
  createdAt: string
  updatedAt: string
}

// Fallback storage
const fallbackWishlistItems: Map<string, WishlistItem> = new Map()
const fallbackPriceAlerts: Map<string, any> = new Map()

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function addToWishlist(
  productName: string,
  imageUrl: string,
  currentPrice: number,
  retailers: Array<{ site: string; price: number; url: string }>,
  targetPrice?: number,
): Promise<{ success: boolean; error?: string; itemId?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "Please login to add items to wishlist" }
    }

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const wishlistItems = db.collection("wishlistItems")
      const priceAlerts = db.collection("priceAlerts")

      const existingItem = await wishlistItems.findOne({
        userId: user.id,
        productName: { $regex: new RegExp(productName, "i") },
      })

      if (existingItem) {
        return { success: false, error: "Item already in wishlist" }
      }

      const itemId = generateId()
      const wishlistItem: WishlistItem = {
        id: itemId,
        userId: user.id,
        productName,
        imageUrl,
        currentPrice,
        targetPrice,
        lowestSeenPrice: currentPrice,
        retailers,
        alertEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await wishlistItems.insertOne(wishlistItem)

      const alertId = generateId()
      const priceAlert = {
        id: alertId,
        userId: user.id,
        wishlistItemId: itemId,
        alertType: targetPrice ? "threshold" : "any_drop",
        targetPrice,
        isActive: true,
        createdAt: new Date().toISOString(),
      }

      await priceAlerts.insertOne(priceAlert)

      return { success: true, itemId }
    } else {
      // Use fallback storage
      for (const item of fallbackWishlistItems.values()) {
        if (item.userId === user.id && item.productName.toLowerCase() === productName.toLowerCase()) {
          return { success: false, error: "Item already in wishlist" }
        }
      }

      const itemId = generateId()
      const wishlistItem: WishlistItem = {
        id: itemId,
        userId: user.id,
        productName,
        imageUrl,
        currentPrice,
        targetPrice,
        lowestSeenPrice: currentPrice,
        retailers,
        alertEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      fallbackWishlistItems.set(itemId, wishlistItem)

      const alertId = generateId()
      fallbackPriceAlerts.set(alertId, {
        id: alertId,
        userId: user.id,
        wishlistItemId: itemId,
        alertType: targetPrice ? "threshold" : "any_drop",
        targetPrice,
        isActive: true,
        createdAt: new Date().toISOString(),
      })

      return { success: true, itemId }
    }
  } catch (error) {
    console.error("Add to wishlist error:", error)
    return { success: false, error: "Failed to add to wishlist" }
  }
}

export async function removeFromWishlist(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "Please login" }
    }

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const wishlistItems = db.collection("wishlistItems")
      const priceAlerts = db.collection("priceAlerts")

      const item = await wishlistItems.findOne({ id: itemId, userId: user.id })
      if (!item) {
        return { success: false, error: "Item not found" }
      }

      await wishlistItems.deleteOne({ id: itemId })
      await priceAlerts.deleteMany({ wishlistItemId: itemId })

      return { success: true }
    } else {
      // Use fallback storage
      const item = fallbackWishlistItems.get(itemId)
      if (!item || item.userId !== user.id) {
        return { success: false, error: "Item not found" }
      }

      fallbackWishlistItems.delete(itemId)

      for (const [alertId, alert] of fallbackPriceAlerts.entries()) {
        if (alert.wishlistItemId === itemId) {
          fallbackPriceAlerts.delete(alertId)
        }
      }

      return { success: true }
    }
  } catch (error) {
    console.error("Remove from wishlist error:", error)
    return { success: false, error: "Failed to remove from wishlist" }
  }
}

export async function getWishlist(): Promise<WishlistItem[]> {
  try {
    const user = await getCurrentUser()
    if (!user) return []

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const wishlistItems = db.collection("wishlistItems")
      const items = await wishlistItems.find({ userId: user.id }).sort({ updatedAt: -1 }).toArray()

      return items.map((item) => ({
        id: item.id,
        userId: item.userId,
        productName: item.productName,
        imageUrl: item.imageUrl,
        currentPrice: item.currentPrice,
        targetPrice: item.targetPrice,
        lowestSeenPrice: item.lowestSeenPrice,
        retailers: item.retailers,
        alertEnabled: item.alertEnabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
    } else {
      // Use fallback storage
      const userItems: WishlistItem[] = []
      for (const item of fallbackWishlistItems.values()) {
        if (item.userId === user.id) {
          userItems.push(item)
        }
      }

      return userItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
  } catch (error) {
    console.error("Get wishlist error:", error)
    return []
  }
}

export async function updatePriceAlert(
  itemId: string,
  targetPrice?: number,
  alertEnabled = true,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "Please login" }
    }

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const wishlistItems = db.collection("wishlistItems")
      const priceAlerts = db.collection("priceAlerts")

      const item = await wishlistItems.findOne({ id: itemId, userId: user.id })
      if (!item) {
        return { success: false, error: "Item not found" }
      }

      await wishlistItems.updateOne(
        { id: itemId },
        {
          $set: {
            targetPrice,
            alertEnabled,
            updatedAt: new Date().toISOString(),
          },
        },
      )

      const existingAlert = await priceAlerts.findOne({ wishlistItemId: itemId, userId: user.id })

      if (existingAlert) {
        await priceAlerts.updateOne(
          { id: existingAlert.id },
          {
            $set: {
              alertType: targetPrice ? "threshold" : "any_drop",
              targetPrice,
              isActive: alertEnabled,
            },
          },
        )
      } else if (alertEnabled) {
        const alertId = generateId()
        const priceAlert = {
          id: alertId,
          userId: user.id,
          wishlistItemId: itemId,
          alertType: targetPrice ? "threshold" : "any_drop",
          targetPrice,
          isActive: true,
          createdAt: new Date().toISOString(),
        }
        await priceAlerts.insertOne(priceAlert)
      }

      return { success: true }
    } else {
      // Use fallback storage
      const item = fallbackWishlistItems.get(itemId)
      if (!item || item.userId !== user.id) {
        return { success: false, error: "Item not found" }
      }

      item.targetPrice = targetPrice
      item.alertEnabled = alertEnabled
      item.updatedAt = new Date().toISOString()
      fallbackWishlistItems.set(itemId, item)

      let alertFound = false
      for (const [alertId, alert] of fallbackPriceAlerts.entries()) {
        if (alert.wishlistItemId === itemId && alert.userId === user.id) {
          alert.alertType = targetPrice ? "threshold" : "any_drop"
          alert.targetPrice = targetPrice
          alert.isActive = alertEnabled
          fallbackPriceAlerts.set(alertId, alert)
          alertFound = true
          break
        }
      }

      if (!alertFound && alertEnabled) {
        const alertId = generateId()
        fallbackPriceAlerts.set(alertId, {
          id: alertId,
          userId: user.id,
          wishlistItemId: itemId,
          alertType: targetPrice ? "threshold" : "any_drop",
          targetPrice,
          isActive: true,
          createdAt: new Date().toISOString(),
        })
      }

      return { success: true }
    }
  } catch (error) {
    console.error("Update price alert error:", error)
    return { success: false, error: "Failed to update price alert" }
  }
}

export async function isInWishlist(productName: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) return false

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const wishlistItems = db.collection("wishlistItems")
      const item = await wishlistItems.findOne({
        userId: user.id,
        productName: { $regex: new RegExp(productName, "i") },
      })

      return !!item
    } else {
      // Use fallback storage
      for (const item of fallbackWishlistItems.values()) {
        if (item.userId === user.id && item.productName.toLowerCase() === productName.toLowerCase()) {
          return true
        }
      }

      return false
    }
  } catch (error) {
    console.error("Is in wishlist error:", error)
    return false
  }
}
