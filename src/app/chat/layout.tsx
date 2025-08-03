
import { AppLayout } from '@/components/app-layout';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="flex h-screen bg-muted/30">
        {children}
      </div>
  );
}
