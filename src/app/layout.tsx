
import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/app-layout';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { usePathname } from 'next/navigation';

export const metadata: Metadata = {
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


function RootLayoutContent({ children }: { children: React.ReactNode }) {
    'use client';
    return <AppContent>{children}</AppContent>
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <RootLayoutContent>{children}</RootLayoutContent>
      </body>
    </html>
  );
}
