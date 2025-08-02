
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, Phone, Settings, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/call', label: 'Start Call', icon: Phone },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const authItem = { href: '/login', label: 'Login', icon: LogIn };

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <div>
                    <item.icon />
                    <span>{item.label}</span>
                </div>
              </SidebarMenuButton>
            </Link>
        </SidebarMenuItem>
      ))}
       <SidebarMenuItem key={authItem.href}>
          <Link href={authItem.href}>
            <SidebarMenuButton
              isActive={pathname === authItem.href}
              tooltip={authItem.label}
            >
              <authItem.icon />
              <span>{authItem.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
    </SidebarMenu>
  );
}
