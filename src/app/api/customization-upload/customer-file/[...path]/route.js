import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import Order from '@/models/Order';
import { readUploadFile } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const imageTypes = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
]);

const contentTypeFor = (relativePath) => {
  const ext = String(relativePath || '').split('.').pop()?.toLowerCase();
  return imageTypes.get(ext) || 'application/octet-stream';
};

const containsPath = (value, relativePath) => {
  if (!value) return false;
  if (typeof value === 'string') return value.includes(relativePath);
  if (Array.isArray(value)) return value.some((entry) => containsPath(entry, relativePath));
  if (typeof value === 'object') return Object.values(value).some((entry) => containsPath(entry, relativePath));
  return false;
};

async function canAccessCustomerFile(session, relativePath) {
  if (session?.user?.type === 'admin') return true;
  if (session?.user?.type !== 'customer' || !session.user.id) return false;

  await dbConnect();
  const customer = await Customer.findById(session.user.id).select('cart').lean();
  if (containsPath(customer?.cart, relativePath)) return true;

  const email = String(session.user.email || '').trim().toLowerCase();
  const orderFilter = {
    paymentStatus: 'paid',
    $or: [
      { customer: session.user.id },
      ...(email ? [{ guestEmail: email }, { 'shippingAddress.email': email }] : []),
    ],
  };
  const orders = await Order.find(orderFilter).select('items').lean();
  return orders.some((order) => containsPath(order.items, relativePath));
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  try {
    const { path: pathParts = [] } = await params;
    const relativePath = pathParts.join('/');
    if (!relativePath.startsWith('customizations/')) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    if (!(await canAccessCustomerFile(session, relativePath))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': contentTypeFor(relativePath),
        'Content-Length': String(file.stat.size),
        'Cache-Control': 'private, max-age=300, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
