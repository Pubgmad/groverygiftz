import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from './db';
import Admin from '@/models/Admin';
import Customer from '@/models/Customer';

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
          const admin = await Admin.findOne({ email });
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
  ],
  callbacks: {
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

