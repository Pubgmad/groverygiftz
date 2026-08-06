import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Collection from '@/models/Collection';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import slugify from 'slugify';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('all') === 'true' && session?.user?.type === 'admin';

  await dbConnect();
  const filter = includeAll ? {} : { isActive: true };
  const collections = await Collection.find(filter).sort({ order: 1 }).lean();
  return NextResponse.json({ collections });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.type !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  body.slug = slugify(body.name, { lower: true, strict: true });
  const collection = await Collection.create(body);
  revalidatePath('/', 'layout');
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/collections/' + collection.slug);
  return NextResponse.json(collection, { status: 201 });
}
