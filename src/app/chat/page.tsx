
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { useAuth } from '../../hooks/use-auth';
import { ChatRoom, getChatRooms } from '../../lib/firebase';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Spinner } from '../../components/ui/spinner';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

function NoChatSelected() {
    return (
        <div className="hidden md:flex flex-col items-center justify-center h-full w-full bg-background">
            <MessageSquare className="w-16 h-16 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Select a chat to start messaging</p>
        </div>
    )
}


export default function ChatsPage() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const isChatDetailPage = pathname.includes('/chat/') && pathname !== '/chat';

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

  const ChatList = () => (
    <div className={cn(
        "w-full md:w-96 border-r flex-col h-full bg-background",
        isChatDetailPage ? "hidden md:flex" : "flex"
    )}>
      <header className="p-4 border-b">
        <h2 className="text-xl font-bold flex items-center gap-2"><MessageSquare /> Chats</h2>
      </header>
       <div className="flex-1 overflow-y-auto">
         <AnimatePresence>
         {loading ? (
             <div className="p-8 text-center text-muted-foreground flex items-center justify-center h-full">
                 <Spinner />
             </div>
         ) : chatRooms.length === 0 ? (
             <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 text-center text-muted-foreground flex items-center justify-center h-full">
                 No active chats. Start a conversation from the contacts page.
             </motion.div>
         ) : (
            <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                >
            {chatRooms.map((room, index) => (
                <motion.li 
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  >
                <Link
                    href={`/chat/${room.otherUser.id}`}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${pathname === `/chat/${room.otherUser.id}` ? 'bg-muted/50' : ''}`}
                >
                    <Avatar>
                    <AvatarImage src={room.otherUser.photoURL} data-ai-hint="person" />
                    <AvatarFallback>{room.otherUser.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{room.otherUser.displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                        Conversation
                    </p>
                    </div>
                </Link>
                </motion.li>
            ))}
            </motion.ul>
         )}
         </AnimatePresence>
      </div>
    </div>
  )

  return (
    <>
      <ChatList />
       { !isChatDetailPage && <NoChatSelected /> }
    </>
  );
}
