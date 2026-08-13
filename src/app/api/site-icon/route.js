import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Settings from '@/models/Settings';

export const dynamic = 'force-dynamic';

async function getSiteIcon() {
  await dbConnect();
  const settings = await Settings.findOne().select('favicon logo desktopLogo tabletLogo mobileLogo').lean();
  return settings?.favicon || settings?.mobileLogo || settings?.tabletLogo || settings?.desktopLogo || settings?.logo || '';
}

export async function GET() {
  try {
    const logo = await getSiteIcon();
    if (!logo) return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(new URL(logo, process.env.NEXTAUTH_URL || 'https://groverygiftz.in'), 307);
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}
