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

const defaultPolicyContent = {
  'privacy-policy': `<p>At GroveryGiftz, we value your privacy and are committed to protecting your personal information.</p><h2>Information We Collect</h2><p>We may collect:</p><ul><li>Name</li><li>Mobile Number</li><li>Email Address</li><li>Shipping Address</li><li>Uploaded Photos</li><li>Payment Information, processed securely through payment gateways</li></ul><h2>How We Use Your Information</h2><p>We use your information to:</p><ul><li>Process and deliver your orders</li><li>Create personalized products</li><li>Provide customer support</li><li>Send order updates</li><li>Improve our services</li></ul><h2>Photo Privacy</h2><p>Your uploaded photos are used only for creating your personalized products. We never sell or share your photos with third parties without your permission.</p><h2>Payment Security</h2><p>Payments are processed through secure payment gateways. We do not store your debit or credit card details.</p><h2>Cookies</h2><p>Our website may use cookies to improve your browsing experience.</p><h2>Data Protection</h2><p>We take reasonable security measures to protect your personal information.</p><h2>Contact</h2><p>For any privacy-related concerns:</p><p><strong>Email:</strong> <a href="mailto:Groverygiftz@gmail.com">Groverygiftz@gmail.com</a><br /><strong>WhatsApp:</strong> <a href="https://wa.me/919994549781">+919994549781</a></p>`,
  'terms-conditions': `<p>Welcome to GroveryGiftz.</p><p>By placing an order on our website, you agree to the following terms:</p><h2>Personalized Products</h2><p>All products are customized according to the images and details provided by the customer.</p><h2>Customer Responsibility</h2><p>Customers are responsible for:</p><ul><li>Uploading high-quality images</li><li>Providing correct shipping address</li><li>Providing correct contact information</li></ul><p>We are not responsible for printing issues caused by low-quality images submitted by customers.</p><h2>Design</h2><p>Minor adjustments such as cropping, brightness, and alignment may be done to achieve the best final result.</p><h2>Order Confirmation</h2><p>Orders will be processed only after successful payment.</p><h2>Delivery</h2><p>Delivery timelines may vary due to courier delays, festivals, weather conditions, or unforeseen circumstances.</p><h2>Intellectual Property</h2><p>All website content, product images, logos, and designs belong to GroveryGiftz and may not be copied without permission.</p><h2>Rights</h2><p>GroveryGiftz reserves the right to refuse or cancel any order if necessary.</p>`,
  'shipping-policy': `<p>We strive to deliver every personalized order safely and on time.</p><h2>Order Processing</h2><p>Since every product is custom-made:</p><p><strong>Dispatch Time:</strong> Within 6 Working Days</p><h2>Delivery Time</h2><p>After dispatch:</p><p><strong>Estimated Delivery:</strong> 2 Working Days</p><p>Delivery timelines may vary depending on the customer's location and courier service.</p><h2>Shipping Charges</h2><p>Shipping charges, if applicable, will be shown during checkout.</p><h2>Tracking</h2><p>Tracking details will be shared once your order is dispatched.</p><h2>Delays</h2><p>Unexpected delays due to weather, courier issues, strikes, or natural disasters are beyond our control.</p><h2>Damaged Package</h2><p>If your package is received in damaged condition, please contact us within 24 hours with photos and an unboxing video.</p>`,
  'refund-policy': `<p>As our products are personalized and custom-made, the following policy applies.</p><h2>Cancellation</h2><p>Orders can only be cancelled before production begins.</p><p>Once customization has started, cancellation is not possible.</p><h2>Refund</h2><p>Customized products are not eligible for refund unless:</p><ul><li>Wrong product delivered</li><li>Product received damaged</li><li>Manufacturing defect</li></ul><h2>Replacement Policy</h2><p>We take utmost care in packaging every order. However, if your product is damaged during transit due to courier mishandling, we will provide a free replacement, subject to verification.</p><p>To be eligible for a replacement, please contact us within 24 hours of delivery and provide:</p><ul><li>A complete unboxing video from opening the sealed package until the damaged product is visible</li><li>Clear photos of the damaged product</li><li>Photos of the outer packaging, if damaged</li></ul><p>If a replacement is approved, the customer must return the damaged product to us.</p><p>Once we receive the returned product, we will manufacture a new replacement product and dispatch it within 2 working days.</p><h2>Please Note</h2><ul><li>Replacement requests without an unboxing video may not be eligible.</li><li>Minor variations in color or appearance due to screen settings are not considered defects.</li><li>Damage caused after delivery due to customer handling is not eligible for replacement.</li></ul><p>Please review your order carefully before placing it.</p><h2>Contact Us</h2><p>For any support regarding your order:</p><p><strong>Email:</strong> Groverygiftz<br /><strong>WhatsApp:</strong> <a href="https://wa.me/919994549781">+919994549781</a></p>`,
};

const oldSeedMarkers = [
  'Your privacy is important to us. This privacy policy explains',
  'Effective Date:',
  'All orders are subject to availability and confirmation of the order price',
  'Delivery within Tamil Nadu is free. Orders outside Tamil Nadu',
  'Orders can be cancelled within 24 hours of placing',
];

const shouldUseDefaultPolicy = (slug, content = '') => {
  if (!defaultPolicyContent[slug]) return false;
  if (!String(content || '').trim()) return true;
  return oldSeedMarkers.some((marker) => content.includes(marker));
};

export default async function PolicyPage({ params }) {
  await dbConnect();
  const page = await Page.findOne({ slug: params.slug }).lean();

  const title = page?.title || titleMap[params.slug];
  if (!title) notFound();
  const content = shouldUseDefaultPolicy(params.slug, page?.content) ? defaultPolicyContent[params.slug] : page?.content;

  return (
    <div className="bg-gradient-to-b from-primary-50/60 to-white px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-5 shadow-sm sm:p-8 md:p-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-8 text-gray-950">{title}</h1>
        {content ? (
          <div className="prose max-w-none prose-headings:font-display prose-headings:text-gray-950 prose-h2:mt-8 prose-h2:text-xl prose-p:leading-7 prose-li:my-1 overflow-x-auto prose-img:max-w-full prose-table:block prose-table:overflow-x-auto" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <p className="text-gray-500">This page content can be managed from the admin panel.</p>
        )}
      </div>
    </div>
  );
}
