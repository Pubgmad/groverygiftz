export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import Settings from '@/models/Settings';
import { buildMetaCustomerData } from '@/lib/metaCustomerData';
import { META_CONSENT_COOKIE, isMetaPermissionAllowed, readMetaCookies } from '@/lib/metaAttribution';

const reply = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
});

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.type !== 'customer' || !session.user.id) return reply({ userData: {} }, 401);
    const cookies = readMetaCookies(req.headers.get('cookie') || '');
    if (!isMetaPermissionAllowed(cookies[META_CONSENT_COOKIE] || null) || req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') {
      return reply({ userData: {} });
    }

    await dbConnect();
    const settings = await Settings.findOne().select('metaPixelEnabled metaPixelId').lean();
    if (!settings?.metaPixelEnabled || !settings.metaPixelId) return reply({ userData: {} });
    const customer = await Customer.findById(session.user.id).select('_id name email phone').lean();
    if (!customer) return reply({ userData: {} }, 404);

    // Use the authenticated account, never a gift recipient or arbitrary request identity.
    const data = buildMetaCustomerData({
      customer: customer._id,
      shippingAddress: { fullName: customer.name, email: customer.email, phone: customer.phone },
    });
    const userData = Object.fromEntries(['em', 'ph', 'fn', 'ln', 'external_id'].filter((key) => data[key]).map((key) => [key, data[key]]));
    return reply({ customerId: String(customer._id), userData });
  } catch {
    return reply({ error: 'Matching data unavailable' }, 503);
  }
}
