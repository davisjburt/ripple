
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, Copy } from 'lucide-react';
import { VideoControls } from '@/components/video-controls';
import { ChatPanel } from '@/components/chat-panel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import Peer from 'simple-peer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

function CallRoom({ callId }: { callId: string }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);
    const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
    const [remoteUserConnected, setRemoteUserConnected] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const unsubscribes = useRef<(() => void)[]>([]);

    const isInitiatorRef = useRef(false);

    const cleanup = useCallback(async () => {
        console.log('Running cleanup...');

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        unsubscribes.current.forEach(unsub => unsub());
        unsubscribes.current = [];

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        if (isInitiatorRef.current) {
            try {
                const callRef = doc(db, 'calls', callId);
                const callSnap = await getDoc(callRef);
                if (callSnap.exists()) {
                    const batch = writeBatch(db);
                    const callerCandidatesQuery = collection(db, 'calls', callId, 'callerCandidates');
                    const receiverCandidatesQuery = collection(db, 'calls', callId, 'receiverCandidates');

                    const callerCandidatesSnap = await getDocs(callerCandidatesQuery);
                    callerCandidatesSnap.forEach(doc => batch.delete(doc.ref));

                    const receiverCandidatesSnap = await getDocs(receiverCandidatesQuery);
                    receiverCandidatesSnap.forEach(doc => batch.delete(doc.ref));

                    batch.delete(callRef);
                    await batch.commit();
                }
            } catch (error) {
                console.error("Error cleaning up call document:", error);
            }
        }
    }, [callId]);

    const handleLeaveCall = useCallback(async () => {
        await cleanup();
        router.push('/');
    }, [cleanup, router]);


    useEffect(() => {
        if (!user || !callId) return;

        let isMounted = true;
        
        const initializeCall = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setHasCameraPermission(true);
               
                const callDocRef = doc(db, 'calls', callId);
                const callSnap = await getDoc(callDocRef);
                
                isInitiatorRef.current = !callSnap.exists();

                const peer = new Peer({
                    initiator: isInitiatorRef.current,
                    trickle: true,
                    stream: stream,
                });
                peerRef.current = peer;

                if (isInitiatorRef.current) {
                    await setDoc(callDocRef, {
                        callerId: user.uid,
                        createdAt: serverTimestamp(),
                    });
                }
                
                peer.on('signal', async (signalData) => {
                    if (signalData.type === 'offer') {
                        await updateDoc(callDocRef, { offer: JSON.stringify(signalData) });
                    } else if (signalData.type === 'answer') {
                        await updateDoc(callDocRef, { answer: JSON.stringify(signalData) });
                    } else if (signalData.candidate) {
                        const candidatesCollection = collection(db, 'calls', callId, isInitiatorRef.current ? 'callerCandidates' : 'receiverCandidates');
                        await addDoc(candidatesCollection, { candidate: JSON.stringify(signalData.candidate) });
                    }
                });

                peer.on('stream', (remoteStream) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;
                    }
                    setRemoteUserConnected(true);
                });
                
                peer.on('close', () => {
                    if(isMounted) handleLeaveCall();
                });
                
                peer.on('error', (err) => {
                    console.error('Peer error:', err);
                    if(isMounted) {
                        toast({ title: 'Connection error.', variant: 'destructive'});
                        handleLeaveCall();
                    }
                });

                const unsubCallDoc = onSnapshot(callDocRef, (snapshot) => {
                    if (!snapshot.exists()) {
                        if (isMounted) {
                            toast({ title: 'Call has ended.', variant: 'destructive' });
                            handleLeaveCall();
                        }
                        return;
                    }
                    
                    const data = snapshot.data();
                    if (peerRef.current && !peerRef.current.destroyed) {
                         if (isInitiatorRef.current && data.answer && !peerRef.current.remoteAddress) {
                            peerRef.current.signal(JSON.parse(data.answer));
                        } else if (!isInitiatorRef.current && data.offer && !peerRef.current.remoteAddress) {
                            peerRef.current.signal(JSON.parse(data.offer));
                        }
                    }
                });
                unsubscribes.current.push(unsubCallDoc);

                const remoteCandidatesCollection = collection(db, 'calls', callId, isInitiatorRef.current ? 'receiverCandidates' : 'callerCandidates');
                const unsubscribeCandidates = onSnapshot(remoteCandidatesCollection, (snapshot) => {
                    snapshot.docChanges().forEach(async (change) => {
                        if (change.type === 'added' && peerRef.current && !peerRef.current.destroyed) {
                            try {
                                peerRef.current.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                                await deleteDoc(change.doc.ref);
                            } catch (err) {
                                console.error("Error signaling candidate", err);
                            }
                        }
                    });
                });
                unsubscribes.current.push(unsubscribeCandidates);

            } catch (err) {
                console.error("Failed to start call", err);
                if (isMounted) {
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

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; 
            handleLeaveCall();
        }

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
             isMounted = false;
             window.removeEventListener('beforeunload', handleBeforeUnload);
             cleanup();
        }
    }, [user, callId, toast, router, cleanup, handleLeaveCall]);

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

    const handleCameraToggle = () => {
        if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            videoTrack.enabled = !isCameraOn;
            setIsCameraOn(!isCameraOn);
        }
    };

    const handleMicToggle = () => {
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            audioTrack.enabled = !isMicOn;
            setIsMicOn(!isMicOn);
        }
    };

    return (
        <div className="flex h-screen max-h-screen bg-black text-white overflow-hidden">
            <div className="flex flex-1 flex-col relative">
                {/* Header */}
                <header className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
                            <ChevronLeft />
                        </Button>
                        <div>
                            <h2 className="font-semibold">Instant Meeting</h2>
                             <p className="text-xs text-muted-foreground mt-1">
                                Session ID: {callId}
                            </p>
                        </div>
                    </div>
                    {isInitiatorRef.current && (
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
                                <p className="text-muted-foreground">Waiting for user to join...</p>
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
                        onLeave={handleLeaveCall}
                        onToggleChat={() => setIsChatPanelOpen(!isChatPanelOpen)}
                        isChatOpen={isChatPanelOpen}
                    />
                </footer>
            </div>

            {/* Chat Panel */}
            <AnimatePresence>
                 {isChatPanelOpen && (
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full max-w-sm bg-gray-900/80 backdrop-blur-xl border-l border-white/10 h-full flex flex-col absolute right-0 top-0 z-40 md:relative md:w-96"
                    >
                        <ChatPanel sessionId={callId} />
                    </motion.aside>
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

    