'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { SendHorizonal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    text: string;
    timestamp: any;
}

interface ChatPanelProps {
    sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;

    const chatRoomId = `session_${sessionId}`;
    const messagesQuery = query(collection(db, 'chats', chatRoomId, 'messages'), orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(messagesQuery, (querySnapshot) => {
        const msgs: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
            msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
        });
        setMessages(msgs);
    });

    return () => unsubscribe();
  }, [sessionId]);


  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    
    const chatRoomId = `session_${sessionId}`;
    
    try {
        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          text: newMessage,
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          senderAvatar: user.photoURL || '',
          timestamp: serverTimestamp(),
        });
        setNewMessage('');
    } catch(error) {
        console.error("Error sending message:", error);
    }
  };


  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b border-white/10">
        <h3 className="font-semibold text-center">Meeting Chat</h3>
      </header>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((msg, index) => {
             const isYou = msg.senderId === user?.uid;
            return (
                <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-start gap-3 ${isYou ? 'justify-end' : ''}`}
                >
                {!isYou && (
                    <Avatar className="w-8 h-8">
                    <AvatarImage src={msg.senderAvatar} data-ai-hint="person" />
                    <AvatarFallback>{msg.senderName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                )}
                <div className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}>
                    <div
                    className={`p-3 rounded-xl max-w-xs text-sm
                        ${isYou 
                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                        : 'bg-gray-700/50 rounded-bl-none'
                        }`
                    }
                    >
                    {msg.text}
                    </div>
                     <div className="text-xs text-muted-foreground mt-1">
                        {!isYou && `${msg.senderName} at `}
                        {msg.timestamp && new Date(msg.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                {isYou && (
                    <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.photoURL || ''} data-ai-hint="person" />
                    <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                )}
                </motion.div>
            )
          })}
        </div>
      </ScrollArea>
      <footer className="p-4 border-t border-white/10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-gray-800 border-gray-700 focus:ring-primary text-white"
            />
            <Button type="submit" size="icon" className="flex-shrink-0" disabled={!newMessage.trim()}>
                <SendHorizonal className="h-5 w-5" />
            </Button>
        </form>
      </footer>
    </div>
  );
}
