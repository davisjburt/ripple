
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Phone, Plus, Users, UserCheck, UserX, Check, X } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  addContact,
  getContacts, 
  getFriendRequests, 
  handleFriendRequest,
  User,
  FriendRequest,
  startCall,
  db
} from '@/lib/firebase';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';


export default function ContactsPage() {
  const [contacts, setContacts] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

   useEffect(() => {
    if (!user) return;

    const unsubscribeContacts = onSnapshot(getContacts(user.uid), (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setContacts(contactsData);
    });

    const unsubscribeRequests = onSnapshot(getFriendRequests(user.uid), (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setFriendRequests(requestsData);
    });

    return () => {
        unsubscribeContacts();
        unsubscribeRequests();
    };
  }, [user]);


  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactEmail || !user) return;
    
    try {
      const result = await addContact(user.uid, newContactEmail);
      toast({
        title: result.success ? 'Request Sent' : 'Error',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
       if(result.success) {
        setNewContactEmail('');
        setIsDialogOpen(false);
       }
    } catch (error: any) {
        toast({
            title: 'Error sending request',
            description: error.message,
            variant: 'destructive',
        });
    }
  };

  const respondToRequest = async (requestId: string, accepted: boolean) => {
    try {
      await handleFriendRequest(requestId, accepted);
      toast({
        title: accepted ? 'Friend Added' : 'Request Declined',
        description: `You have ${accepted ? 'accepted' : 'declined'} the friend request.`,
      });
    } catch (error: any) {
       toast({
        title: 'Error',
        description: `Failed to respond to request: ${error.message}`,
        variant: 'destructive',
      });
    }
  };
  
  const handleStartCall = async (contact: User) => {
    if (!user) return;
    try {
        const callerDoc = await getDoc(doc(db, 'users', user.uid));
        if (!callerDoc.exists()) {
            throw new Error("Could not find your user profile.");
        }
        const caller = { uid: callerDoc.id, ...callerDoc.data() } as User;
      
        const { callId, invitationId } = await startCall(caller, contact);
        router.push(`/call?id=${callId}&invitationId=${invitationId}&contactName=${encodeURIComponent(contact.displayName)}`);
    } catch (error) {
      console.error("Failed to start call:", error);
      toast({
        title: 'Call Error',
        description: 'Could not initiate the call.',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users />
              <span>Your Contacts ({contacts.length})</span>
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAddContact}>
                    <DialogHeader>
                    <DialogTitle>Add a new contact</DialogTitle>
                    <DialogDescription>
                        Enter the email address to send a friend request.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                        Email
                        </Label>
                        <Input
                        id="email"
                        type="email"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="col-span-3"
                        placeholder="contact@example.com"
                        required
                        />
                    </div>
                    </div>
                    <DialogFooter>
                    <Button type="submit">Send Request</Button>
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
             <div className="space-y-2">
                {/* Headers - visible on md and up */}
                 <div className="hidden md:flex items-center p-4 font-medium text-muted-foreground">
                    <div className="flex-1">Name</div>
                    <div className="w-40 text-right">Actions</div>
                </div>
                
                {contacts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        You haven't added any contacts yet.
                    </div>
                )}
                {contacts.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex flex-col md:flex-row items-start md:items-center p-4 hover:bg-muted/50 transition-colors border-t"
                  >
                    <div className="flex-1 flex items-center gap-3 mb-4 md:mb-0">
                        <Avatar>
                          <AvatarImage src={contact.photoURL} data-ai-hint="person portrait" />
                          <AvatarFallback>
                            {contact.displayName?.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{contact.displayName}</div>
                          <div className="text-sm text-muted-foreground">
                            {contact.email}
                          </div>
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex items-center justify-start md:justify-end gap-2">
                        <Button variant="outline" size="sm" asChild className="flex-1 md:flex-initial">
                           <Link href={`/chat/${contact.id}`}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                <span>Chat</span>
                           </Link>
                        </Button>
                        <Button variant="outline" size="icon" className="flex-initial" onClick={() => handleStartCall(contact)}>
                            <Phone className="h-5 w-5 text-primary" />
                        </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
          </CardContent>
        </Card>
      </motion.div>

       {friendRequests.length > 0 && (
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            >
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserCheck />
                    <span>Friend Requests</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                 <div className="space-y-2">
                     {/* Headers - visible on md and up */}
                    <div className="hidden md:flex items-center p-4 font-medium text-muted-foreground">
                        <div className="flex-1">From</div>
                        <div className="w-28 text-right">Actions</div>
                    </div>
                    {friendRequests.map((request) => (
                        <div key={request.id} className="flex flex-col md:flex-row items-start md:items-center p-4 hover:bg-muted/50 transition-colors border-t">
                            <div className="flex-1 flex items-center gap-3 mb-4 md:mb-0">
                                <Avatar>
                                    <AvatarImage src={request.fromPhotoURL} data-ai-hint="person portrait" />
                                    <AvatarFallback>
                                        {request.fromName?.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium">{request.fromName}</div>
                                    <div className="text-sm text-muted-foreground">{request.fromEmail}</div>
                                </div>
                            </div>
                            <div className="w-full md:w-auto flex items-center justify-start md:justify-end gap-2">
                                <Button variant="outline" size="icon" className="text-green-500 border-green-500 hover:bg-green-500/10 hover:text-green-600" onClick={() => respondToRequest(request.id, true)}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                    <Button variant="outline" size="icon" className="text-red-500 border-red-500 hover:bg-red-500/10 hover:text-red-600" onClick={() => respondToRequest(request.id, false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                 </div>
            </CardContent>
            </Card>
        </motion.div>
       )}
    </div>
  );
}

    