import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import Order from '@/models/Order';
import { verifyCustomerDisplayAccess } from '@/lib/customerFileAccess';
import { detectImageFormat } from '@/lib/imageFormat';
import { readUploadFile } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const containsPath = (value, relativePath) => {
  if (!value) return false;
  if (typeof value === 'string') return value.includes(relativePath);
  if (Array.isArray(value)) return value.some((entry) => containsPath(entry, relativePath));
  if (typeof value === 'object') return Object.values(value).some((entry) => containsPath(entry, relativePath));
  return false;
};

async function canAccessCustomerFile(session, relativePath) {
  if (session?.user?.type === 'admin') {
    const { can, getRequestAdminAccess } = await import('@/lib/adminAccess');
    const access = await getRequestAdminAccess(session);
    return can(access, 'orders', 'read') || can(access, 'products', 'read');
  }
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
    // Next may leave segments encoded or decoded depending on version — normalize either way.
    const relativePath = pathParts
      .map((part) => {
        try { return decodeURIComponent(part); } catch { return part; }
      })
      .join('/');
    if (!relativePath.startsWith('customizations/')) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });

    const signed = verifyCustomerDisplayAccess(relativePath, req.nextUrl.searchParams);
    if (!signed && !(await canAccessCustomerFile(session, relativePath))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const file = await readUploadFile(relativePath);
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const format = detectImageFormat(file.buffer);

    // Derive Content-Type from extension when magic-byte detection fails (e.g. corrupt header).
    // iOS Safari refuses to render images served as application/octet-stream.
    let contentType = format?.mime || '';
    if (!contentType || contentType === 'application/octet-stream') {
      const ext = relativePath.split('.').pop()?.toLowerCase() || '';
      const extMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };
      contentType = extMap[ext] || 'application/octet-stream';
    }

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.stat.size),
        'Cache-Control': signed ? 'private, max-age=3600, no-transform' : 'private, max-age=300, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Accept',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}