import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import { sendPasswordResetEmail } from '@/lib/email';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function envFlagEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().replace(/^['\"]|['\"]$/g, '').toLowerCase());
}

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

      if (envFlagEnabled(process.env.PASSWORD_RESET_SHOW_LINK)) {
        return NextResponse.json({ message: 'Password reset link generated.', resetLink });
      }

      try {
        await sendPasswordResetEmail({ to: normalizedEmail, resetLink });
      } catch (error) {
        console.error('Password reset email failed:', error);
        return NextResponse.json({ error: 'Unable to send reset email right now. Please try again later.' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: 'If this email is registered, a password reset link will be sent.' });
}
