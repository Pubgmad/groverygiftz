export { dynamic } from '@/app/media/uploads/[...path]/route';
import { GET as mediaUploadsGet } from '@/app/media/uploads/[...path]/route';

export async function GET(req, { params }) {
  return mediaUploadsGet(req, { params });
}
