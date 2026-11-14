import mongoose from 'mongoose';
import dns from 'dns';

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/groverygiftz';
const MONGODB_URI = process.env.MONGODB_URI || LOCAL_MONGODB_URI;

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * On some Windows networks Node's default DNS returns querySrv ECONNREFUSED
 * for mongodb+srv hosts, while public resolvers and Atlas TCP still work.
 * Prefer public DNS for SRV lookups without changing the connection string.
 */
function ensureSrvDnsResolvers() {
  if (!String(MONGODB_URI).startsWith('mongodb+srv://')) return;
  try {
    const preferred = ['8.8.8.8', '1.1.1.1'];
    const current = dns.getServers();
    const next = [...preferred, ...current.filter((server) => !preferred.includes(server))];
    dns.setServers(next);
  } catch {
    // Ignore resolver configuration failures; mongoose will surface connect errors.
  }
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    ensureSrvDnsResolvers();
    cached.promise = mongoose.connect(MONGODB_URI)
      .catch((error) => {
        const message = String(error?.message || error || '');
        const isSrvDnsFailure = message.includes('querySrv')
          || (error?.code === 'ECONNREFUSED' && message.includes('_mongodb._tcp'));
        if (!isSrvDnsFailure) throw error;
        ensureSrvDnsResolvers();
        return mongoose.connect(MONGODB_URI);
      })
      .then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
    if (cached.conn && process.env.NEXT_RUNTIME !== 'edge' && process.env.NEXT_PHASE !== 'phase-production-build') {
      import('@/lib/orderConfirmationOutbox').then((mod) => mod.ensureNotificationWorker?.()).catch(() => {});
    }
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
