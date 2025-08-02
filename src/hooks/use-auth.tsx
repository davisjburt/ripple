
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';

// This is a placeholder for a real auth context.
// In a real app, this would be replaced with a library like Firebase Auth,
// NextAuth.js, or your own authentication logic.

interface AuthContextType {
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user data
    setTimeout(() => {
      setUser({
        displayName: 'Alex Norton',
        email: 'alex.norton@example.com',
        photoURL: `https://placehold.co/40x40/F0E9E9/333?text=AN`,
      });
      setLoading(false);
    }, 1000);
  }, []);

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
