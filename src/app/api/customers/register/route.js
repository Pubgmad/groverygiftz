import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  await dbConnect();
  const { name, email, password, phone } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  }

  const existing = await Customer.findOne({ email });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await Customer.create({ name, email, password: hashedPassword, phone });

  return NextResponse.json({ message: 'Account created' }, { status: 201 });
}
