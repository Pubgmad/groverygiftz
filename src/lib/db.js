import mongoose from 'mongoose';

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/groverygiftz';
const MONGODB_URI = process.env.MONGODB_URI || LOCAL_MONGODB_URI;

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
