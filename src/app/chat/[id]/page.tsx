

'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { ArrowLeft, SendHorizonal } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

interface Contact {
    id: string;
    displayName: string;
    photoURL: string;
    email: string;
}


export default function ChatPage() {
  const { id: contactId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [contact, setContact] = useState<Contact | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !contactId) return;

    // Fetch contact details
    const getContact = async () => {
        const contactDoc = await getDoc(doc(db, 'users', contactId as string));
        if (contactDoc.exists()) {
            setContact({ id: contactDoc.id, ...contactDoc.data() } as Contact);
        } else {
            // Handle case where contact doesn't exist
            router.push('/contacts');
        }
    };
    getContact();

    // Generate a unique chat room ID
    const chatRoomId = [user.uid, contactId].sort().join('_');

    const q = query(
      collection(db, 'chats', chatRoomId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user, contactId, router]);

   useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !contactId) return;

    const chatRoomId = [user.uid, contactId].sort().join('_');

    await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
      text: newMessage,
      senderId: user.uid,
      timestamp: serverTimestamp(),
    });

    setNewMessage('');
  };
  
  if (!contact) {
    return <div className="flex items-center justify-center h-full">Loading...</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.14))] bg-muted/30">
        <header className="p-4 border-b flex items-center gap-4 bg-background">
            <Button variant="ghost" size="icon" className="md:hidden" asChild>
                <Link href="/contacts">
                    <ArrowLeft />
                </Link>
            </Button>
            <Avatar>
                <AvatarImage src={contact.photoURL} data-ai-hint="person"/>
                <AvatarFallback>{contact.displayName?.charAt(0) || 'C'}</AvatarFallback>
            </Avatar>
            <div>
                <h2 className="font-semibold text-lg">{contact.displayName}</h2>
                <p className="text-sm text-muted-foreground">{contact.email}</p>
            </div>
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
                    <AvatarImage src={contact.photoURL} data-ai-hint="person" />
                    <AvatarFallback>{contact.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                )}
                <div className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}>
                    <div
                    className={`p-3 rounded-xl max-w-xs md:max-w-md text-sm
                        ${isYou 
                        ? 'bg-primary text-primary-foreground rounded-br-none' 
                        : 'bg-background text-foreground rounded-bl-none shadow-sm'
                        }`
                    }
                    >
                    {msg.text}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      <footer className="p-4 border-t bg-background">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" className="flex-shrink-0" disabled={!newMessage.trim()}>
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}

