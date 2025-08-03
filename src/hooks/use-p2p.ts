
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import Peer from 'simple-peer';
import { io, Socket } from 'socket.io-client';

interface PeerData {
  peer: Peer.Instance;
  name: string;
}

interface Participant {
  id: string;
  name: string;
  stream: MediaStream;
  peer: Peer.Instance;
}

export function useP2P(sessionId: string, localStream: MediaStream | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [peers, setPeers] = useState<Record<string, Participant>>({});
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Record<string, PeerData>>({});
  const [isConnected, setIsConnected] = useState(false);

  const createPeer = useCallback((socketIDToSignal: string, name: string, initiator: boolean) => {
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
        [socketIDToSignal]: { id: socketIDToSignal, name: name, stream: stream, peer: peer },
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
  }, [localStream, user?.displayName]);


  useEffect(() => {
    if (!user || !localStream) return;
    
    const initializeSocket = async () => {
        await fetch('/api/socket');
        socketRef.current = io({
          path: '/api/socket',
          addTrailingSlash: false,
        });

        setIsConnected(false);

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            toast({ title: "Connected", description: "Ready to join the call." });
            socketRef.current?.emit('join room', sessionId, user.displayName);
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
            // The signal from the new user needs to be sent back to them to complete the connection
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
    }

    initializeSocket();

    return () => {
      socketRef.current?.disconnect();
      Object.values(peersRef.current).forEach(({peer}) => peer.destroy());
      setPeers({});
      peersRef.current = {};
    };
  }, [sessionId, user, localStream, toast, createPeer]);

  return { peers, isConnected };
}
