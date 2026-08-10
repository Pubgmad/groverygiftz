import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function POST(req) {
  await dbConnect();
  const { email } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail) {
    const customer = await Customer.findOne({ email: normalizedEmail });
    if (customer) {
      const token = crypto.randomBytes(32).toString('hex');
      customer.resetPasswordToken = hashToken(token);
      customer.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await customer.save();

      const baseUrl = process.env.NEXTAUTH_URL || new URL(req.url).origin;
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;
      console.log(`Password reset link for ${normalizedEmail}: ${resetLink}`);

      if (process.env.PASSWORD_RESET_SHOW_LINK === 'true') {
        return NextResponse.json({ message: 'Password reset link generated.', resetLink });
      }
    }
  }

  return NextResponse.json({ message: 'If this email is registered, a password reset link will be sent.' });
}
