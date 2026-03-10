
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Spinner } from '../components/ui/spinner';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Combine Firebase Auth user with our custom Firestore user data
type User = FirebaseAuthUser & {
    // any custom fields from Firestore would go here
};

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
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        
        const unsubscribeFirestore = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            setUser({ ...authUser, ...firestoreData } as User);
          } else {
             // This case might happen on first sign-in via a provider if doc creation is slow
             // Or if the user document was manually deleted. We can re-create it.
            const photoURL = authUser.photoURL || `https://placehold.co/100x100/E9E9F0/333?text=${authUser.displayName?.charAt(0) || 'U'}`;
            const newUser = {
              uid: authUser.uid,
              displayName: authUser.displayName,
              email: authUser.email?.toLowerCase(),
              photoURL: photoURL,
            };
            await setDoc(userDocRef, newUser, { merge: true });
            // The snapshot listener will be called again with the new data, setting the user.
          }
          setLoading(false); // Ensure loading is false after we have user data.
        }, (error) => {
            console.error("Error with Firestore snapshot: ", error);
            setLoading(false); // Also handle loading state on error
        });
        
        return () => unsubscribeFirestore();

      } else {
        // User is signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
