

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, writeBatch, getDoc, updateDoc, collectionGroup, onSnapshot, Unsubscribe, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  "projectId": "ripple-video-calling",
  "appId": "1:86590389569:web:f47a036c72d3f34ed1f5c0",
  "storageBucket": "ripple-video-calling.appspot.com",
  "apiKey": "AIzaSyB-VZ4LPHQO9lZMR01E1ggU6Pc_UfNXyhM",
  "authDomain": "ripple-video-calling.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "86590389569"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export interface User {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface FriendRequest {
    id: string;
    from: string;
    fromName: string;
    fromEmail: string;
    fromPhotoURL: string;
    to: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: any;
}

export interface ChatRoom {
  id: string;
  otherUser: {
    id: string;
    displayName: string;
    photoURL: string;
  };
}

export interface Call {
    id: string;
    type: 'direct' | 'instant';
    caller: {
        id: string;
        name: string;
        photoURL: string;
    };
    receiver?: {
        id: string;
        name: string;
        photoURL: string;
    };
    status: 'ringing' | 'answered' | 'declined' | 'missed' | 'active' | 'ended';
    createdAt: any;
    offer?: any;
    answer?: any;
}


// Function to add a contact by email (sends a friend request)
export const addContact = async (fromUserId: string, toUserEmail: string) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", toUserEmail.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return { success: false, message: "User not found." };
    }
    
    const toUser = querySnapshot.docs[0].data() as User;
    const toUserId = querySnapshot.docs[0].id;

    if(fromUserId === toUserId) {
        return { success: false, message: "You cannot add yourself." };
    }
    
    const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
    if(!fromUserDoc.exists()) {
       return { success: false, message: "Could not find your user profile." };
    }
    const fromUser = fromUserDoc.data() as User;

    const requestsRef = collection(db, 'friendRequests');
    const existingRequestQuery = query(requestsRef, 
        where('from', 'in', [fromUserId, toUserId]),
        where('to', 'in', [fromUserId, toUserId])
    );
    const existingRequestSnapshot = await getDocs(existingRequestQuery);
    if (!existingRequestSnapshot.empty) {
        const existingRequest = existingRequestSnapshot.docs[0].data();
        if (existingRequest.status === 'pending') {
            return { success: false, message: "A friend request is already pending." };
        }
         if (existingRequest.status === 'accepted') {
            return { success: false, message: "This user is already a contact." };
        }
    }

    await addDoc(requestsRef, {
        from: fromUserId,
        fromName: fromUser.displayName,
        fromEmail: fromUser.email,
        fromPhotoURL: fromUser.photoURL,
        to: toUserId,
        status: 'pending',
        createdAt: serverTimestamp()
    });

    return { success: true, message: "Friend request sent successfully." };
};


// Function to get a user's contacts (friends)
export const getContacts = (userId: string) => {
    const contactsRef = collection(db, 'users', userId, 'contacts');
    return query(contactsRef);
};


// Function to get pending friend requests for a user
export const getFriendRequests = (userId: string) => {
    const requestsRef = collection(db, 'friendRequests');
    return query(requestsRef, where('to', '==', userId), where('status', '==', 'pending'));
}


// Function to accept or decline a friend request
export const handleFriendRequest = async (requestId: string, accept: boolean) => {
    const requestRef = doc(db, 'friendRequests', requestId);

    if (!accept) {
        await updateDoc(requestRef, { status: 'declined' });
        return;
    }

    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found.");
    
    const requestData = requestDoc.data() as FriendRequest;
    const { from, to } = requestData;

    const fromUserDoc = await getDoc(doc(db, 'users', from));
    const toUserDoc = await getDoc(doc(db, 'users', to));

    if (!fromUserDoc.exists() || !toUserDoc.exists()) {
        throw new Error("One or both users not found.");
    }
    
    const fromUserData = { ...fromUserDoc.data(), id: fromUserDoc.id };
    const toUserData = { ...toUserDoc.data(), id: toUserDoc.id };


    const batch = writeBatch(db);

    const fromContactRef = doc(db, 'users', from, 'contacts', to);
    batch.set(fromContactRef, toUserData);

    const toContactRef = doc(db, 'users', to, 'contacts', from);
    batch.set(toContactRef, fromUserData);

    batch.update(requestRef, { status: 'accepted' });

    await batch.commit();
}

// Function to get a user's chat rooms
export const getChatRooms = (userId: string, callback: (rooms: ChatRoom[]) => void): Unsubscribe => {
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(chatsQuery, (querySnapshot) => {
      const rooms: ChatRoom[] = querySnapshot.docs.map(docSnap => {
          const chatData = docSnap.data();
          const otherUserId = chatData.participants.find((p: string) => p !== userId);
          const otherUser = chatData.users?.[otherUserId] || { id: otherUserId, displayName: 'Unknown User', photoURL: '' };

          return {
            id: docSnap.id,
            otherUser: otherUser,
          };
        }).filter(room => room.otherUser.id); // Filter out rooms where other user is not found

      callback(rooms);
    }, (error) => {
        console.error("Error fetching chat rooms: ", error);
        callback([]);
    });

    return unsubscribe;
};

// --- Call Signaling Functions ---

export const startCall = async (caller: User, receiver: User) => {
    const callDocRef = doc(collection(db, 'calls'));
    await setDoc(callDocRef, {
        type: 'direct',
        caller: {
            id: caller.uid,
            name: caller.displayName,
            photoURL: caller.photoURL,
        },
        receiver: {
            id: receiver.id,
            name: receiver.displayName,
            photoURL: receiver.photoURL
        },
        status: 'ringing',
        createdAt: serverTimestamp(),
    });

    return callDocRef.id;
}


export const onIncomingCall = (userId: string, callback: (call: Call | null) => void) => {
    const invitationsQuery = query(
        collection(db, 'calls'),
        where('receiver.id', '==', userId),
        where('status', '==', 'ringing'),
        orderBy('createdAt', 'desc'),
        limit(1)
    );

    return onSnapshot(invitationsQuery, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
            return;
        }
        const ringingCallDoc = snapshot.docs[0];
        const ringingCall = { id: ringingCallDoc.id, ...ringingCallDoc.data() } as Call;
        callback(ringingCall);
    }, (error) => {
        console.error("Error listening for incoming calls:", error);
        callback(null);
    });
};

export const answerCall = async (callId: string) => {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, { status: 'answered' });
};

export const declineOrEndCall = async (callId: string) => {
    try {
        const callRef = doc(db, 'calls', callId);
        const callSnap = await getDoc(callRef);
        if(callSnap.exists()){
            // Update status to allow the other user to know the call was declined/ended
            await updateDoc(callRef, { status: 'declined' });
            // The caller/receiver will then call leaveCall to do the full cleanup.
        }
    } catch (error) {
        console.error("Error declining call: ", error);
    }
};

export const leaveCall = async (callId: string) => {
     try {
        const callRef = doc(db, 'calls', callId);
        const callSnap = await getDoc(callRef);

        if(callSnap.exists()){
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
        console.error("Error leaving call and cleaning up: ", error);
    }
}


export { app, auth, db, storage };
