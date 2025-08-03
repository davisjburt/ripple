
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc } from 'firebase/firestore';
import Peer from 'simple-peer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CallPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);

    const [callId, setCallId] = useState<string | null>(searchParams.get('id'));
    const [contactName, setContactName] = useState(searchParams.get('contactName'));
    const [isInitiator, setIsInitiator] = useState(false);

    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const cleanup = useCallback(() => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setCallStatus('ended');
    }, []);

    const startCall = useCallback(async (stream: MediaStream, callDocId: string) => {
        const peer = new Peer({ initiator: true, trickle: false, stream });
        peerRef.current = peer;

        peer.on('signal', async (offer) => {
            const callDoc = doc(db, 'calls', callDocId);
            await updateDoc(callDoc, { offer: JSON.stringify(offer) });
        });

        peer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setCallStatus('connected');
        });

        onSnapshot(doc(db, 'calls', callDocId), (snapshot) => {
            const data = snapshot.data();
            if (data?.answer && !peer.destroyed) {
                peer.signal(JSON.parse(data.answer));
            }
        });

        peer.on('close', cleanup);
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            cleanup();
        });
    }, [cleanup]);

    const answerCall = useCallback(async (stream: MediaStream, callDocId: string) => {
        const callDocSnap = await getDoc(doc(db, 'calls', callDocId));
        if (!callDocSnap.exists()) {
            toast({ title: "Call not found", variant: 'destructive' });
            return;
        }

        const callData = callDocSnap.data();
        if (!callData.offer) {
             toast({ title: "No offer found for this call", variant: 'destructive' });
             return;
        }

        const peer = new Peer({ initiator: false, trickle: false, stream });
        peerRef.current = peer;
        
        peer.signal(JSON.parse(callData.offer));

        peer.on('signal', async (answer) => {
            const callDoc = doc(db, 'calls', callDocId);
            await updateDoc(callDoc, { answer: JSON.stringify(answer) });
        });

        peer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setCallStatus('connected');
        });

        peer.on('close', cleanup);
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            cleanup();
        });
    }, [cleanup, toast]);


    useEffect(() => {
        if (!user || !callId) return;

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
                
                // Determine if we are initiating or answering
                const isJoining = searchParams.get('answered') === 'true';

                if (!isJoining) { // Initiator
                    setIsInitiator(true);
                    startCall(stream, callId);
                } else { // Receiver
                    answerCall(stream, callId);
                }

                 // Listen for ICE candidates
                const candidatesCollection = collection(db, 'calls', callId, isInitiator ? 'receiverCandidates' : 'callerCandidates');
                onSnapshot(candidatesCollection, (snapshot) => {
                    snapshot.docChanges().forEach(async (change) => {
                        if (change.type === 'added') {
                           if(peerRef.current) {
                             peerRef.current.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                             await deleteDoc(change.doc.ref);
                           }
                        }
                    });
                });

            }).catch(err => {
                console.error("Failed to get media", err);
                setHasCameraPermission(false);
                toast({
                    title: "Camera/Mic access denied",
                    description: "Please allow access to your camera and microphone.",
                    variant: "destructive"
                });
            });

        return () => {
             // In a real app, you might want to update the call doc status to 'ended'
            cleanup();
        }
    }, [user, callId, startCall, answerCall, toast, searchParams, isInitiator]);
    
     useEffect(() => {
        if (peerRef.current) {
            peerRef.current.on('signal', async (data) => {
                if (data.candidate) {
                    const candidatesCollection = collection(db, 'calls', callId!, isInitiator ? 'callerCandidates' : 'receiverCandidates');
                    await addDoc(candidatesCollection, { candidate: JSON.stringify(data.candidate) });
                }
            });
        }
    }, [callId, isInitiator]);

    const handleCameraToggle = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isCameraOn;
                setIsCameraOn(!isCameraOn);
            }
        }
    };

    const handleMicToggle = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isMicOn;
                setIsMicOn(!isMicOn);
            }
        }
    };

    const callTitle = contactName ? `Call with ${contactName}` : `Call ${callId}`;

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
                            <p className="text-xs text-muted-foreground">
                                Status: <span className="capitalize">{callStatus}</span>
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" className="bg-transparent hover:bg-white/10 hover:text-white border-white/30">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite
                    </Button>
                </header>

                {/* Main Video Grid */}
                <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-4 pt-20 h-full">
                     <div className="relative w-full h-full aspect-video rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
                        <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
                        {callStatus === 'connecting' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                                <Spinner size="large" />
                                <p className="text-muted-foreground">Connecting...</p>
                            </div>
                        )}
                     </div>
                      <div className="relative w-full h-full aspect-video rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
                        <video ref={localVideoRef} className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`} autoPlay muted playsInline />
                         {!hasCameraPermission && (
                             <Alert variant="destructive" className="max-w-sm">
                                <AlertTitle>Camera Access Denied</AlertTitle>
                                <AlertDescription>
                                    Please allow camera access in your browser settings to place a call.
                                </AlertDescription>
                            </Alert>
                         )}
                    </div>
                </main>

                {/* Controls */}
                <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 p-4">
                    <VideoControls
                        isCameraOn={isCameraOn}
                        onCameraToggle={handleCameraToggle}
                        isMicOn={isMicOn}
                        onMicToggle={handleMicToggle}
                    />
                </footer>
            </div>

            {/* Chat Panel */}
            <aside className="w-96 bg-gray-900/50 backdrop-blur-xl border-l border-white/10 h-full flex flex-col">
                <ChatPanel sessionId={callId || 'no-session'} />
            </aside>
        </div>
    );
}

