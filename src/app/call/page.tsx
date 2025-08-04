
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, UserPlus, X, Copy } from 'lucide-react';
import Link from 'next/link';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { db, leaveCall, declineOrEndCall, Call } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, writeBatch, getDocs, serverTimestamp } from 'firebase/firestore';
import Peer from 'simple-peer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';


export default function CallPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const isMobile = useIsMobile();

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);
    const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

    const callId = searchParams.get('id');
    const contactName = searchParams.get('contactName');
    const isJoining = searchParams.get('join') === 'true';

    const [callData, setCallData] = useState<Call | null>(null);
    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    const [answerApplied, setAnswerApplied] = useState(false);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    const unsubscribes = useRef<(() => void)[]>([]);


    const cleanup = useCallback((shouldRedirect = true) => {
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
        
        setCallStatus('ended');

        if(router && shouldRedirect) {
            router.push('/');
        }
    }, [router]);

    const handleLeaveCall = useCallback(async (shouldRedirect = true) => {
        if (callId) {
            if (callData?.type === 'direct') {
                await declineOrEndCall(callId); // Notifies other user
            }
            await leaveCall(callId); // Cleans up Firestore for all call types
        }
        cleanup(shouldRedirect);
    }, [callId, callData, cleanup]);

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
    
    const setupPeerListeners = useCallback((peer: Peer.Instance, callDocId: string, isInitiator: boolean) => {
        const callerCandidates = collection(db, 'calls', callDocId, 'callerCandidates');
        const receiverCandidates = collection(db, 'calls', callDocId, 'receiverCandidates');
        
        const localCandidatesCollection = isInitiator ? callerCandidates : receiverCandidates;
        const remoteCandidatesCollection = isInitiator ? receiverCandidates : callerCandidates;

        peer.on('signal', async (data) => {
            if(data.candidate && callStatus !== 'ended') {
                await addDoc(localCandidatesCollection, { candidate: JSON.stringify(data.candidate) });
            }
        });

        peer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setCallStatus('connected');
        });

        peer.on('close', () => cleanup());
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            toast({ title: 'Connection failed.', variant: 'destructive'});
            cleanup();
        });

        const unsubscribeCandidates = onSnapshot(remoteCandidatesCollection, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' && peerRef.current && !peerRef.current.destroyed) {
                   try {
                        peerRef.current.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                   } catch(err) {
                        console.error("Error signaling candidate", err);
                   }
                   await deleteDoc(change.doc.ref);
                }
            });
        });
        unsubscribes.current.push(unsubscribeCandidates);

    }, [cleanup, toast, callStatus]);


    useEffect(() => {
        if (!user || !callId) return;

        let isComponentMounted = true;
        let peer: Peer.Instance | null = null;
        let stream: MediaStream | null = null;
        
        const startMediaAndInitializeCall = async () => {
            const callDocRef = doc(db, 'calls', callId);

            // For instant meetings, initiator creates the doc immediately
            if (!isJoining && !contactName) {
                await setDoc(callDocRef, { 
                    type: 'instant',
                    caller: { id: user.uid, name: user.displayName, photoURL: user.photoURL },
                    status: 'active',
                    createdAt: serverTimestamp() 
                });
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isComponentMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                };

                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) audioTrack.enabled = isMicOn;
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) videoTrack.enabled = isCameraOn;

                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setHasCameraPermission(true);

                // Now that media is ready, start listening to the call document
                const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
                    if (!isComponentMounted) {
                         unsubCallDoc();
                         return;
                    }
                    
                    const data = snapshot.data() as Call;
                    setCallData(data);
                    
                    if (!snapshot.exists()) {
                         toast({ title: "Call not found or has ended.", variant: "destructive" });
                         cleanup();
                         return;
                    }
                    
                    if (data.status === 'declined' || data.status === 'missed' || data.status === 'ended') {
                        toast({ title: `Call ${data.status}`, variant: 'destructive'});
                        cleanup();
                        return;
                    }

                    // Only initialize the peer once
                    if (!peer && (data.status === 'ringing' || data.status === 'answered' || data.status === 'active')) {
                        const isInitiator = data.caller.id === user.uid;
                        
                        peer = new Peer({ initiator: isInitiator, trickle: true, stream });
                        peerRef.current = peer;

                        setupPeerListeners(peer, callId, isInitiator);

                        if (isInitiator) {
                             if (!data.offer) {
                                peer.on('signal', async (offer) => {
                                    if (offer.type === 'offer' && callStatus !== 'ended') {
                                        await updateDoc(callDocRef, { offer: JSON.stringify(offer), status: 'active' });
                                    }
                                });
                             }
                             if (data.answer && !answerApplied) {
                                if (peerRef.current && !peerRef.current.destroyed && peerRef.current.signalingState !== 'stable') {
                                    peerRef.current.signal(JSON.parse(data.answer));
                                    setAnswerApplied(true);
                                }
                             }
                        } else { // Is receiver/joiner
                            if(data.offer && peer) {
                                try {
                                    peer.signal(JSON.parse(data.offer));
                                } catch (err) {
                                    console.error("Error signaling offer", err);
                                }

                                peer.on('signal', async (answer) => {
                                    if (answer.type === 'answer' && callStatus !== 'ended' && !data.answer) {
                                       await updateDoc(callDocRef, { answer: JSON.stringify(answer) });
                                    }
                                });
                            }
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

        startMediaAndInitializeCall();

        return () => {
             isComponentMounted = false;
             handleLeaveCall(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const callTitle = callData?.type === 'direct' ? `Call with ${contactName}` : `Instant Meeting`;
    const isInstantMeeting = callData?.type === 'instant';


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
                        {callStatus !== 'connected' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                                <Spinner size="large" />
                                <p className="text-muted-foreground">{callStatus === 'connecting' ? 'Connecting...' : 'Call Ended'}</p>
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
                         {isCameraOn && !localVideoRef.current?.srcObject && hasCameraPermission && (
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
