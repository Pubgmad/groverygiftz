import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Order from '@/models/Order';
import Customer from '@/models/Customer';
import Collection from '@/models/Collection';
import Banner from '@/models/Banner';
import Blog from '@/models/Blog';
import Contact from '@/models/Contact';
import Newsletter from '@/models/Newsletter';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const [products, orders, customers, collections, banners, blogs, messages, subscribers, revenue, recentOrders] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    Customer.countDocuments(),
    Collection.countDocuments(),
    Banner.countDocuments(),
    Blog.countDocuments(),
    Contact.countDocuments({ isRead: false }),
    Newsletter.countDocuments(),
    Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return NextResponse.json({
    products, orders, customers, collections, banners, blogs,
    unreadMessages: messages, subscribers,
    revenue: revenue[0]?.total || 0,
    recentOrders,
  });
}
