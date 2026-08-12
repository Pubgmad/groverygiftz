import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import dbConnect from './db';
import Admin from '@/models/Admin';
import Customer from '@/models/Customer';
import { cookies } from 'next/headers';

function clearGoogleAuthIntent() {
  try {
    cookies().set('google_auth_intent', '', { path: '/', maxAge: 0, sameSite: 'lax' });
  } catch (error) {
    // Cookie cleanup is best-effort; auth rules still depend on the current callback intent.
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginType: { label: 'Login Type', type: 'text' },
      },
      async authorize(credentials) {
        await dbConnect();

        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password || '';
        if (!email || !password) return null;

        const loginType = credentials?.loginType || 'customer';

        if (loginType === 'admin') {
          const admin = await Admin.findOne({ email }).collation({ locale: 'en', strength: 2 });
          if (!admin) return null;
          const adminValid = await bcrypt.compare(password, admin.password);
          if (!adminValid) return null;
          return { id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role, type: 'admin' };
        }

        const customer = await Customer.findOne({ email });
        if (!customer) return null;
        const customerValid = await bcrypt.compare(password, customer.password);
        if (!customerValid) return null;
        return { id: customer._id.toString(), email: customer.email, name: customer.name, type: 'customer' };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;
      await dbConnect();
      const email = user.email?.trim().toLowerCase();
      if (!email) {
        clearGoogleAuthIntent();
        return '/auth/login?googleError=missing-email';
      }

      const intent = cookies().get('google_auth_intent')?.value || 'signin';
      let customer = await Customer.findOne({ email });

      if (!customer && intent !== 'signup') {
        clearGoogleAuthIntent();
        return '/auth/register?googleAccountMissing=1';
      }

      if (!customer) {
        customer = await Customer.create({
          name: user.name || email.split('@')[0],
          email,
          googleId: account.providerAccountId,
          image: user.image || '',
        });
      } else {
        customer.googleId = customer.googleId || account.providerAccountId;
        customer.image = user.image || customer.image || '';
        await customer.save();
      }

      user.id = customer._id.toString();
      user.type = 'customer';
      clearGoogleAuthIntent();
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.type = user.type;
        token.role = user.role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.type = token.type;
      session.user.role = token.role;
      session.user.id = token.userId;
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
