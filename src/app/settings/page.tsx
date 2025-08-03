
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, storage, auth } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Edit, User, Settings, Camera, Upload } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner';


export default function SettingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [newImage, setNewImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(user?.photoURL || null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewImage(file);
            setPreviewUrl(URL.createObjectURL(file));
            setIsDialogOpen(false); // Close dialog after selection
        }
    };

    const handleUpload = async () => {
        if (!newImage || !user) {
            toast({
                variant: 'destructive',
                title: 'No image selected',
                description: 'Please select an image file to upload.',
            });
            return;
        }

        setLoading(true);
        try {
            const storageRef = ref(storage, `profile-pics/${user.uid}`);
            const uploadResult = await uploadBytes(storageRef, newImage);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { photoURL: downloadURL });
            }
            
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { photoURL: downloadURL });
            
            setPreviewUrl(downloadURL);
            setNewImage(null);
            toast({
                title: 'Success',
                description: 'Your profile picture has been updated.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setLoading(false);
        }
    };


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
       <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Settings />
                <span>Settings</span>
            </CardTitle>
            <CardDescription>Manage your account and application settings.</CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
                 <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <User />
                                <span>Profile</span>
                            </CardTitle>
                             <CardDescription>This is how other users will see you on the site.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={previewUrl || ''} alt={user.displayName || 'User'} />
                                        <AvatarFallback className="text-3xl">
                                            {user.displayName?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                     <DialogTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="absolute bottom-0 right-0 rounded-full h-8 w-8 bg-background"
                                        >
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Change picture</span>
                                        </Button>
                                     </DialogTrigger>
                                     <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Change Profile Picture</DialogTitle>
                                            <DialogDescription>
                                                Choose a new photo from your files or take a new one.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Upload from files
                                            </Button>
                                            <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                                                <Camera className="mr-2 h-4 w-4" />
                                                Take a photo
                                            </Button>
                                        </div>
                                     </DialogContent>
                                    </Dialog>

                                    <Input 
                                        type="file" 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange}
                                        accept="image/png, image/jpeg, image/gif"
                                     />
                                     <Input
                                        type="file"
                                        className="hidden"
                                        ref={cameraInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        capture="environment"
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">{user.displayName}</h3>
                                    <p className="text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                            
                            {newImage && (
                                <div className="flex items-center gap-4 pt-4">
                                    <Button onClick={handleUpload} disabled={loading}>
                                        {loading ? <><Spinner size="icon" className="mr-2"/> Saving...</> : 'Save Changes'}
                                    </Button>
                                    <Button variant="ghost" onClick={() => {
                                        setNewImage(null);
                                        setPreviewUrl(user.photoURL);
                                    }} disabled={loading}>
                                        Cancel
                                    </Button>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                 </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
