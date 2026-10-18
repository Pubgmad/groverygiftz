import CheckoutFlow from '@/components/checkout/CheckoutFlow';

export const metadata = { title: 'Payment confirmation | GroveryGiftz', robots: { index: false, follow: false } };

export default function PaymentReturnPage({ searchParams }) {
  const orderId = typeof searchParams?.cashfree_order_id === 'string' ? searchParams.cashfree_order_id : '';
  return <CheckoutFlow mode="return" orderId={orderId} />;
}
