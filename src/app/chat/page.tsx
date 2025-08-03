
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom, getChatRooms } from '@/lib/firebase';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ChatsPage() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = getChatRooms(user.uid, (rooms) => {
      setChatRooms(rooms);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
      return (
          <div className="w-full md:w-96 border-r flex flex-col h-full bg-background">
              <header className="p-4 border-b">
                 <h2 className="text-xl font-bold flex items-center gap-2"><MessageSquare /> Chats</h2>
              </header>
              <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">Loading chats...</div>
              </div>
          </div>
      )
  }

  return (
    <div className="w-full md:w-96 border-r flex flex-col h-full bg-background">
      <header className="p-4 border-b">
        <h2 className="text-xl font-bold flex items-center gap-2"><MessageSquare /> Chats</h2>
      </header>
       <div className="flex-1 overflow-y-auto">
         {chatRooms.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
                 No active chats. Start a conversation from the contacts page.
             </div>
         ) : (
            <nav>
                <ul>
                {chatRooms.map((room) => (
                    <li key={room.id}>
                    <Link
                        href={`/chat/${room.otherUser.id}`}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                        <Avatar>
                        <AvatarImage src={room.otherUser.photoURL} data-ai-hint="person" />
                        <AvatarFallback>{room.otherUser.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate">{room.otherUser.displayName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                            {room.lastMessage?.text || 'No messages yet'}
                        </p>
                        </div>
                        {room.lastMessage?.timestamp && (
                        <time className="text-xs text-muted-foreground">
                            {new Date(room.lastMessage.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                        )}
                    </Link>
                    </li>
                ))}
                </ul>
            </nav>
         )}
      </div>
    </div>
  );
}
