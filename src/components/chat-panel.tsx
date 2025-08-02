'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendHorizonal } from 'lucide-react';
import { motion } from 'framer-motion';

const messages = [
  {
    sender: 'Sarah Connor',
    avatar: 'https://placehold.co/40x40/E9F0F0/333?text=SC',
    text: "Hey everyone, glad you could make it!",
    time: "10:01 AM",
  },
  {
    sender: 'John Doe',
    avatar: 'https://placehold.co/40x40/E9E9F0/333?text=JD',
    text: "Morning, Sarah! Looking forward to this.",
    time: "10:01 AM",
  },
  {
    sender: 'Alex Norton',
    avatar: 'https://placehold.co/40x40/F0E9E9/333?text=AN',
    text: "Alright team, let's kick things off. I've shared the agenda in the invite.",
    time: "10:02 AM",
    isYou: true
  },
   {
    sender: 'Jane Smith',
    avatar: 'https://placehold.co/40x40/F0E9F0/333?text=JS',
    text: "Got it. First point looks interesting.",
    time: "10:03 AM",
  },
];

export function ChatPanel() {
  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-white/10">
        <h3 className="font-semibold text-center">Meeting Chat</h3>
      </header>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-start gap-3 ${msg.isYou ? 'justify-end' : ''}`}
            >
              {!msg.isYou && (
                <Avatar className="w-8 h-8">
                  <AvatarImage src={msg.avatar} data-ai-hint="person" />
                  <AvatarFallback>{msg.sender.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col ${msg.isYou ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3 rounded-xl max-w-xs text-sm
                    ${msg.isYou 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-gray-700/50 rounded-bl-none'
                    }`
                  }
                >
                  {msg.text}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                    {!msg.isYou && `${msg.sender} at `}{msg.time}
                </div>
              </div>
               {msg.isYou && (
                <Avatar className="w-8 h-8">
                  <AvatarImage src={msg.avatar} data-ai-hint="person" />
                  <AvatarFallback>{msg.sender.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
              )}
            </motion.div>
          ))}
        </div>
      </ScrollArea>
      <footer className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 focus:ring-primary text-white"
          />
          <Button size="icon" className="flex-shrink-0">
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
