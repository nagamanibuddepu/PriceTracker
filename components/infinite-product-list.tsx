"use client"

import { useState, useEffect } from "react"
import { ProductComparison } from "@/components/product-comparison"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

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

interface InfiniteProductListProps {
  initialProducts: ProductData[]
  query: string
  onLoadMore: (query: string, page: number) => Promise<ProductData[]>
}

export function InfiniteProductList({ initialProducts, query, onLoadMore }: InfiniteProductListProps) {
  const [products, setProducts] = useState<ProductData[]>(initialProducts)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Reset when query changes
  useEffect(() => {
    setProducts(initialProducts)
    setPage(1)
    setHasMore(true)
  }, [initialProducts, query])

  const loadMoreProducts = async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      const nextPage = page + 1
      const newProducts = await onLoadMore(query, nextPage)

      if (newProducts.length === 0) {
        setHasMore(false)
      } else {
        // Filter out any products that might be duplicates
        const uniqueNewProducts = newProducts.filter(
          (newProduct) =>
            !products.some(
              (existingProduct) => existingProduct.productName.toLowerCase() === newProduct.productName.toLowerCase(),
            ),
        )

        if (uniqueNewProducts.length > 0) {
          setProducts((prevProducts) => [...prevProducts, ...uniqueNewProducts])
          setPage(nextPage)
        } else {
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error("Error loading more products:", error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  // Implement intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreProducts()
        }
      },
      { threshold: 0.5 },
    )

    const sentinel = document.getElementById("scroll-sentinel")
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel)
      }
    }
  }, [hasMore, loading, page])

  return (
    <div className="space-y-8">
      <ProductComparison products={products} />

      <div id="scroll-sentinel" className="h-10 flex justify-center">
        {loading ? (
          <Button disabled variant="outline" className="w-40">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading more...
          </Button>
        ) : hasMore ? (
          <Button onClick={loadMoreProducts} variant="outline" className="w-40">
            Load more products
          </Button>
        ) : products.length > 0 ? (
          <p className="text-sm text-muted-foreground">No more products to load</p>
        ) : null}
      </div>
    </div>
  )
}
