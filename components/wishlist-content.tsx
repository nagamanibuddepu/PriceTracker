"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, Bell, Trash2, Edit, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { removeFromWishlist, updatePriceAlert } from "@/lib/wishlist"

interface WishlistItem {
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

interface WishlistContentProps {
  initialItems: WishlistItem[]
}

export function WishlistContent({ initialItems }: WishlistContentProps) {
  const [items, setItems] = useState<WishlistItem[]>(initialItems)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [targetPrice, setTargetPrice] = useState("")
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price)
  }

  const handleRemoveItem = async (itemId: string) => {
    const result = await removeFromWishlist(itemId)
    if (result.success) {
      setItems(items.filter((item) => item.id !== itemId))
    }
  }

  const handleUpdateAlert = async () => {
    if (!editingItem) return

    setIsLoading(true)
    setError("")

    try {
      const targetPriceNum = targetPrice ? Number.parseFloat(targetPrice) : undefined

      if (targetPrice && (isNaN(targetPriceNum!) || targetPriceNum! <= 0)) {
        setError("Please enter a valid target price")
        setIsLoading(false)
        return
      }

      const result = await updatePriceAlert(editingItem.id, targetPriceNum, alertEnabled)

      if (result.success) {
        setItems(
          items.map((item) =>
            item.id === editingItem.id ? { ...item, targetPrice: targetPriceNum, alertEnabled } : item,
          ),
        )
        setEditingItem(null)
        setTargetPrice("")
      } else {
        setError(result.error || "Failed to update alert")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (item: WishlistItem) => {
    setEditingItem(item)
    setTargetPrice(item.targetPrice?.toString() || "")
    setAlertEnabled(item.alertEnabled)
    setError("")
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your wishlist is empty</h2>
        <p className="text-muted-foreground mb-4">
          Start adding products to track their prices and get notified of deals
        </p>
        <Button asChild>
          <a href="/">Browse Products</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const lowestRetailerPrice = Math.min(...item.retailers.map((r) => r.price))
          const priceDropped = lowestRetailerPrice < item.currentPrice
          const targetMet = item.targetPrice && lowestRetailerPrice <= item.targetPrice

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">{item.productName}</CardTitle>
                  <div className="flex gap-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Price Alert</DialogTitle>
                          <DialogDescription>Update your price alert settings for this product</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="font-medium text-sm">{editingItem?.productName}</div>
                            <div className="text-lg font-bold text-green-600">{formatPrice(lowestRetailerPrice)}</div>
                            <div className="text-xs text-muted-foreground">Current lowest price</div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="editTargetPrice">Target Price (Optional)</Label>
                            <Input
                              id="editTargetPrice"
                              type="number"
                              placeholder={`Enter target price (current: ${formatPrice(lowestRetailerPrice)})`}
                              value={targetPrice}
                              onChange={(e) => setTargetPrice(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="editAlertEnabled"
                              checked={alertEnabled}
                              onCheckedChange={setAlertEnabled}
                              disabled={isLoading}
                            />
                            <Label htmlFor="editAlertEnabled" className="text-sm">
                              <Bell className="h-4 w-4 inline mr-1" />
                              Enable price drop alerts
                            </Label>
                          </div>

                          {error && (
                            <Alert variant="destructive">
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          )}

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setEditingItem(null)}
                              disabled={isLoading}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateAlert} disabled={isLoading} className="flex-1">
                              {isLoading ? "Updating..." : "Update Alert"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 relative overflow-hidden rounded border">
                    <Image
                      src={item.imageUrl || "/placeholder.svg"}
                      alt={item.productName}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg?height=64&width=64"
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-green-600">{formatPrice(lowestRetailerPrice)}</div>
                    <div className="text-sm text-muted-foreground">Lowest: {formatPrice(item.lowestSeenPrice)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {targetMet && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      🎯 Target Price Reached!
                    </Badge>
                  )}
                  {priceDropped && (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                      📉 Price Dropped!
                    </Badge>
                  )}
                  {item.targetPrice && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium">{formatPrice(item.targetPrice)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm">
                    <Bell className={`h-3 w-3 ${item.alertEnabled ? "text-green-500" : "text-gray-400"}`} />
                    <span className="text-muted-foreground">Alerts {item.alertEnabled ? "enabled" : "disabled"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Available at:</div>
                  {item.retailers.slice(0, 3).map((retailer, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{retailer.site}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatPrice(retailer.price)}</span>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={retailer.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {item.retailers.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{item.retailers.length - 3} more stores</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
