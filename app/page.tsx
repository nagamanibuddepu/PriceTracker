"use client"
import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"

import { Settings, Zap, Shield, Globe } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { compareProducts, enqueueScraping } from "./actions"
import { ScrapingStatus } from "@/components/scraping-status"
import { EnhancedSearch } from "@/components/enhanced-search"
import { InfiniteProductList } from "@/components/infinite-product-list"

interface ProductData {
  productName: string
  retailers: Array<{
    site: string
    price: number
    url: string
    imageUrl: string
    rating?: number
    reviews?: number
  }>
  lowestPrice: number
  lowestPriceSite: string
  category?: string
  avgRating?: number
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<ProductData[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    setQuery(searchQuery)
    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const { success, jobId, error: enqueueError } = await enqueueScraping(searchQuery)
      if (!success || !jobId) {
        throw new Error(enqueueError || "Failed to start scraping")
      }

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scrape/${jobId}`)
          const data = await res.json()

          if (data.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setResults(data.data)
            setIsLoading(false)
            if (data.data.length === 0) {
              setError("No products found for your search. Try different keywords like 'iPhone', 'laptop', 'shoes', or 'headphones'.")
            }
          } else if (data.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setError(data.error || "Failed to fetch comparison data. Please try again.")
            setIsLoading(false)
          } else {
            // Actively stream in the partial results from the job's progress!
            if (data.progress && Array.isArray(data.progress) && data.progress.length > 0) {
              setResults(data.progress)
            }
          }
        } catch (err) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setError("Network error while checking status.")
          setIsLoading(false)
        }
      }, 1500) // Lowered polling to 1.5s for faster streams
    } catch (err: any) {
      setError(err.message || "Failed to start search.")
      setIsLoading(false)
    }
  }

  // Function to load more products (pagination)
  const loadMoreProducts = useCallback(async (searchQuery: string, page: number) => {
    try {
      console.log(`Loading page ${page} for "${searchQuery}"`)

      // Call the compareProducts function with page parameter
      const data = await compareProducts(searchQuery, page)
      return data
    } catch (error) {
      console.error("Error loading more products:", error)
      return []
    }
  }, [])

  return (
    <main className="container mx-auto px-4 py-16 relative min-h-screen animate-in fade-in duration-1000">
      {/* Animated Mesh Gradient Background & Float elements */}
      <div className="absolute inset-0 -z-10 mesh-gradient opacity-40"></div>

      <div className="text-center mb-16 space-y-5">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-400 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-100 text-transparent bg-clip-text drop-shadow-sm pb-2">
          Track Prices. Compare Smart. Save More.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
          The intelligent price tracker. Instantly find the absolute lowest prices, track history, and set alerts across all major Indian e-commerce stores.
        </p>
      </div>

        {/* Bento Grid Feature Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto mb-16 gap-4 auto-rows-[minmax(140px,auto)]">
          {/* Main Large Card spanning 2 cols */}
          <Card className="md:col-span-2 group relative overflow-hidden text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 border-border/20 bg-background/40 backdrop-blur-xl">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
              <Zap className="w-32 h-32" />
            </div>
            <CardHeader className="pb-2">
               <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-3">
                <Zap className="h-5 w-5 text-indigo-400 group-hover:animate-pulse" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Lightning Real-time Data</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-muted-foreground">Live updated prices parsed instantly from verified merchants with zero delay.</CardDescription>
            </CardContent>
          </Card>

          {/* Tall Card spanning 2 rows */}
          <Card className="md:row-span-2 group relative overflow-hidden text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 border-border/20 bg-background/40 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                <Shield className="h-5 w-5 text-purple-400 group-hover:animate-bounce" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Verified Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-muted-foreground">Compare only trusted listings. Add absolute confidence to your purchases.</CardDescription>
            </CardContent>
          </Card>

          {/* Standard Cards */}
          <Card className="group relative overflow-hidden text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 border-border/20 bg-background/40 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
                <Globe className="h-5 w-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">Smart Grouping</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-muted-foreground">Variants grouped seamlessly together.</CardDescription>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 border-border/20 bg-background/40 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                <Settings className="h-5 w-5 text-blue-400 group-hover:spin transition-transform" style={{ animationDuration: '3s' }} />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">Direct Buying</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-muted-foreground">Buy directly from your favorite merchant.</CardDescription>
            </CardContent>
          </Card>
        </div>

      <Alert className="max-w-4xl mx-auto mb-6">
        <Settings className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> We compare prices across Amazon, Flipkart, Myntra and other stores to help you
          find the best deals. Click on any product to go directly to the store.
        </AlertDescription>
      </Alert>

      <div className="max-w-2xl mx-auto mb-6">
        <EnhancedSearch onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {error && (
        <Alert className="max-w-4xl mx-auto mb-6" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Searching for the best prices across multiple stores...
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-md mx-auto text-xs">
            <Badge variant="outline" className="animate-pulse">
              🛒 Amazon
            </Badge>
            <Badge variant="outline" className="animate-pulse">
              🛍️ Flipkart
            </Badge>
            <Badge variant="outline" className="animate-pulse">
              👕 Myntra
            </Badge>
            <Badge variant="outline" className="animate-pulse">
              💄 Nykaa
            </Badge>
          </div>
          <p className="text-sm mt-3 text-muted-foreground">Finding the best deals for you...</p>
        </div>
      )}

      {results.length > 0 ? (
        <div>
          <InfiniteProductList initialProducts={results} query={query} onLoadMore={loadMoreProducts} />
          <div className="mt-8">
            <ScrapingStatus results={results} />
          </div>
        </div>
      ) : (
        !isLoading &&
        !error && (
          <div className="text-center text-muted-foreground">
            <p className="mb-6">Search for products to see price comparisons across multiple stores</p>

            <Card className="max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle>Popular Searches</CardTitle>
                <CardDescription>Try these popular product searches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" onClick={() => handleSearch("iphone 15")}>
                    iPhone 15
                  </Button>
                  <Button variant="outline" onClick={() => handleSearch("samsung galaxy")}>
                    Samsung Galaxy
                  </Button>
                  <Button variant="outline" onClick={() => handleSearch("nike shoes")}>
                    Nike Shoes
                  </Button>
                  <Button variant="outline" onClick={() => handleSearch("laptop")}>
                    Laptops
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </main>
  )
}
