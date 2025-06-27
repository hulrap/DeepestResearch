import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import "../globals.css";
import { Footer } from '@/components/Footer';
import { Analytics } from '@vercel/analytics/next';
import { AuthStateProvider } from '@/components/AuthStateProvider';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    metadataBase: new URL(defaultUrl),
    title: t('metaTitle'),
    description: t('metaDescription'),
    viewport: {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      userScalable: true,
      viewportFit: 'cover'
    }
  };
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className="dark">
      <body className={`${geistSans.className} antialiased bg-slate-900 text-white min-h-screen flex flex-col overflow-x-hidden`}>
        <NextIntlClientProvider messages={messages}>
          <AuthStateProvider>
            <div className="flex-1 flex flex-col">
              {children}
            </div>
            <Footer />
          </AuthStateProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
