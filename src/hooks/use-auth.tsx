
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Spinner } from '@/components/ui/spinner';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        
        // Use onSnapshot to listen for real-time updates to the user document
        const unsubscribeFirestore = onSnapshot(userDocRef, async (userDocSnap) => {
          if (!userDocSnap.exists()) {
            // User exists in Auth but not in Firestore, let's sync them.
            const photoURL = authUser.photoURL || `https://placehold.co/100x100/E9E9F0/333?text=${authUser.displayName?.charAt(0) || 'U'}`;
            try {
              await setDoc(userDocRef, {
                uid: authUser.uid,
                displayName: authUser.displayName,
                email: authUser.email?.toLowerCase(),
                photoURL: photoURL,
              });
            } catch (error) {
              console.error("Error syncing user to Firestore:", error);
            }
          } else {
             // User exists, merge authUser data with Firestore data
             // This keeps the local user state in sync with both sources
              const firestoreData = userDocSnap.data();
              const combinedUser = {
                ...authUser,
                ...firestoreData, // Firestore data (like photoURL) overrides auth data if present
              };
              setUser(combinedUser as User);
          }
        });

        // Set initial user data while waiting for Firestore snapshot
        setUser(authUser);
        setLoading(false);
        
        return () => unsubscribeFirestore(); // Cleanup Firestore listener
      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';
    
    if (!user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);


  if (loading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Spinner size="large" />
        </div>
    );
  }

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
