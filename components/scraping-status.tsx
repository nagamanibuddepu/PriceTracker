"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Clock, Globe } from "lucide-react"
import { useEffect, useState } from "react"

interface ScrapingStatusProps {
  results: any[]
}

export function ScrapingStatus({ results }: ScrapingStatusProps) {
  const sites = [
    {
      name: "Amazon",
      status: "active",
      method: "ScrapingBee + Real-time Parser",
      features: ["Individual Products", "Real URLs", "Live Prices", "Ratings"],
    },
    {
      name: "Flipkart",
      status: "active",
      method: "ScrapingBee + Real-time Parser",
      features: ["Individual Products", "Real URLs", "Live Prices", "Reviews"],
    },
    {
      name: "Myntra",
      status: "active",
      method: "ScrapingBee + Real-time Parser",
      features: ["Individual Products", "Real URLs", "Live Prices", "Images"],
    },
    {
      name: "Nykaa",
      status: "development",
      method: "Coming Soon",
      features: ["Real Products", "Price Comparison"],
    },
    {
      name: "Meesho",
      status: "development",
      method: "Coming Soon",
      features: ["Real Products", "Price Comparison"],
    },
    {
      name: "Ajio",
      status: "development",
      method: "Coming Soon",
      features: ["Real Products", "Price Comparison"],
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "limited":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "offline":
        return <Clock className="h-4 w-4 text-gray-500" />
      case "development":
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "limited":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "offline":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "development":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const totalProducts = results.reduce((sum, group) => sum + group.retailers.length, 0)
  const activeStores = results.reduce((stores, group) => {
    group.retailers.forEach((retailer: any) => stores.add(retailer.site))
    return stores
  }, new Set()).size

  // Add ScrapingBee status check
  const [scrapingBeeStatus, setScrapingBeeStatus] = useState<{
    status: string
    credits: number
    error?: string
  }>({
    status: "checking",
    credits: 0,
  })

  // Add ZenRows status check
  const [zenRowsStatus, setZenRowsStatus] = useState<{
    status: string
    credits: number
    error?: string
  }>({
    status: "checking",
    credits: 0,
  })

  useEffect(() => {
    // Check both scraping services status
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/scraping-status")

        if (response.ok) {
          const data = await response.json()
          setScrapingBeeStatus(data.scrapingBee || { status: "error", credits: 0 })
          setZenRowsStatus(data.zenRows || { status: "error", credits: 0 })
        } else {
          console.error("Failed to fetch scraping status:", response.status)
          setScrapingBeeStatus({
            status: "error",
            credits: 0,
            error: `HTTP ${response.status}`,
          })
          setZenRowsStatus({
            status: "error",
            credits: 0,
            error: `HTTP ${response.status}`,
          })
        }
      } catch (error) {
        console.error("Failed to check scraping status:", error)
        setScrapingBeeStatus({
          status: "error",
          credits: 0,
          error: "Network error",
        })
        setZenRowsStatus({
          status: "error",
          credits: 0,
          error: "Network error",
        })
      }
    }

    checkStatus()
  }, [])

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Real-time Scraping Status
        </CardTitle>
        <CardDescription>Live product data with actual URLs, ratings, and verified links</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {sites.map((site) => (
            <div key={site.name} className="flex flex-col p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(site.status)}
                  <div className="font-medium">{site.name}</div>
                </div>
                <Badge variant="outline" className={getStatusColor(site.status)}>
                  {site.status === "active" && "Live"}
                  {site.status === "limited" && "Limited"}
                  {site.status === "offline" && "Offline"}
                  {site.status === "development" && "Development"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-2">{site.method}</div>
              <div className="flex flex-wrap gap-1">
                {site.features.map((feature) => (
                  <Badge key={feature} variant="secondary" className="text-xs">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{totalProducts}</div>
            <div className="text-sm text-blue-800">Real Products Found</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{activeStores}</div>
            <div className="text-sm text-green-800">Active Stores</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{results.length}</div>
            <div className="text-sm text-purple-800">Product Groups</div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Enhanced Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Real Product URLs:</span>{" "}
              <Badge variant="outline" className="ml-1">
                ✅ Verified Links
              </Badge>
            </div>
            <div>
              <span className="font-medium">Smart Grouping:</span>{" "}
              <Badge variant="outline" className="ml-1">
                ✅ AI-Powered
              </Badge>
            </div>
            <div>
              <span className="font-medium">Live Ratings:</span>{" "}
              <Badge variant="outline" className="ml-1">
                ✅ Real Reviews
              </Badge>
            </div>
            <div>
              <span className="font-medium">Price Accuracy:</span>{" "}
              <Badge variant="outline" className="ml-1">
                ✅ Real-time
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">ScrapingBee API Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">API Status:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {scrapingBeeStatus.status === "active" && "✅ Active"}
                {scrapingBeeStatus.status === "not_configured" && "❌ Not Configured"}
                {scrapingBeeStatus.status === "invalid_key" && "❌ Invalid API Key"}
                {scrapingBeeStatus.status === "forbidden" && "❌ Access Forbidden"}
                {scrapingBeeStatus.status === "error" && "⚠️ Error"}
                {scrapingBeeStatus.status === "checking" && "🔄 Checking..."}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Remaining Credits:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {scrapingBeeStatus.credits > 0 ? `${scrapingBeeStatus.credits.toLocaleString()}` : "N/A"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Premium Proxy:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {scrapingBeeStatus.status === "active" ? "✅ Enabled" : "❌ Disabled"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">JS Rendering:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {scrapingBeeStatus.status === "active" ? "✅ Enabled" : "❌ Disabled"}
              </Badge>
            </div>
          </div>
          {scrapingBeeStatus.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <span className="font-medium">Error:</span> {scrapingBeeStatus.error}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">ZenRows API Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">API Status:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {zenRowsStatus.status === "active" && "✅ Active"}
                {zenRowsStatus.status === "not_configured" && "❌ Not Configured"}
                {zenRowsStatus.status === "error" && "⚠️ Error"}
                {zenRowsStatus.status === "checking" && "🔄 Checking..."}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Backup Service:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {zenRowsStatus.status === "active" ? "✅ Ready" : "❌ Unavailable"}
              </Badge>
            </div>
          </div>
          {zenRowsStatus.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              <span className="font-medium">ZenRows Error:</span> {zenRowsStatus.error}
            </div>
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">
              Dual Scraping Strategy: ScrapingBee + ZenRows fallback for maximum reliability
            </span>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">
                Successfully scraped {totalProducts} real products from {activeStores} stores with verified links and
                ratings
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
