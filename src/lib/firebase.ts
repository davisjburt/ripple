
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, doc, setDoc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';


const firebaseConfig = {
  "projectId": "ripple-video-calling",
  "appId": "1:86590389569:web:f47a036c72d3f34ed1f5c0",
  "storageBucket": "ripple-video-calling.firebasestorage.app",
  "apiKey": "AIzaSyB-VZ4LPHQO9lZMR01E1ggU6Pc_UfNXyhM",
  "authDomain": "ripple-video-calling.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "86590389569"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

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
}


// Function to add a contact by email (sends a friend request)
export const addContact = async (fromUserId: string, toUserEmail: string) => {
    // 1. Find the user to add by their email (case-insensitive)
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

    // 2. Check if a request already exists
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


    // 3. Create a new friend request
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

    // Accept the request
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


    // Use a batch write to perform multiple operations atomically
    const batch = writeBatch(db);

    // Add each user to the other's contacts subcollection
    const fromContactRef = doc(db, 'users', from, 'contacts', to);
    batch.set(fromContactRef, toUserData);

    const toContactRef = doc(db, 'users', to, 'contacts', from);
    batch.set(toContactRef, fromUserData);

    // Update the request status to 'accepted'
    batch.update(requestRef, { status: 'accepted' });

    await batch.commit();
}


export { app, auth, db };
