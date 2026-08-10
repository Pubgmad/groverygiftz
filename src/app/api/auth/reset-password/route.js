import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function POST(req) {
  await dbConnect();
  const { token, password } = await req.json();
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: 'Valid token and password with at least 6 characters are required' }, { status: 400 });
  }

  const customer = await Customer.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!customer) {
    return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
  }

  customer.password = await bcrypt.hash(password, 12);
  customer.resetPasswordToken = '';
  customer.resetPasswordExpires = undefined;
  await customer.save();

  return NextResponse.json({ message: 'Password updated successfully' });
}
