import CheckoutFlow from '@/components/checkout/CheckoutFlow';

export const metadata = { title: 'Order confirmation | GroveryGiftz', robots: { index: false, follow: false } };

export default function OrderConfirmationPage({ searchParams }) {
  const orderId = typeof searchParams?.cashfree_order_id === 'string' ? searchParams.cashfree_order_id : '';
  return <CheckoutFlow mode="confirmation" orderId={orderId} />;
}
