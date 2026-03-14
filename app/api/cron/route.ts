import { NextResponse } from 'next/server';
import { getDatabase, isMongoAvailable } from '@/lib/mongodb';
import { compareProducts } from '@/app/actions';

export async function GET(req: Request) {
  // Simple auth for cron (in production, use authorization header with CRON_SECRET)
  // Vercel automatically sends `Authorization: Bearer CRON_SECRET`
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const db = await getDatabase();
    if (!db || !isMongoAvailable()) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const priceAlerts = db.collection('priceAlerts');
    const wishlistItems = db.collection('wishlistItems');

    // Get all active alerts
    const activeAlerts = await priceAlerts.find({ isActive: true }).toArray();

    if (activeAlerts.length === 0) {
      return NextResponse.json({ message: 'No active alerts to process' });
    }

    const results = [];

    for (const alert of activeAlerts) {
      const item = await wishlistItems.findOne({ id: alert.wishlistItemId });
      if (!item) continue;

      try {
        console.log(`[Cron] Checking price for ${item.productName}...`);
        // We use compareProducts to scrape the latest pricing for the item.
        const scrapedData = await compareProducts(item.productName, 1);
        
        if (scrapedData.length === 0) continue;

        // We look for the absolute lowest price across all returning scraped items
        const globalLowestPrice = Math.min(
          ...scrapedData.flatMap((product) => product.retailers.map((r) => r.price))
        );

        let priceDropped = false;
        let notificationTriggered = false;

        // Determine if price dropped compared to what we have recorded
        if (globalLowestPrice > 0 && globalLowestPrice < item.lowestSeenPrice) {
          priceDropped = true;
          
          if (alert.alertType === 'threshold' && alert.targetPrice) {
            if (globalLowestPrice <= alert.targetPrice) {
              notificationTriggered = true;
            }
          } else if (alert.alertType === 'any_drop') {
            notificationTriggered = true;
          }
        }

        if (priceDropped) {
          // Update lowest seen price for this wishlist item
          await wishlistItems.updateOne(
            { id: item.id },
            { $set: { lowestSeenPrice: globalLowestPrice, updatedAt: new Date().toISOString() } }
          );
        }

        if (notificationTriggered) {
          // TODO: Implement actual email/push notification logic here
          console.log(`[Cron] Triggered notification for ${item.productName}. New lowest price: ${globalLowestPrice}`);

          // Update the alert to inactive to prevent spamming the user repeatedly for the same drop
          await priceAlerts.updateOne(
            { id: alert.id },
            { $set: { isActive: false } }
          );
          
          results.push({
            productName: item.productName,
            oldPrice: item.currentPrice,
            newPrice: globalLowestPrice,
            alertId: alert.id,
            status: 'notified and disabled'
          });
        }
      } catch (err) {
        console.error(`[Cron] Error processing alert for item ${item.productName}:`, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: activeAlerts.length, 
      triggered: results.length, 
      details: results 
    });
  } catch (error) {
    console.error('[Cron] Main error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
