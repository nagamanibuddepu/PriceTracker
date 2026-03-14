import { NextResponse } from 'next/server'
import { getPriceHistory } from '@/lib/price-history'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const history = await getPriceHistory(productId)
    return NextResponse.json({ success: true, data: history })
  } catch (error) {
    console.error('Failed to fetch price history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
