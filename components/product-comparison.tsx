import Image from "next/image"
import { ExternalLink, Star, Users, ShoppingCart, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { WishlistButton } from "@/components/wishlist-button"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface Retailer {
  site: string
  price: number
  url: string
  imageUrl: string
  rating?: number
  reviews?: number
  originalPrice?: number
}

interface ProductData {
  productName: string
  retailers: Retailer[]
  lowestPrice: number
  lowestPriceSite: string
  category?: string
  avgRating?: number
}

interface ProductComparisonProps {
  products: ProductData[]
}

export function ProductComparison({ products }: ProductComparisonProps) {
  const formatPrice = (price: number | string | undefined | null) => {
    if (price === undefined || price === null) return 'N/A';
    const numPrice = Number(price);
    if (isNaN(numPrice)) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numPrice);
  }

  const getSiteLogo = (site: string | undefined | null) => {
    if (!site) return "🏪";
    
    switch (site.toLowerCase()) {
      case "amazon":
        return "🛒"
      case "flipkart":
        return "🛍️"
      case "myntra":
        return "👕"
      case "nykaa":
        return "💄"
      case "ajio":
        return "👔"
      case "meesho":
        return "📦"
      default:
        return "🏪"
    }
  }

  const getSiteColor = (site: string | undefined | null) => {
    if (!site) return "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800";
    
    switch (site.toLowerCase()) {
      case "amazon":
        return "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800/50"
      case "flipkart":
        return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50"
      case "myntra":
        return "bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800/50"
      case "nykaa":
        return "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/50"
      case "ajio":
        return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/50"
      case "meesho":
        return "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/50"
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800"
    }
  }

  const formatRating = (rating: number | undefined | null) => {
    if (rating === undefined || rating === null) return 'N/A';
    const numRating = Number(rating);
    if (isNaN(numRating)) return 'N/A';
    return numRating.toFixed(1);
  }

  const formatReviews = (reviews: number | undefined | null) => {
    if (reviews === undefined || reviews === null) return 0;
    const numReviews = Number(reviews);
    return isNaN(numReviews) ? 0 : numReviews;
  }

  const calculateSavings = (currentPrice: number, lowestPrice: number) => {
    if (currentPrice <= lowestPrice) return 0
    return ((currentPrice - lowestPrice) / currentPrice) * 100
  }

  const findLowestPrice = (retailers: Retailer[]) => {
    return Math.min(...retailers.map(r => {
      const price = Number(r.price);
      return isNaN(price) ? Infinity : price;
    }));
  }

  // Find the absolute lowest price across all products
  const globalLowestPrice = Math.min(...products.flatMap((product) => product.retailers.map((r) => r.price)))

  const handleProductClick = (url: string) => {
    console.log("[ProductClick] Attempting to open URL:", url)
    
    // Check if URL is empty or invalid
    if (!url || url === '#') {
      console.error('[ProductClick] Invalid or empty URL:', url)
      alert('Sorry, this product link is not available at the moment.')
      return
    }

    try {
      // Direct approach instead of URL constructor parsing:
      // If it looks like a relative path but it's supposed to be an outbound link, we should catch it.
      let finalUrl = url;
      if (url.startsWith('//')) {
        finalUrl = `https:${url}`
      } else if (!url.startsWith('http')) {
        // Many scraper URLs come back as domain.com/path instead of https://domain.com/path
        finalUrl = `https://${url}`
      }
      
      console.log("[ProductClick] Opening final URL:", finalUrl)
      window.open(finalUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('[ProductClick] Error handling product URL:', error, 'URL:', url)
      alert('Sorry, this product link is not available at the moment. Please try again later.')
    }
  }

  const getStoreName = (site: string | undefined | null) => {
    if (!site) return "Unknown Store";
    
    switch (site.toLowerCase()) {
      case "amazon":
        return "Amazon"
      case "flipkart":
        return "Flipkart"
      case "myntra":
        return "Myntra"
      case "meesho":
        return "Meesho"
      case "ajio":
        return "Ajio"
      default:
        return site.charAt(0).toUpperCase() + site.slice(1)
    }
  }

  return (
    <div className="space-y-8">
      {products.map((product, index) => (
        <Card key={index} className="overflow-hidden border-border/60 shadow-md hover:shadow-xl transition-all duration-300 group/card">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/30 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {product.productName}
                {product.category && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({product.category})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-4">
                {product.avgRating && product.avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{product.avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">avg</span>
                  </div>
                )}
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {product.retailers.length} store{product.retailers.length !== 1 ? "s" : ""}
                </Badge>
                <WishlistButton
                  productName={product.productName}
                  imageUrl={product.retailers[0]?.imageUrl || "/placeholder.svg?height=200&width=200"}
                  currentPrice={product.lowestPrice}
                  retailers={product.retailers.map((r) => ({
                    site: r.site,
                    price: r.price,
                    url: r.url,
                  }))}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Store</TableHead>
                  <TableHead>Product Details</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.retailers
                  .sort((a, b) => a.price - b.price)
                  .map((retailer, idx) => {
                    const isLowestPrice = retailer.site === product.lowestPriceSite
                    const isGlobalBestPrice = retailer.price === globalLowestPrice
                    const savings = calculateSavings(retailer.price, product.lowestPrice)

                    return (
                      <TableRow
                        key={idx}
                        className={`${isLowestPrice ? "bg-green-50/80 dark:bg-green-900/30" : ""} ${getSiteColor(retailer.site)} transition-colors hover:bg-muted/50 group/row`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getSiteLogo(retailer.site)}</span>
                            <span className="font-medium">{getStoreName(retailer.site)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-16 relative overflow-hidden rounded-xl border border-border/50 shadow-sm group-hover/row:scale-105 transition-transform duration-300">
                              <Image
                                src={retailer.imageUrl || "/placeholder.svg?height=64&width=64"}
                                alt={product.productName}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg?height=64&width=64"
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="line-clamp-2 text-sm font-medium">{product.productName}</div>
                              <div className="flex items-center gap-2">
                                {retailer.rating !== undefined && retailer.rating !== null && !isNaN(retailer.rating) && (
                                  <div className="flex items-center">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span className="ml-1 font-medium">{formatRating(retailer.rating)}</span>
                                  </div>
                                )}
                                {retailer.reviews !== undefined && retailer.reviews !== null && !isNaN(retailer.reviews) && retailer.reviews > 0 && (
                                  <div className="flex items-center text-muted-foreground">
                                    <MessageSquare className="h-3 w-3" />
                                    <span className="ml-1 text-xs">{formatReviews(retailer.reviews)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-lg font-bold">
                            {formatPrice(retailer.price)}
                            {Number(retailer.price) === findLowestPrice(product.retailers) && (
                              <span className="ml-2 text-xs font-normal text-green-600">Best Price</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            {retailer.rating !== undefined && retailer.rating !== null && !isNaN(retailer.rating) && (
                              <div className="flex items-center">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="ml-1 font-medium">{formatRating(retailer.rating)}</span>
                              </div>
                            )}
                            {retailer.reviews !== undefined && retailer.reviews !== null && !isNaN(retailer.reviews) && retailer.reviews > 0 && (
                              <div className="flex items-center text-muted-foreground">
                                <MessageSquare className="h-3 w-3" />
                                <span className="ml-1 text-xs">{formatReviews(retailer.reviews)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => handleProductClick(retailer.url)}
                            className="inline-flex items-center justify-center w-full gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-full shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all"
                          >
                            {isGlobalBestPrice ? (
                              <>
                                <ShoppingCart className="h-3 w-3" /> Buy Now
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-3 w-3" /> View Deal
                              </>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>

            <div className="px-4 pb-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="price-history" className="border-none">
                  <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline hover:text-indigo-600 transition-colors">
                    View Price History & Trends
                  </AccordionTrigger>
                  <AccordionContent>
                    <PriceHistoryChart productId={product.productName} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CardContent>
        </Card>
      ))}

      {products.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <div className="text-lg font-medium">No products found</div>
            <div className="text-sm">
              Try searching for popular items like "iPhone", "laptop", "shoes", or "headphones"
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
