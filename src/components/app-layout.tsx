
'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from './ui/sidebar';
import { SidebarNav } from './sidebar-nav';
import { UserNav } from './user-nav';
import { PanelLeft, Video } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { Call } from '../lib/firebase';
import { IncomingCallDialog } from './incoming-call-dialog';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [defaultOpen, setDefaultOpen] = React.useState(true);
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  useEffect(() => {
    const savedState = document.cookie.match(/sidebar_state=([^;]+)/);
    if (savedState) {
      setDefaultOpen(savedState[1] === 'true');
    }
  }, []);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Video className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Ripple</h1>
          </div>
        </SidebarHeader>
        <SidebarContent className="pt-4">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>{/* Can add elements here */}</SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b bg-background/80 backdrop-blur-lg sm:px-6">
          <SidebarTrigger className="md:hidden">
             <PanelLeft />
             <span className="ml-2">Menu</span>
          </SidebarTrigger>
          <div className="flex-1" />
          <UserNav />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
      {incomingCall && (
        <IncomingCallDialog
          call={incomingCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </SidebarProvider>
  );
}
