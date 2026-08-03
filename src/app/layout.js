import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import WhatsAppFloat from '@/components/layout/WhatsAppFloat';
import CartDrawer from '@/components/cart/CartDrawer';
import Providers from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'GroveryGiftz - Perfect Gifts for Your Loved Ones',
  description: 'Discover unique personalized gifts for every occasion. Customized frames, bottles, hampers, keychains and more.',
  icons: { icon: '/logo.svg', shortcut: '/logo.svg', apple: '/logo.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#2456D8', secondary: '#fff' } },
            }}
          />
          <AnnouncementBar />
          <Header />
          <CartDrawer />
          <main className="min-h-screen antialiased">{children}</main>
          <Footer />
          <WhatsAppFloat />
        </Providers>
      </body>
    </html>
  );
}

