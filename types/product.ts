export interface ScrapedProduct {
  name: string
  price: number
  site: string
  imageUrl: string
  url: string
}

export interface Retailer {
  site: string
  price: number
  url: string
  imageUrl: string
}

export interface ProductData {
  productName: string
  retailers: Retailer[]
  lowestPrice: number
  lowestPriceSite: string
}
