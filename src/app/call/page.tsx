
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, Copy, X } from 'lucide-react';
import Link from 'next/link';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { db, leaveCall, Call } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Peer from 'simple-peer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';


function CallRoom({ callId }: { callId: string }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);
    const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
    const isMobile = useIsMobile();
    
    const [callData, setCallData] = useState<Call | null>(null);
    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    const unsubscribes = useRef<(() => void)[]>([]);

    const cleanup = useCallback(() => {
        console.log('Running cleanup...');
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

        unsubscribes.current.forEach(unsub => unsub());
        unsubscribes.current = [];
        
        if (callStatus !== 'ended') {
            setCallStatus('ended');
        }
    }, [callStatus]);

    const handleLeaveCall = useCallback(async (shouldRedirect = true) => {
        if (callId) {
            await leaveCall(callId);
        }
        cleanup();
        if(shouldRedirect) {
            router.push('/');
        }
    }, [callId, cleanup, router]);


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

    useEffect(() => {
        if (!user || !callId) return;

        let isComponentMounted = true;
        
        const initializeCall = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isComponentMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setHasCameraPermission(true);
                stream.getAudioTracks()[0].enabled = isMicOn;
                stream.getVideoTracks()[0].enabled = isCameraOn;

                const callDocRef = doc(db, 'calls', callId);
                
                const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
                    if (!isComponentMounted || callStatus === 'ended') return;

                    if (!snapshot.exists()) {
                        const isJoining = new URLSearchParams(window.location.search).has('join');
                        if (!isJoining) {
                             await setDoc(callDocRef, {
                                type: 'instant',
                                caller: { id: user.uid, name: user.displayName, photoURL: user.photoURL },
                                status: 'active',
                                createdAt: serverTimestamp()
                            });
                        } else {
                            if (callStatus !== 'ended') {
                                toast({ title: 'Call has ended.', variant: 'destructive' });
                                cleanup();
                                router.push('/');
                            }
                        }
                        return;
                    }
                    
                    const data = snapshot.data() as Call;
                    setCallData(data);
                    
                    if (!peerRef.current && localStreamRef.current) {
                        const isInitiator = data.caller.id === user.uid;
                        
                        const peer = new Peer({ initiator: isInitiator, trickle: true, stream: localStreamRef.current });
                        peerRef.current = peer;

                        peer.on('stream', (remoteStream) => {
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.srcObject = remoteStream;
                            }
                            setCallStatus('connected');
                        });
                        
                        peer.on('signal', async (signalData) => {
                            if (callStatus === 'ended' || !isComponentMounted) return;
                            const callDoc = await getDoc(callDocRef);
                            if (!callDoc.exists()) return; // Don't signal if call doc is gone

                            if (signalData.type === 'offer') {
                                await updateDoc(callDocRef, { offer: JSON.stringify(signalData) });
                            } else if (signalData.type === 'answer') {
                                await updateDoc(callDocRef, { answer: JSON.stringify(signalData), status: 'answered' });
                            } else if (signalData.candidate) {
                                const candidatesCollection = collection(db, 'calls', callId, isInitiator ? 'callerCandidates' : 'receiverCandidates');
                                await addDoc(candidatesCollection, { candidate: JSON.stringify(signalData.candidate) });
                            }
                        });

                        peer.on('close', () => handleLeaveCall(true));
                        peer.on('error', (err) => {
                            console.error('Peer error:', err);
                            toast({ title: 'Connection failed.', variant: 'destructive'});
                            handleLeaveCall(true);
                        });

                        const listenForCandidates = (isInitiator: boolean) => {
                            const remoteCandidatesCollection = collection(db, 'calls', callId, isInitiator ? 'receiverCandidates' : 'callerCandidates');
                            const unsubscribeCandidates = onSnapshot(remoteCandidatesCollection, (snapshot) => {
                                snapshot.docChanges().forEach(async (change) => {
                                    if (change.type === 'added' && peerRef.current && !peerRef.current.destroyed) {
                                        try {
                                            peerRef.current.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                                            await deleteDoc(change.doc.ref);
                                        } catch(err) {
                                            console.error("Error signaling candidate", err);
                                        }
                                    }
                                });
                            });
                            unsubscribes.current.push(unsubscribeCandidates);
                        }
                        listenForCandidates(isInitiator);
                    }

                    if (peerRef.current && !peerRef.current.destroyed) {
                        const isInitiator = data.caller.id === user.uid;
                        if (!isInitiator && data.offer && !peerRef.current.remoteAddress) {
                            peerRef.current.signal(JSON.parse(data.offer));
                        }
                        if (isInitiator && data.answer && !peerRef.current.remoteAddress) {
                            peerRef.current.signal(JSON.parse(data.answer));
                        }
                    }
                });
                unsubscribes.current.push(unsubCallDoc);

            } catch (err) {
                console.error("Failed to start call", err);
                if (isComponentMounted) {
                    setHasCameraPermission(false);
                    toast({
                        title: "Could not start call",
                        description: "Please allow access to your camera and microphone.",
                        variant: "destructive"
                    });
                }
            }
        };

        initializeCall();

        return () => {
             isComponentMounted = false;
             handleLeaveCall(false);
        }
    }, [user, callId]);

    const handleInvite = () => {
        const inviteLink = `${window.location.origin}/call?id=${callId}&join=true`;
        navigator.clipboard.writeText(inviteLink).then(() => {
            toast({
                title: "Invite Link Copied!",
                description: "You can now share this link with others to join the call.",
            });
        }).catch(err => {
            console.error('Failed to copy: ', err);
             toast({
                title: "Failed to copy link",
                variant: 'destructive',
            });
        });
    };

    const callTitle = callData?.type === 'direct' 
        ? `Call with ${user?.uid === callData.caller.id ? callData.receiver?.name : callData.caller.name}` 
        : `Instant Meeting`;
    const isInstantMeeting = callData?.type === 'instant' || !callData?.type; // Handle new instant meetings
    const remoteUserConnected = callStatus === 'connected';


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
                                Status: <span className="capitalize">{remoteUserConnected ? 'Connected' : (callStatus === 'ended' ? 'Ended' : 'Connecting...')}</span>
                            </p>
                            {isInstantMeeting && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Session ID: {callId}
                                </p>
                            )}
                        </div>
                    </div>
                    {isInstantMeeting && (
                        <Button variant="outline" className="bg-transparent hover:bg-white/10 hover:text-white border-white/30" onClick={handleInvite}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Invite Link
                        </Button>
                    )}
                </header>

                {/* Main Video Grid */}
                <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-2 pt-20 h-full">
                     <div className="relative w-full h-full aspect-video rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center">
                        <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
                        {!remoteUserConnected && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                                <Spinner size="large" />
                                <p className="text-muted-foreground">{callStatus === 'ended' ? 'Call Ended' : 'Waiting for user...'}</p>
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
                         {isCameraOn && !localStreamRef.current && hasCameraPermission && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                <Spinner size="large" />
                             </div>
                         )}
                         {!isCameraOn && hasCameraPermission && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                               <p>Camera is off</p>
                            </div>
                         )}
                    </div>
                </main>

                {/* Controls */}
                <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 p-4">
                    <VideoControls
                        isCameraOn={isCameraOn}
                        onCameraToggle={handleCameraToggle}
                        isMicOn={isMicOn}
                        onMicToggle={handleMicToggle}
                        onLeave={() => handleLeaveCall(true)}
                        onToggleChat={() => setIsChatPanelOpen(!isChatPanelOpen)}
                        isChatOpen={isChatPanelOpen}
                    />
                </footer>
            </div>

            {/* Chat Panel */}
            <AnimatePresence>
                 {isChatPanelOpen && (
                    <>
                    {/* Backdrop for mobile */}
                    {isMobile && (
                         <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsChatPanelOpen(false)}
                            className="absolute inset-0 bg-black/50 z-30 md:hidden"
                        />
                    )}
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full max-w-sm bg-gray-900/80 backdrop-blur-xl border-l border-white/10 h-full flex flex-col absolute right-0 top-0 z-40 md:relative md:w-96"
                    >
                         <div className="p-4 border-b border-white/10 flex items-center justify-between md:hidden">
                            <h3 className="font-semibold">Meeting Chat</h3>
                            <Button variant="ghost" size="icon" onClick={() => setIsChatPanelOpen(false)}>
                                <X className="h-5 w-5"/>
                            </Button>
                         </div>
                        <ChatPanel sessionId={callId || 'no-session'} />
                    </motion.aside>
                    </>
                 )}
            </AnimatePresence>
        </div>
    );
}


export default function CallPage() {
    const searchParams = useSearchParams();
    const callId = searchParams.get('id');

    if (!callId) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        No call ID was provided. Please use a valid invite link.
                        <Button asChild variant="link">
                            <Link href="/">Return to Dashboard</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return <CallRoom callId={callId} />;
}

    