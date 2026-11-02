import { NextResponse } from 'next/server';
import { resignCustomerDisplayUrls } from '@/lib/customerFileAccess';

/**
 * Re-sign durable display URLs for cart items that lost blob: previewUrl after refresh.
 * Only returns new displayUrl values for known customization paths already present in the cart payload.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const cart = Array.isArray(body?.cart) ? body.cart : [];
    if (cart.length === 0) return NextResponse.json({ cart: [] });
    return NextResponse.json({ cart: resignCustomerDisplayUrls(cart) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh display URLs' }, { status: 500 });
  }
}
