import CheckoutFlow from '@/components/checkout/CheckoutFlow';
import { redirect } from 'next/navigation';
import { checkoutOutcomeUrl } from '@/lib/checkoutPayment';

export default function CheckoutPage({ searchParams }) {
  const orderId = typeof searchParams?.cashfree_order_id === 'string' ? searchParams.cashfree_order_id : '';
  if (orderId) redirect(checkoutOutcomeUrl('return', orderId));
  return <CheckoutFlow />;
}
