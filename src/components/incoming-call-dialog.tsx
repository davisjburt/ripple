
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { Call, answerCall, declineOrEndCall } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface IncomingCallDialogProps {
  call: Call;
  onClose: () => void;
}

export function IncomingCallDialog({ call, onClose }: IncomingCallDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleAccept = async () => {
    try {
      await answerCall(call.id);
      onClose();
      // Navigate to the call page, passing the call document id
      router.push(`/call?id=${call.id}&contactName=${encodeURIComponent(call.caller.name)}&join=true`);
    } catch (error) {
      console.error('Failed to answer call:', error);
      toast({
        title: 'Error',
        description: 'Failed to answer the call.',
        variant: 'destructive',
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineOrEndCall(call.id);
      onClose();
    } catch (error) {
      console.error('Failed to decline call:', error);
       toast({
        title: 'Error',
        description: 'Failed to decline the call.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={!!call} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Incoming Call</DialogTitle>
          <DialogDescription className="text-center">
             You have an incoming call from {call.caller.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Avatar className="h-24 w-24">
                <AvatarImage src={call.caller.photoURL} data-ai-hint="person" />
                <AvatarFallback className="text-3xl">
                    {call.caller.name.charAt(0)}
                </AvatarFallback>
            </Avatar>
            <p className="font-semibold text-lg">{call.caller.name}</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button onClick={handleDecline} variant="destructive" size="lg" className="rounded-full h-16 w-16">
            <PhoneOff className="h-6 w-6" />
            <span className="sr-only">Decline</span>
          </Button>
           <Button onClick={handleAccept} variant="default" size="lg" className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600">
            <Phone className="h-6 w-6" />
            <span className="sr-only">Accept</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
