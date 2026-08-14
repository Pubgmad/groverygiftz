import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import bcrypt from 'bcryptjs';
import { validateStrongPassword, strongPasswordMessage } from '@/lib/passwordPolicy';

export async function POST(req) {
  await dbConnect();
  const { name, email, password, phone } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = String(phone || '').trim();

  if (!name || !normalizedEmail || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  }

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: strongPasswordMessage() }, { status: 400 });
  }

  const existing = await Customer.findOne({ email: normalizedEmail });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await Customer.create({ name, email: normalizedEmail, password: hashedPassword, phone: normalizedPhone });

  return NextResponse.json({ message: 'Account created' }, { status: 201 });
}
