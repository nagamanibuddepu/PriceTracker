"use client"

import { useState, useEffect } from "react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts"
import { format } from "date-fns"
import { Loader2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface PriceHistoryChartProps {
  productId: string
}

export function PriceHistoryChart({ productId }: PriceHistoryChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableSites, setAvailableSites] = useState<string[]>([])

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true)
        // Ensure we pass the clean version of the product name as the ID
        const cleanProductId = productId
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        // Extract key parts similar to what the backend does
        const keyParts = cleanProductId.split(' ').filter(part => part.length > 2 && !['for', 'and', 'the', 'with', 'in', 'on', 'at'].includes(part))
        const finalKey = keyParts.join(' ') || cleanProductId

        const res = await fetch(`/api/history?productId=${encodeURIComponent(finalKey)}`)
        
        if (!res.ok) {
          throw new Error('Failed to fetch history')
        }

        const json = await res.json()
        if (json.success && json.data) {
          processData(json.data)
        } else {
          setData([])
        }
      } catch (err) {
        console.error("Error loading price history:", err)
        setError("Could not load price trends.")
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      fetchHistory()
    }
  }, [productId])

  const processData = (rawData: any[]) => {
    if (!rawData || rawData.length === 0) {
      setData([])
      return
    }

    // Group by date (day precision)
    const groupedByDate: Record<string, Record<string, number>> = {}
    const sites = new Set<string>()

    rawData.forEach(point => {
      // Create a localized date string (e.g. 'Oct 12')
      const dateStr = format(new Date(point.timestamp), 'MMM dd')
      const site = point.site.charAt(0).toUpperCase() + point.site.slice(1) // capitalize site name

      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = {}
      }

      // If multiple points exist for the same day, take the lowest price
      if (
        !groupedByDate[dateStr][site] || 
        point.price < groupedByDate[dateStr][site]
      ) {
        groupedByDate[dateStr][site] = point.price
      }

      sites.add(site)
    })

    // Convert to array format required by Recharts
    const chartData = Object.keys(groupedByDate).map(date => {
      return {
        date,
        ...groupedByDate[date]
      }
    })

    setAvailableSites(Array.from(sites))
    setData(chartData)
  }

  // Define colors for common sites
  const getSiteColor = (site: string) => {
    switch (site.toLowerCase()) {
      case 'amazon': return '#ff9900'
      case 'flipkart': return '#2874f0'
      case 'myntra': return '#ff3f6c'
      case 'nykaa': return '#fc2779'
      case 'ajio': return '#2c4152'
      default: return '#8884d8'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground w-full bg-muted/20 rounded-xl border border-border/50">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading price history...</span>
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground w-full bg-muted/20 rounded-xl border border-border/50">
        <TrendingUp className="h-8 w-8 mb-2 opacity-50" />
        <span className="mb-1">{error || "No price history available yet."}</span>
        <span className="text-sm opacity-70">Check back later as prices change!</span>
      </div>
    )
  }

  return (
    <Card className="w-full border-border/50 shadow-sm mt-4 bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" />
          Price Trend (Last 30 Days)
        </CardTitle>
        <CardDescription>Track price drops and increases over time across stores.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[250px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
              <XAxis 
                dataKey="date" 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={(val) => `₹${val}`} 
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'currentColor' }}
                className="text-muted-foreground"
                domain={['auto', 'auto']}
              />
              <Tooltip 
                formatter={(value: number) => [`₹${value}`, "Price"]}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
              {availableSites.map((site) => (
                <Line
                  key={site}
                  type="monotone"
                  dataKey={site}
                  name={site}
                  stroke={getSiteColor(site)}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
