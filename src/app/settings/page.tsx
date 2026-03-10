
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import { db, storage, auth } from '../../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Edit, User, Settings, Camera, Upload } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Spinner } from '../../components/ui/spinner';


export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (user?.photoURL && !newImageFile) {
            setPreviewUrl(user.photoURL);
        }
    }, [user, newImageFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setIsDialogOpen(false); // Close dialog after selection
        }
    };

    const handleUpload = async () => {
        if (!newImageFile || !user || !auth.currentUser) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No image selected or user not logged in.',
            });
            return;
        }

        setIsUploading(true);
        try {
            // 1. Upload to Storage
            const storageRef = ref(storage, `profile-pics/${user.uid}`);
            const uploadResult = await uploadBytes(storageRef, newImageFile);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            // 2. Update Auth profile
            await updateProfile(auth.currentUser, { photoURL: downloadURL });
            
            // 3. Update Firestore document
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { photoURL: downloadURL });
            
            // 4. Update UI immediately
            setNewImageFile(null);
            
            toast({
                title: 'Success',
                description: 'Your profile picture has been updated.',
            });
        } catch (error: any) {
            console.error("Upload failed:", error);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error.message || 'An unexpected error occurred.',
            });
             // If upload fails, revert preview to the original photoURL
            setPreviewUrl(user.photoURL || null);
        } finally {
            setIsUploading(false);
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
            {authLoading && <Spinner />}
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
                            <div className="flex flex-col sm:flex-row items-center gap-4">
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
                                <div className="text-center sm:text-left">
                                    <h3 className="text-lg font-semibold">{user.displayName}</h3>
                                    <p className="text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                            
                            {newImageFile && (
                                <div className="flex items-center gap-4 pt-4">
                                    <Button onClick={handleUpload} disabled={isUploading}>
                                        {isUploading ? <><Spinner size="icon" className="mr-2"/> Saving...</> : 'Save Changes'}
                                    </Button>
                                    <Button variant="ghost" onClick={() => {
                                        setNewImageFile(null);
                                        setPreviewUrl(user.photoURL || null);
                                    }} disabled={isUploading}>
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
