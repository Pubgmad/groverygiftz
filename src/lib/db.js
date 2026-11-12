import mongoose from 'mongoose';
import dns from 'dns';

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/groverygiftz';

/** Resolve at connect-time so shell overrides (isolated staging) always win. */
function getMongoUri() {
  return process.env.MONGODB_URI || LOCAL_MONGODB_URI;
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, uri: null };
}

/**
 * On some Windows networks Node's default DNS returns querySrv ECONNREFUSED
 * for mongodb+srv hosts, while public resolvers and Atlas TCP still work.
 * Prefer public DNS for SRV lookups without changing the connection string.
 */
function ensureSrvDnsResolvers(uri) {
  if (!String(uri).startsWith('mongodb+srv://')) return;
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
  const MONGODB_URI = getMongoUri();
  if (cached.conn && cached.uri === MONGODB_URI) return cached.conn;
  if (cached.conn && cached.uri !== MONGODB_URI) {
    // URI changed (e.g. switched to isolated staging) — drop stale connection.
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    cached.conn = null;
    cached.promise = null;
  }
  if (!cached.promise) {
    ensureSrvDnsResolvers(MONGODB_URI);
    cached.uri = MONGODB_URI;
    cached.promise = mongoose.connect(MONGODB_URI)
      .catch((error) => {
        const message = String(error?.message || error || '');
        const isSrvDnsFailure = message.includes('querySrv')
          || (error?.code === 'ECONNREFUSED' && message.includes('_mongodb._tcp'));
        if (!isSrvDnsFailure) throw error;
        ensureSrvDnsResolvers(MONGODB_URI);
        return mongoose.connect(MONGODB_URI);
      })
      .then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
