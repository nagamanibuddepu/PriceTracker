"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Send, Sparkles, User, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
  id: string
  type: "user" | "bot"
  content: string
  timestamp: Date
  products?: Array<{
    name: string
    price: number
    site: string
    url: string
    imageUrl: string
  }>
}

interface ChatbotProps {
  onProductRecommendation?: (products: any[]) => void
}

export function AIChatbot({ onProductRecommendation }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "bot",
      content:
        "Hi! I'm your personal shopping assistant. I can help you with:\n\n• Outfit suggestions based on your body type\n• Product recommendations for your skin type\n• Style advice and fashion tips\n• Finding the best deals across platforms\n\nWhat would you like help with today?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateResponse = async (userMessage: string): Promise<{ content: string; products?: any[] }> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate response');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Chatbot API error:', error);
      return { 
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}.` 
      };
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await generateResponse(inputValue)

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: response.content,
        timestamp: new Date(),
        products: response.products,
      }

      setMessages((prev) => [...prev, botMessage])

      if (response.products && onProductRecommendation) {
        onProductRecommendation(response.products)
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: "I'm sorry, I encountered an error. Please try again!",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price)
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] group">
        <div className="absolute inset-0 bg-purple-500 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300 animate-pulse" />
        <Button
          onClick={() => setIsOpen(true)}
          className="relative h-14 w-14 rounded-full shadow-2xl bg-gradient-to-tr from-violet-600 to-pink-500 hover:from-violet-500 hover:to-pink-400 border border-white/20 transition-transform duration-300 hover:scale-105"
          size="icon"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[340px] h-[550px] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
      <Card className="flex-1 flex flex-col shadow-2xl border-border/50 rounded-2xl overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardHeader className="bg-gradient-to-r from-violet-600 to-pink-500 text-white p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4" />
              Style & Deal Assistant
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 hover:text-white h-7 w-7 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 bg-muted/10">
          <ScrollArea className="flex-1 p-4 max-h-[400px]">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                      message.type === "user" 
                        ? "bg-gradient-to-br from-violet-600 to-purple-500 text-white rounded-tr-none" 
                        : "bg-muted/50 border border-border/50 text-foreground rounded-tl-none"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.type === "bot" && <Bot className="h-4 w-4 mt-0.5 text-violet-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                        {message.products && (
                          <div className="mt-2 space-y-1">
                            {message.products.map((product, idx) => (
                              <div key={idx} className="border rounded p-1 bg-background">
                                <div className="flex items-center gap-1">
                                  <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0"></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-[10px] truncate">{product.name}</div>
                                    <div className="text-green-600 font-bold text-[10px]">
                                      {formatPrice(product.price)}
                                    </div>
                                    <Badge variant="outline" className="text-[8px] px-1 py-0">
                                      {product.site}
                                    </Badge>
                                  </div>
                                </div>
                                <Button size="sm" className="w-full mt-1 text-[10px] h-6" asChild>
                                  <a href={product.url} target="_blank" rel="noopener noreferrer">
                                    View Product
                                  </a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {message.type === "user" && <User className="h-3 w-3 mt-1 flex-shrink-0" />}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-tl-none p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-violet-500" />
                      <div className="flex space-x-1.5 ml-1">
                        <div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          <div className="p-3 bg-background border-t border-border/40">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about styling or deals..."
                disabled={isLoading}
                className="flex-1 bg-muted/50 border-transparent focus-visible:ring-violet-500 rounded-full px-4"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                size="icon"
                className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
