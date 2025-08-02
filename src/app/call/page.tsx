
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Maximize, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const participants = [
  { name: 'Sarah Connor', avatar: 'https://placehold.co/100x100/E9F0F0/333?text=SC', isHost: false },
  { name: 'John Doe', avatar: 'https://placehold.co/100x100/E9E9F0/333?text=JD', isHost: false },
  { name: 'Jane Smith', avatar: 'https://placehold.co/100x100/F0E9F0/333?text=JS', isHost: false },
];

export default function CallPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const getCameraPermission = async () => {
          try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({video: true});
                setHasCameraPermission(true);
                setIsCameraOn(true);

                if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                }
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Media Devices not supported',
                    description: 'Your browser does not support camera access.',
                });
                setHasCameraPermission(false);
            }
          } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings to use this app.',
            });
          }
        };

        getCameraPermission();
      }, [toast]);
    
      useEffect(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = isCameraOn;
            }
        }
    }, [isCameraOn]);


  return (
    <div className="flex h-screen max-h-screen bg-black text-white overflow-hidden">
      <div className="flex flex-1 flex-col relative">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/">
                <ChevronLeft />
              </Link>
            </Button>
            <div>
              <h2 className="font-semibold">Project Phoenix Kick-off</h2>
              <p className="text-xs text-muted-foreground">Session ID: 123-456-789</p>
            </div>
          </div>
          <Button variant="outline" className="bg-transparent hover:bg-white/10 hover:text-white border-white/30">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        </header>

        {/* Main Video Grid */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4 pt-20">
            <div className="relative aspect-video rounded-lg overflow-hidden lg:col-span-2 lg:row-span-2 bg-black flex items-center justify-center">
                 <video ref={videoRef} className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} autoPlay muted playsInline />
                {(!hasCameraPermission || !isCameraOn) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                        {!hasCameraPermission ? (
                             <Alert variant="destructive" className="max-w-sm">
                                <AlertTitle>Camera Access Required</AlertTitle>
                                <AlertDescription>
                                    Please allow camera access to use this feature. You may need to grant permissions in your browser settings.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="text-center">
                                <VideoOff className="h-12 w-12 mx-auto mb-2"/>
                                <p>Camera is off</p>
                            </div>
                        )}
                    </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md text-sm">Alex Norton (You)</div>
            </div>
            {participants.map((p, i) => (
                <div key={i} className="relative aspect-video rounded-lg overflow-hidden">
                    <Image src={`https://placehold.co/600x400.png`} layout="fill" objectFit="cover" alt={p.name} data-ai-hint="person video call" />
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md text-sm">{p.name}</div>
                </div>
            ))}
        </main>
        
        {/* Controls */}
        <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 p-4">
          <VideoControls isCameraOn={isCameraOn} onCameraToggle={() => setIsCameraOn(prev => !prev)} />
        </footer>
      </div>

      {/* Chat Panel */}
      <aside className="w-96 bg-gray-900/50 backdrop-blur-xl border-l border-white/10 h-full flex flex-col">
        <ChatPanel />
      </aside>
    </div>
  );
}
