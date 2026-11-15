import { redirect } from 'next/navigation';
import { checkoutOutcomeUrl } from '@/lib/checkoutPayment';

export const metadata = { title: 'Order confirmation | GroveryGiftz', robots: { index: false, follow: false } };

export default function PaymentReturnPage({ searchParams }) {
  const orderId = typeof searchParams?.cashfree_order_id === 'string' ? searchParams.cashfree_order_id : '';
  redirect(checkoutOutcomeUrl('confirmation', orderId));
}
