
'use client';

import { AppLayout } from '../../components/app-layout';
import { usePathname } from 'next/navigation';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChatListPage = pathname === '/chat';

  return (
      <div className="flex h-screen bg-muted/30 w-full">
        {children}
      </div>
  );
}
