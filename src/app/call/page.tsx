
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, UserPlus, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';


interface Participant {
  id: string;
  stream: MediaStream;
  name: string;
}

function VideoTile({ stream, name }: { stream: MediaStream, name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md text-sm">{name}</div>
    </div>
  );
}


export default function CallPage() {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const sessionId = searchParams.get('id') || 'default-session';
    const contactName = searchParams.get('contactName');

    const [peers, setPeers] = useState<Record<string, Participant>>({});
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Record<string, { peer: Peer.Instance; name: string }>>({});
    const [isConnected, setIsConnected] = useState(false);
    
    const participants = Object.values(peers);

    const [callTitle, setCallTitle] = useState(
      contactName ? `Call with ${contactName}` : 'Project Phoenix Kick-off'
    );

    useEffect(() => {
      if (participants.length > 0) {
        const otherParticipantNames = participants.map(p => p.name).join(', ');
        setCallTitle(`Call with ${otherParticipantNames}`);
      } else if (contactName) {
        const isInitiator = !searchParams.has('answered');
        setCallTitle(isInitiator ? `Calling ${contactName}...` : `Call with ${contactName}`);
      } else {
        setCallTitle('Waiting for others to join...');
      }
    }, [participants, contactName, searchParams]);
    

    useEffect(() => {
        const getCameraPermission = async () => {
          try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
                setLocalStream(stream);
                setHasCameraPermission(true);
                setIsCameraOn(true);
                setIsMicOn(true);

                if (localVideoRef.current) {
                  localVideoRef.current.srcObject = stream;
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
        
        return () => {
          localStream?.getTracks().forEach(track => track.stop());
        }
    }, [toast]);
    
    useEffect(() => {
      if (localStream) {
          localStream.getVideoTracks().forEach(track => {
              track.enabled = isCameraOn;
          });
           localStream.getAudioTracks().forEach(track => {
              track.enabled = isMicOn;
          });
      }
    }, [isCameraOn, isMicOn, localStream]);

    const createPeer = (socketIDToSignal: string, name: string, initiator: boolean) => {
        if (!localStream || !socketRef.current) return;
    
        const peer = new Peer({
          initiator,
          trickle: true,
          stream: localStream,
        });
    
        peer.on('signal', (data) => {
          socketRef.current?.emit('sending signal', {
            userToSignal: socketIDToSignal,
            callerID: socketRef.current?.id,
            signal: data,
            name: user?.displayName || 'Anonymous',
          });
        });
    
        peer.on('stream', (stream) => {
           setPeers(prev => ({
            ...prev,
            [socketIDToSignal]: { id: socketIDToSignal, name: name, stream: stream },
          }));
        });
        
        peer.on('connect', () => console.log('peer connected', socketIDToSignal));
        peer.on('close', () => {
          console.log('peer closed', socketIDToSignal);
          delete peersRef.current[socketIDToSignal];
          setPeers(prev => {
            const newPeers = {...prev};
            delete newPeers[socketIDToSignal];
            return newPeers;
          });
        });
        peer.on('error', (err) => {
          console.error('peer error', socketIDToSignal, err);
        });
    
        peersRef.current[socketIDToSignal] = { peer, name };
        return peer;
      };

    useEffect(() => {
        if (!user || !localStream) return;
    
        socketRef.current = io('http://localhost:3001');
    
        setIsConnected(false);
    
        socketRef.current.on('connect', () => {
            console.log('Socket connected:', socketRef.current?.id);
            setIsConnected(true);
            toast({ title: "Connected", description: "Ready to join the call." });
            socketRef.current?.emit('join room', sessionId, user.displayName);
        });
        
        socketRef.current.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
           toast({ title: "Connection Failed", variant: 'destructive', description: "Could not connect to the signaling server." });
        });
    
    
        socketRef.current.on('all users', (users: { id: string; name: string }[]) => {
          console.log('got all users', users);
          users.forEach(u => {
            if (socketRef.current?.id && u.id !== socketRef.current.id) {
                createPeer(u.id, u.name, true);
            }
          });
        });
    
        socketRef.current.on('user joined', (payload) => {
          toast({ title: 'User Joined', description: `${payload.name} joined the call.` });
          const peer = createPeer(payload.callerID, payload.name, false);
          if(peer && socketRef.current) {
            peersRef.current[payload.callerID] = { peer, name: payload.name };
            peer.signal(payload.signal);
          }
        });
    
        socketRef.current.on('receiving returned signal', (payload) => {
            const item = peersRef.current[payload.id];
            if(item) {
            item.peer.signal(payload.signal);
            }
        });
        
        socketRef.current.on('user left', (id) => {
          const item = peersRef.current[id];
          if (item) {
            toast({ title: 'User Left', description: `${item.name} left the call.`});
            item.peer.destroy();
          }
          delete peersRef.current[id];
          setPeers(prev => {
            const newPeers = {...prev};
            delete newPeers[id];
            return newPeers;
          });
        });
        
        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
            toast({ title: "Disconnected", variant: 'destructive', description: "You have been disconnected from the call." });
        })
    
    
        return () => {
          socketRef.current?.disconnect();
          Object.values(peersRef.current).forEach(({peer}) => peer.destroy());
          setPeers({});
          peersRef.current = {};
        };
      }, [sessionId, user, localStream, toast]);

    const gridColsClass = participants.length < 1 ? 'grid-cols-1' : (participants.length < 4 ? 'grid-cols-2' : 'grid-cols-3');
    const gridRowsClass = participants.length === 0 ? 'grid-rows-1' : `grid-rows-${Math.ceil((participants.length + 1) / (participants.length < 1 ? 1 : (participants.length < 4 ? 2 : 3)))}`;

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
              <h2 className="font-semibold">{callTitle}</h2>
              <p className="text-xs text-muted-foreground">Session ID: {sessionId}</p>
            </div>
          </div>
          <Button variant="outline" className="bg-transparent hover:bg-white/10 hover:text-white border-white/30">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        </header>

        {/* Main Video Grid */}
        <main className={`flex-1 grid gap-2 p-4 pt-20 ${gridColsClass} ${gridRowsClass}`}>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
                 <video ref={localVideoRef} className={`w-full h-full object-cover ${isCameraOn ? '' : 'hidden'}`} autoPlay muted playsInline />
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
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md text-sm">{user?.displayName || 'You'} (You)</div>
            </div>
            {participants.map((p) => (
                <VideoTile key={p.id} stream={p.stream} name={p.name} />
            ))}
             {!isConnected && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col gap-4">
                <Spinner size="large" />
                <p className="text-muted-foreground">Connecting to signaling server...</p>
              </div>
            )}
        </main>
        
        {/* Controls */}
        <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 p-4">
          <VideoControls 
            isCameraOn={isCameraOn} 
            onCameraToggle={() => setIsCameraOn(prev => !prev)}
            isMicOn={isMicOn}
            onMicToggle={() => setIsMicOn(prev => !prev)}
            />
        </footer>
      </div>

      {/* Chat Panel */}
      <aside className="w-96 bg-gray-900/50 backdrop-blur-xl border-l border-white/10 h-full flex flex-col">
        <ChatPanel sessionId={sessionId} />
      </aside>
    </div>
  );
}
