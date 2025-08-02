
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/');
        } catch (error: any) {
             toast({
                title: "Login failed",
                description: error.message || "An unexpected error occurred.",
                variant: 'destructive'
            })
        } finally {
            setLoading(false);
        }
    };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-background/80 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
                <Video className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">Ripple</h1>
            </div>
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to continue to your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSignIn}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required/>
            </div>
            <div className="space-y-2">
                <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    <Link href="#" className="ml-auto inline-block text-sm underline">
                        Forgot your password?
                    </Link>
                </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required/>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            <div className="text-center text-sm">
                Don't have an account?{' '}
                <Link href="/signup" className="underline">
                    Sign up
                </Link>
            </div>
          </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
