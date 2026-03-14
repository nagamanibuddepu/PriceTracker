import { getWishlist } from "@/lib/wishlist"
import { getCurrentUser } from "@/lib/auth"
import { WishlistContent } from "@/components/wishlist-content"
import { redirect } from "next/navigation"

export default async function WishlistPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")
  }

  const wishlistItems = await getWishlist()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Wishlist</h1>
        <p className="text-muted-foreground">Track your favorite products and get notified when prices drop</p>
      </div>

      <WishlistContent initialItems={wishlistItems} />
    </div>
  )
}
