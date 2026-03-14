"use client"

import { useState, useEffect } from "react"
import { Heart, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { addToWishlist, isInWishlist } from "@/lib/wishlist"
import { getCurrentUser } from "@/lib/auth"

interface WishlistButtonProps {
  productName: string
  imageUrl: string
  currentPrice: number
  retailers: Array<{
    site: string
    price: number
    url: string
  }>
}

export function WishlistButton({ productName, imageUrl, currentPrice, retailers }: WishlistButtonProps) {
  const [isInWishlistState, setIsInWishlistState] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [targetPrice, setTargetPrice] = useState("")
  const [enableAlerts, setEnableAlerts] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkWishlistStatus = async () => {
      const currentUser = await getCurrentUser()
      setUser(currentUser)

      if (currentUser) {
        const inWishlist = await isInWishlist(productName)
        setIsInWishlistState(inWishlist)
      }
    }

    checkWishlistStatus()
  }, [productName])

  const handleAddToWishlist = async () => {
    if (!user) {
      setError("Please login to add items to wishlist")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const targetPriceNum = targetPrice ? Number.parseFloat(targetPrice) : undefined

      if (targetPrice && (isNaN(targetPriceNum!) || targetPriceNum! <= 0)) {
        setError("Please enter a valid target price")
        setIsLoading(false)
        return
      }

      const result = await addToWishlist(productName, imageUrl, currentPrice, retailers, targetPriceNum)

      if (result.success) {
        setIsInWishlistState(true)
        setIsDialogOpen(false)
        setTargetPrice("")
      } else {
        setError(result.error || "Failed to add to wishlist")
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price)
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Heart className="h-4 w-4 mr-1" />
        Login to Save
      </Button>
    )
  }

  if (isInWishlistState) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Heart className="h-4 w-4 mr-1 fill-red-500 text-red-500" />
        In Wishlist
      </Button>
    )
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Heart className="h-4 w-4 mr-1" />
          Add to Wishlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Wishlist</DialogTitle>
          <DialogDescription>
            Set up price alerts for this product. We'll notify you when the price drops.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-medium text-sm">{productName}</div>
            <div className="text-lg font-bold text-green-600">{formatPrice(currentPrice)}</div>
            <div className="text-xs text-muted-foreground">Current lowest price</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetPrice">Target Price (Optional)</Label>
            <Input
              id="targetPrice"
              type="number"
              placeholder={`Enter target price (current: ${formatPrice(currentPrice)})`}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">Leave empty to get notified of any price drop</p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="enableAlerts" checked={enableAlerts} onCheckedChange={setEnableAlerts} disabled={isLoading} />
            <Label htmlFor="enableAlerts" className="text-sm">
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAddToWishlist} disabled={isLoading} className="flex-1">
              {isLoading ? "Adding..." : "Add to Wishlist"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
