import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Roamwise — A travel companion for you and your agent',
  description: 'Turn an AI conversation into a trip you can explore. Open agent-generated YAML, compare stays, and plan each day with Roamwise.',
  icons: { icon: '/roamwise.svg' },
  openGraph: {
    title: 'Roamwise — A travel companion for you and your agent',
    description: 'Turn an AI conversation into a trip you can explore. Open agent-generated YAML, compare stays, and plan each day with Roamwise.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roamwise — A travel companion for you and your agent',
    description: 'Turn an AI conversation into a trip you can explore. Open agent-generated YAML, compare stays, and plan each day with Roamwise.',
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
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
