
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
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
    const isJoining = searchParams.get('answered') === 'true';

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
        
        if (callStatus !== 'ended') {
            setCallStatus('ended');
        }

        if(router && shouldRedirect) {
            router.push('/');
        }
    }, [callStatus, router]);

    const handleLeaveCall = useCallback(async (shouldRedirect = true) => {
        if (callId && user) {
             try {
                const callDocRef = doc(db, 'calls', callId);
                const callDocSnap = await getDoc(callDocRef);
                
                if (callDocSnap.exists() && callDocSnap.data()?.initiator === user?.uid) {
                   const callerCandidatesQuery = collection(db, 'calls', callId, 'callerCandidates');
                   const receiverCandidatesQuery = collection(db, 'calls', callId, 'receiverCandidates');
                   const callerCandidatesSnap = await getDocs(callerCandidatesQuery);
                   const receiverCandidatesSnap = await getDocs(receiverCandidatesQuery);
                   
                   const batch = writeBatch(db);
                   callerCandidatesSnap.forEach(doc => batch.delete(doc.ref));
                   receiverCandidatesSnap.forEach(doc => batch.delete(doc.ref));
                   
                   batch.delete(callDocRef);
                   
                   await batch.commit();
                }
            } catch (error) {
                console.error("Error during call document cleanup: ", error);
            }
        }
        cleanup(shouldRedirect);
    }, [callId, user, cleanup]);

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
    
    const setupPeerListeners = useCallback((peer: Peer.Instance, callDocId: string, isInitiating: boolean) => {
        const callerCandidates = collection(db, 'calls', callDocId, 'callerCandidates');
        const receiverCandidates = collection(db, 'calls', callDocId, 'receiverCandidates');
        
        const localCandidatesCollection = isInitiating ? callerCandidates : receiverCandidates;
        const remoteCandidatesCollection = isInitiating ? receiverCandidates : callerCandidates;

        peer.on('signal', async (data) => {
            if(data.candidate) {
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
                        if (peerRef.current.signalingState !== 'stable' || isJoining) {
                             peerRef.current.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                        }
                   } catch(err) {
                        console.error("Error signaling candidate", err);
                   }
                   await deleteDoc(change.doc.ref);
                }
            });
        });
        unsubscribes.current.push(unsubscribeCandidates);

    }, [cleanup, toast, isJoining]);


    useEffect(() => {
        if (!user || !callId) return;

        let isComponentMounted = true;

        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isComponentMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return null;
                };

                // Apply initial mic state
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = isMicOn;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
                return stream;
            } catch (err) {
                console.error("Failed to get media", err);
                if (isComponentMounted) {
                    setHasCameraPermission(false);
                    toast({
                        title: "Camera/Mic access denied",
                        description: "Please allow access to your camera and microphone.",
                        variant: "destructive"
                    });
                }
                return null;
            }
        };

        const initiateCall = async (stream: MediaStream) => {
            const peer = new Peer({ initiator: true, trickle: true });
            peerRef.current = peer;

            peer.addStream(stream);

            const callDocRef = doc(db, 'calls', callId);
            
            peer.on('signal', async (offer) => {
                if(offer.type === 'offer') {
                    await setDoc(callDocRef, { 
                        initiator: user.uid, 
                        createdAt: new Date(),
                        offer: JSON.stringify(offer)
                    }, { merge: true });
                }
            });

            const unsubscribe = onSnapshot(callDocRef, (snapshot) => {
                 if (!snapshot.exists() && snapshot.metadata.hasPendingWrites === false) {
                     if (isComponentMounted) cleanup();
                     return;
                }
                const data = snapshot.data();
                if (peerRef.current && !peerRef.current.destroyed && data?.answer && !answerApplied) {
                   try {
                     if (peerRef.current.signalingState !== 'stable') {
                        setAnswerApplied(true);
                        peerRef.current.signal(JSON.parse(data.answer));
                        unsubscribe(); 
                     }
                   } catch(err) {
                     console.error("Error applying answer", err);
                   }
                }
            });
            unsubscribes.current.push(unsubscribe);
            
            setupPeerListeners(peer, callId, true);
        };

        const joinCall = async (stream: MediaStream) => {
            const callDocRef = doc(db, 'calls', callId);
            
            const unsubscribeOffer = onSnapshot(callDocRef, async (callDocSnap) => {
                 if (!isComponentMounted || (peerRef.current && !peerRef.current.destroyed)) return;
                 
                 if (!callDocSnap.exists() && callDocSnap.metadata.hasPendingWrites === false) {
                     toast({ title: "Call not found or has been ended.", variant: "destructive" });
                     if (isComponentMounted) cleanup();
                     return;
                 }

                 if (callDocSnap.exists() && callDocSnap.data()?.offer) {
                    unsubscribeOffer();
                    
                    const peer = new Peer({ initiator: false, trickle: true });
                    peerRef.current = peer;

                    peer.addStream(stream);
                    
                    const offer = JSON.parse(callDocSnap.data().offer);
                    
                    peer.on('signal', async (answer) => {
                        if (answer.type === 'answer') {
                            await setDoc(callDocRef, { answer: JSON.stringify(answer) }, { merge: true });
                        }
                    });

                    try {
                        if (peer.signalingState !== 'stable') {
                             peer.signal(offer);
                        }
                    } catch (err) {
                        console.error("Error signaling offer", err);
                    }
                    
                    setupPeerListeners(peer, callId, false);
                 }
            }, (error) => {
                console.error("Error listening for call offer: ", error);
                toast({ title: "Call not found or invalid.", variant: "destructive" });
                 if (isComponentMounted) cleanup();
            });
            unsubscribes.current.push(unsubscribeOffer);
        };

        startMedia().then(stream => {
            if(stream && isComponentMounted) {
                if(isJoining) {
                    joinCall(stream);
                } else {
                    initiateCall(stream);
                }
            }
        });

        return () => {
             isComponentMounted = false;
             handleLeaveCall(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, callId, isJoining]);
    

    const callTitle = contactName ? `Call with ${contactName}` : `Call`;

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
