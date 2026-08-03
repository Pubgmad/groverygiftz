export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Page from '@/models/Page';
import { notFound } from 'next/navigation';

const titleMap = {
  'privacy-policy': 'Privacy Policy',
  'terms-conditions': 'Terms & Conditions',
  'shipping-policy': 'Shipping Policy',
  'refund-policy': 'Cancellation & Refund Policy',
};

export default async function PolicyPage({ params }) {
  await dbConnect();
  const page = await Page.findOne({ slug: params.slug }).lean();

  const title = page?.title || titleMap[params.slug];
  if (!title) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">{title}</h1>
      {page?.content ? (
        <div className="prose max-w-none overflow-x-auto prose-img:max-w-full prose-table:block prose-table:overflow-x-auto" dangerouslySetInnerHTML={{ __html: page.content }} />
      ) : (
        <p className="text-gray-500">This page content can be managed from the admin panel.</p>
      )}
    </div>
  );
}
