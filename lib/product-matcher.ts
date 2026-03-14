import type { ProductData, ScrapedProduct } from "@/types/product"

// Function to calculate similarity between two product names
function calculateSimilarity(name1: string, name2: string): number {
  // Convert to lowercase for case-insensitive comparison
  const s1 = name1.toLowerCase()
  const s2 = name2.toLowerCase()

  // Extract key terms (words with 3+ characters)
  const terms1 = s1.split(/\s+/).filter((term) => term.length >= 3)
  const terms2 = s2.split(/\s+/).filter((term) => term.length >= 3)

  // Count matching terms
  let matches = 0
  for (const term of terms1) {
    if (terms2.some((t) => t.includes(term) || term.includes(t))) {
      matches++
    }
  }

  // Calculate similarity score (0 to 1)
  const maxTerms = Math.max(terms1.length, terms2.length)
  return maxTerms > 0 ? matches / maxTerms : 0
}

// Function to extract product identifiers
function extractProductIdentifiers(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(term => 
      term.length >= 3 && 
      !['for', 'and', 'the', 'with', 'in', 'on', 'at', 'of', 'to', 'a', 'an'].includes(term)
    )
}

// Function to group similar products together
export function groupSimilarProducts(products: ScrapedProduct[]): ProductData[] {
  const groups: ProductData[] = []
  const similarityThreshold = 0.5 // Minimum similarity score to consider products as similar

  // Sort products by price to use the cheapest one as the reference
  const sortedProducts = [...products].sort((a, b) => a.price - b.price)

  // Process each product
  for (const product of sortedProducts) {
    // Extract product identifiers
    const productIdentifiers = extractProductIdentifiers(product.name)
    
    // Check if this product is similar to any existing group
    let foundMatch = false

    for (const group of groups) {
      // Compare with the first product in the group (reference product)
      const similarity = calculateSimilarity(group.productName, product.name)

      if (similarity >= similarityThreshold) {
        // Add to existing group
        group.retailers.push({
          site: product.site,
          price: product.price,
          url: product.url,
          imageUrl: product.imageUrl,
          rating: product.rating,
          reviews: product.reviews,
          availability: product.availability
        })

        // Update lowest price if needed
        if (product.price < group.lowestPrice) {
          group.lowestPrice = product.price
          group.lowestPriceSite = product.site
        }

        foundMatch = true
        break
      }
    }

    // If no match found, create a new group
    if (!foundMatch) {
      groups.push({
        productName: product.name,
        retailers: [
          {
            site: product.site,
            price: product.price,
            url: product.url,
            imageUrl: product.imageUrl,
            rating: product.rating,
            reviews: product.reviews,
            availability: product.availability
          },
        ],
        lowestPrice: product.price,
        lowestPriceSite: product.site,
        category: product.category,
        avgRating: product.rating
      })
    }
  }

  // Sort groups by lowest price
  return groups.sort((a, b) => a.lowestPrice - b.lowestPrice)
}
