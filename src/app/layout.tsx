
'use client';

import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/app-layout';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { usePathname } from 'next/navigation';

// Metadata can only be exported from a server component, so we define it here
// but we will need to wrap the main component in a client component to use hooks.
const metadataConfig: Metadata = {
  title: 'Ripple: Video Calling',
  description: 'A modern video calling application.',
};

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <>
      {isAuthPage ? (
        children
      ) : (
        <AppLayout>
          {children}
        </AppLayout>
      )}
      <Toaster />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{String(metadataConfig.title)}</title>
        <meta name="description" content={metadataConfig.description || ''} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AppContent>{children}</AppContent>
      </body>
    </html>
  );
}
