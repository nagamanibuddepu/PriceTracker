"use client"

import type React from "react"

import { useState } from "react"
import { Search, Zap, TrendingUp, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface EnhancedSearchProps {
  onSearch: (query: string) => void
  isLoading: boolean
}

export function EnhancedSearch({ onSearch, isLoading }: EnhancedSearchProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query)
    }
  }

  const popularSearches = [
    { term: "iPhone 15", category: "Electronics", trend: "🔥" },
    { term: "MacBook Air", category: "Laptops", trend: "📈" },
    { term: "Nike Air Max", category: "Shoes", trend: "⭐" },
    { term: "Samsung Galaxy", category: "Electronics", trend: "🔥" },
    { term: "Sony Headphones", category: "Audio", trend: "📈" },
    { term: "Adidas Shoes", category: "Sports", trend: "⭐" },
  ]

  const recentSearches = ["laptop under 50000", "wireless earbuds", "running shoes", "smartphone"]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Search */}
      <Card className="border-border/60 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
            <Zap className="h-6 w-6 text-blue-600 fill-blue-100" />
            Discover Products
          </CardTitle>
          <CardDescription className="text-base">
            Search 10+ millions of products across all top e-commerce platforms in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
              <Input
                type="text"
                placeholder="E.g., iPhone 15 Pro Max, Nike Air Force 1..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 pr-4 h-14 text-lg rounded-full border-2 border-border/50 bg-background/50 backdrop-blur-sm focus-visible:ring-4 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 transition-all shadow-inner"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !query.trim()} 
              size="lg"
              className="h-14 px-8 rounded-full text-lg font-medium shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Searching
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Search Deals
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Popular Searches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 hover:border-border transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Trending Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {popularSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(search.term)
                    onSearch(search.term)
                  }}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 bg-background/60 hover:bg-indigo-500/10 hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/10 transition-all"
                  disabled={isLoading}
                >
                  <span className="text-sm group-hover:scale-110 transition-transform">{search.trend}</span>
                  <span className="font-medium text-sm text-foreground/90">{search.term}</span>
                  <div className="flex items-center gap-0.5 ml-1 opacity-70">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-border transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-blue-500" />
              Recent Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(search)
                    onSearch(search)
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 hover:shadow-sm transition-all text-left border border-transparent hover:border-border/50"
                  disabled={isLoading}
                >
                  <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-foreground/90">{search}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Tips */}
      <Card className="bg-muted/30 border-border/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                💡 Tip
              </Badge>
              <span className="text-muted-foreground">Use specific product names for better results</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                🎯 Pro
              </Badge>
              <span className="text-muted-foreground">Include brand names (e.g., "Apple iPhone")</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                ⚡ Fast
              </Badge>
              <span className="text-muted-foreground">Real-time pricing from 6+ stores</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
