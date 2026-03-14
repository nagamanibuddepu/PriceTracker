import { NextResponse } from "next/server"

async function checkZenRowsStatus() {
  try {
    const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY || "690480320428edb4c93d0e31a540a21dde0036bc"

    if (!ZENROWS_API_KEY) {
      return { status: "not_configured", credits: 0 }
    }

    // Test with a simple request
    const response = await fetch("https://api.zenrows.com/v1/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://httpbin.org/ip",
        apikey: ZENROWS_API_KEY,
      }),
    })

    if (response.ok) {
      return {
        status: "active",
        credits: 1000, // ZenRows doesn't provide usage info easily
        provider: "zenrows",
      }
    } else {
      return { status: "error", credits: 0, error: `HTTP ${response.status}` }
    }
  } catch (error) {
    console.error("ZenRows status check failed:", error)
    return {
      status: "error",
      credits: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function GET() {
  try {
    const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY
    const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY

    // Check ScrapingBee status
    let scrapingBeeStatus = { status: "not_configured", credits: 0 }

    if (SCRAPINGBEE_API_KEY) {
      const response = await fetch(`https://app.scrapingbee.com/api/v1/usage?api_key=${SCRAPINGBEE_API_KEY}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          try {
            const data = await response.json()
            scrapingBeeStatus = {
              status: "active",
              credits: data.max_api_credit - data.used_api_credit,
              totalCredits: data.max_api_credit,
              usedCredits: data.used_api_credit,
              provider: "scrapingbee",
            }
          } catch (jsonError) {
            scrapingBeeStatus = { status: "error", credits: 0, error: "Invalid JSON response" }
          }
        }
      } else {
        scrapingBeeStatus = { status: "error", credits: 0, error: `HTTP ${response.status}` }
      }
    }

    // Check ZenRows status
    const zenRowsStatus = await checkZenRowsStatus()

    return NextResponse.json({
      scrapingBee: scrapingBeeStatus,
      zenRows: zenRowsStatus,
      fallbackEnabled: true,
      activeProviders: [
        scrapingBeeStatus.status === "active" ? "ScrapingBee" : null,
        zenRowsStatus.status === "active" ? "ZenRows" : null,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error("Status check failed:", error)
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
