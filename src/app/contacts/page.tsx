'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MessageSquare, Phone, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const contacts = [
  {
    name: 'Sarah Connor',
    email: 'sarah.c@skynet.com',
    avatar: 'https://placehold.co/40x40/F0E9E9/333?text=SC',
    status: 'online',
  },
  {
    name: 'John Doe',
    email: 'john.d@example.com',
    avatar: 'https://placehold.co/40x40/E9F0F0/333?text=JD',
    status: 'online',
  },
  {
    name: 'Jane Smith',
    email: 'jane.s@example.com',
    avatar: 'https://placehold.co/40x40/E9E9F0/333?text=JS',
    status: 'offline',
  },
  {
    name: 'Michael Bay',
    email: 'm.bay@explosions.net',
    avatar: 'https://placehold.co/40x40/F0E9F0/333?text=MB',
    status: 'away',
  },
    {
    name: 'Ellen Ripley',
    email: 'ellen.r@weyland-yutani.com',
    avatar: 'https://placehold.co/40x40/F0F0E9/333?text=ER',
    status: 'online',
  },
];

export default function ContactsPage() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-700 border-green-500/30">Online</Badge>;
      case 'offline':
        return <Badge variant="outline">Offline</Badge>;
      case 'away':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Away</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users />
              <span>Your Contacts</span>
            </CardTitle>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact, index) => (
                  <motion.tr
                    key={contact.email}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={contact.avatar} data-ai-hint="person portrait" />
                          <AvatarFallback>
                            {contact.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {contact.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(contact.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                           <Link href="/call">
                              <Phone className="h-5 w-5 text-primary" />
                           </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
