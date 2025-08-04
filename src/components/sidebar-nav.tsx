
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, Phone, Settings, LogIn, UserPlus, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/chat', label: 'Chats', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const authItems = [
    { href: '/login', label: 'Login', icon: LogIn },
    { href: '/signup', label: 'Sign up', icon: UserPlus },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { setOpenMobile } = useSidebar();
  
  const isChatPage = pathname.startsWith('/chat');

  const handleCloseSidebar = () => {
    if (typeof setOpenMobile === 'function') {
      setOpenMobile(false);
    }
  }

  return (
    <SidebarMenu>
      {user && navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref onClick={handleCloseSidebar}>
              <SidebarMenuButton
                isActive={pathname === item.href || (item.href === '/chat' && isChatPage)}
                tooltip={item.label}
              >
                <item.icon className="h-6 w-6" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
        </SidebarMenuItem>
      ))}
      
      {!user && authItems.map((item) => (
          <SidebarMenuItem key={item.href}>
          <Link href={item.href} onClick={handleCloseSidebar}>
            <SidebarMenuButton
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <item.icon className="h-6 w-6" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
