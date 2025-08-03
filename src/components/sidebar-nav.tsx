
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, Phone, Settings, LogIn, UserPlus, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/chat', label: 'Chats', icon: MessageSquare },
  { href: '/call', label: 'Start Call', icon: Phone },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const authItems = [
    { href: '/login', label: 'Login', icon: LogIn },
    { href: '/signup', label: 'Sign up', icon: UserPlus },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const isChatPage = pathname.startsWith('/chat');

  return (
    <SidebarMenu>
      {user && navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref>
              <SidebarMenuButton
                isActive={pathname === item.href || (item.href === '/chat' && isChatPage)}
                tooltip={item.label}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
        </SidebarMenuItem>
      ))}
      
      {!user && authItems.map((item) => (
          <SidebarMenuItem key={item.href}>
          <Link href={item.href}>
            <SidebarMenuButton
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
