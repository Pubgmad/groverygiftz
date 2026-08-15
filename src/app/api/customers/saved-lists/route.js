export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import { authOptions } from '@/lib/auth';

const MAX_CART_ITEMS = 100;
const MAX_WISHLIST_ITEMS = 300;

const stripDisplayOnlyPreviewData = (value) => {
  if (Array.isArray(value)) return value.map(stripDisplayOnlyPreviewData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'previewUrl' && key !== 'displayUrl')
      .map(([key, entry]) => [key, stripDisplayOnlyPreviewData(entry)])
  );
};

const normalizeList = (value, maxItems) => Array.isArray(value)
  ? stripDisplayOnlyPreviewData(value).slice(0, maxItems)
  : [];

async function getCustomerSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.type !== 'customer' || !session.user?.id) return null;
  return session;
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const customer = await Customer.findById(session.user.id).select('cart wishlist').lean();
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  return NextResponse.json({ cart: customer.cart || [], wishlist: customer.wishlist || [] });
}

export async function PUT(req) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update = {};
  if ('cart' in body) update.cart = normalizeList(body.cart, MAX_CART_ITEMS);
  if ('wishlist' in body) update.wishlist = normalizeList(body.wishlist, MAX_WISHLIST_ITEMS);

  await dbConnect();
  const customer = await Customer.findByIdAndUpdate(session.user.id, { $set: update }, { new: true }).select('cart wishlist').lean();
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  return NextResponse.json({ cart: customer.cart || [], wishlist: customer.wishlist || [] });
}
