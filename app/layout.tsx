import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://roamwise-edinburgh.amodrono.chatgpt.site'),
  title: 'Roamwise — Trip options, decided together',
  description: 'Compare flights, stays and activities, then see the real cost per person.',
  openGraph: {
    title: 'Roamwise — Trip options, decided together',
    description: 'Compare flights, stays and activities, then see the real cost per person.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roamwise — Trip options, decided together',
    description: 'Compare flights, stays and activities, then see the real cost per person.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
