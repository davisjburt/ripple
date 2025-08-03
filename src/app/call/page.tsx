
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
import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import Peer from 'simple-peer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CallPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [hasCameraPermission, setHasCameraPermission] = useState(true);

    const callId = searchParams.get('id');
    const contactName = searchParams.get('contactName');
    const isJoining = searchParams.get('answered') === 'true';

    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    // Unsubscribe listeners
    const unsubscribes = useRef<(() => void)[]>([]);


    const cleanup = useCallback(async () => {
        console.log('Cleaning up call...');
        unsubscribes.current.forEach(unsub => unsub());
        unsubscribes.current = [];

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        setCallStatus('ended');

        // Optional: Clean up the call document in Firestore
        if (callId) {
             try {
                // To prevent both users from deleting it, maybe only the initiator does.
                const callDoc = await getDoc(doc(db, 'calls', callId));
                if (callDoc.exists()) {
                   // await deleteDoc(doc(db, 'calls', callId));
                }
            } catch (error) {
                console.error("Error during cleanup: ", error);
            }
        }
    }, [callId]);


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

        peer.on('signal', async (data) => {
            if(data.candidate) {
                // Send candidate to the other peer
                const candidatesCollection = isInitiating ? callerCandidates : receiverCandidates;
                await addDoc(candidatesCollection, { candidate: JSON.stringify(data.candidate) });
            }
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
            toast({ title: 'Connection failed.', variant: 'destructive'});
            cleanup();
        });

        // Listen for remote ICE candidates
        const remoteCandidatesCollection = isInitiating ? receiverCandidates : callerCandidates;
        const unsubscribeCandidates = onSnapshot(remoteCandidatesCollection, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                   if(peer && !peer.destroyed) {
                     peer.signal({ candidate: JSON.parse(change.doc.data().candidate) });
                     // We can delete the candidate doc now that we've used it
                     await deleteDoc(change.doc.ref);
                   }
                }
            });
        });
        unsubscribes.current.push(unsubscribeCandidates);

    }, [cleanup, toast]);


    useEffect(() => {
        if (!user || !callId) return;

        const startMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
                return stream;
            } catch (err) {
                console.error("Failed to get media", err);
                setHasCameraPermission(false);
                toast({
                    title: "Camera/Mic access denied",
                    description: "Please allow access to your camera and microphone.",
                    variant: "destructive"
                });
                return null;
            }
        };

        const initiateCall = async (stream: MediaStream) => {
            const peer = new Peer({ initiator: true, trickle: true, stream });
            peerRef.current = peer;

            const callDocRef = doc(db, 'calls', callId);

            peer.on('signal', async (offer) => {
                // The first signal event for the initiator is the offer.
                if(offer.type === 'offer') {
                    await updateDoc(callDocRef, { offer: JSON.stringify(offer) });

                    // Now that we've sent the offer, listen for the answer
                    const unsubscribeAnswer = onSnapshot(callDocRef, (snapshot) => {
                        const data = snapshot.data();
                        if (data?.answer && peerRef.current && !peerRef.current.destroyed) {
                           peerRef.current.signal(JSON.parse(data.answer));
                           unsubscribeAnswer(); // Stop listening for answer once we have it
                        }
                    });
                    unsubscribes.current.push(unsubscribeAnswer);
                }
            });
            
            setupPeerListeners(peer, callId, true);
        };

        const joinCall = async (stream: MediaStream) => {
            const callDocRef = doc(db, 'calls', callId);
            const callDocSnap = await getDoc(callDocRef);

            if (!callDocSnap.exists() || !callDocSnap.data()?.offer) {
                toast({ title: "Call not found or invalid.", variant: "destructive" });
                cleanup();
                return;
            }
            
            const peer = new Peer({ initiator: false, trickle: true, stream });
            peerRef.current = peer;

            const offer = JSON.parse(callDocSnap.data().offer);
            peer.signal(offer); // Signal the offer to get the answer

            peer.on('signal', async (answer) => {
                // The first signal for the receiver is the answer
                if (answer.type === 'answer') {
                    await updateDoc(callDocRef, { answer: JSON.stringify(answer) });
                }
            });
            
            setupPeerListeners(peer, callId, false);
        };

        startMedia().then(stream => {
            if(stream) {
                if(isJoining) {
                    joinCall(stream);
                } else {
                    initiateCall(stream);
                }
            }
        });

        // Cleanup on component unmount
        return () => {
             cleanup();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, callId]);
    

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
                <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-4 pt-20 h-full">
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
