
'use client';

import { useEffect, useState, useRef } from 'react';
import P2PChat from 'p2p-chat';
import { useToast } from './use-toast';

interface Peer {
    id: string;
    stream: MediaStream;
    name: string;
}

export function useP2P(sessionId: string, stream: MediaStream | null, name: string) {
    const [peers, setPeers] = useState<Record<string, Peer>>({});
    const [isConnected, setIsConnected] = useState(false);
    const chatRef = useRef<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!stream) return;

        const chat = new P2PChat({
            id: name, // Use user's name as ID for simplicity
            sessionId: sessionId,
            stream: stream,
        });
        chatRef.current = chat;

        chat.on('peer-joined', (peerId: string) => {
            toast({ title: 'Peer Joined', description: `${peerId} joined the call.` });
        });

        chat.on('peer-left', (peerId: string) => {
            toast({ title: 'Peer Left', description: `${peerId} left the call.` });
            setPeers(currentPeers => {
                const newPeers = { ...currentPeers };
                delete newPeers[peerId];
                return newPeers;
            });
        });

        chat.on('peer-stream', (stream: MediaStream, peerId: string) => {
            setPeers(currentPeers => ({
                ...currentPeers,
                [peerId]: { id: peerId, stream, name: peerId },
            }));
        });
        
        chat.on('connect', () => {
            setIsConnected(true);
        })
        
        chat.on('disconnect', () => {
            setIsConnected(false);
        })

        return () => {
            chat.disconnect();
        };

    }, [stream, sessionId, name, toast]);

    return { peers, isConnected };
}
