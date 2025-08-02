'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
       <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Settings />
                <span>Settings</span>
            </CardTitle>
            <CardDescription>Manage your account and application settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Settings page is under construction.</p>
          </CardContent>
        </Card>
    </div>
  );
}
