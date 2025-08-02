
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, ChevronRight, Plus, Video } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';

const meetings = [
  {
    time: '10:00 AM',
    title: 'Daily Standup',
    duration: '15 min',
    participants: ['/placeholder-user-1.jpg', '/placeholder-user-2.jpg', '/placeholder-user-3.jpg'],
  },
  {
    time: '2:30 PM',
    title: 'Project Phoenix Kick-off',
    duration: '45 min',
    participants: ['/placeholder-user-4.jpg', '/placeholder-user-5.jpg'],
  },
  {
    time: '4:00 PM',
    title: '1-on-1 with Sarah',
    duration: '30 min',
    participants: ['/placeholder-user-6.jpg'],
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, <span className="font-wavy">{firstName || 'User'}</span></h1>
        <p className="text-muted-foreground">Ready to connect? Here’s what’s on your plate today.</p>
      </motion.div>

      <div className="grid gap-8 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="text-primary" />
                <span>Start a New Call</span>
              </CardTitle>
              <CardDescription>Instantly create a new meeting room.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/call">
                <Button className="w-full" size="lg">
                  <Video className="mr-2 h-5 w-5" />
                  Create Instant Meeting
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChevronRight className="text-primary" />
                <span>Join a Session</span>
              </CardTitle>
              <CardDescription>Enter a session ID to join an ongoing call.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Enter Session ID..." className="bg-background/80" />
                <Link href="/call">
                  <Button>Join</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar />
              <span>Upcoming Meetings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {meetings.map((meeting, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="font-semibold text-primary w-20">{meeting.time}</div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{meeting.title}</p>
                    <p className="text-sm text-muted-foreground">{meeting.duration}</p>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {meeting.participants.map((p, i) => (
                      <Avatar key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                        <AvatarImage src={`https://placehold.co/32x32.png`} data-ai-hint="person" />
                        <AvatarFallback>P{i}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href="/call">
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
