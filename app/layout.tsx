import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getCurrentUser } from "@/lib/auth"
import { UserNav } from "@/components/user-nav"
import { AIChatbot } from "@/components/ai-chatbot"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { isDemoModeEnabled } from "@/lib/rate-limit"
import { DemoBanner } from "@/components/demo-banner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Price Comparison - Find Best Deals",
  description: "Compare prices across multiple stores and get price drop alerts",
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const isDemo = await isDemoModeEnabled()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40 shadow-sm supports-[backdrop-filter]:bg-background/60">
            {isDemo && <DemoBanner />}
            <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20">P</span>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">PriceTracker</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <UserNav user={user} />
              </div>
            </div>
          </header>
          {children}
          <AIChatbot />
        </ThemeProvider>
      </body>
    </html>
  )
}
