
'use client';

import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/app-layout';
import { Toaster } from '@/components/ui/toaster';
import React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/hooks/use-auth';


function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <AuthProvider>
      {isAuthPage ? (
        children
      ) : (
        <AppLayout>
          {children}
        </AppLayout>
      )}
      <Toaster />
    </AuthProvider>
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
        <title>Ripple: Video Calling</title>
        <meta name="description" content="A modern video calling application." />
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
