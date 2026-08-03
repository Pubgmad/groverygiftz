import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, default: '' },
  excerpt: String,
  featuredImage: String,
  author: { type: String, default: 'Admin' },
  isPublished: { type: Boolean, default: false },
  tags: [String],
}, { timestamps: true });

export default mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
