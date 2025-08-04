
'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface VideoControlsProps {
    isCameraOn: boolean;
    onCameraToggle: () => void;
    isMicOn: boolean;
    onMicToggle: () => void;
    onLeave: () => void;
}

export function VideoControls({ isCameraOn, onCameraToggle, isMicOn, onMicToggle, onLeave }: VideoControlsProps) {
  const router = useRouter();
  
  const handleLeave = () => {
    onLeave();
    router.push('/');
  }

  const controls = [
    {
      label: isMicOn ? 'Mute' : 'Unmute',
      icon: isMicOn ? <Mic /> : <MicOff className="text-red-500"/>,
      onClick: onMicToggle,
      isActive: isMicOn,
    },
    {
      label: isCameraOn ? 'Turn off camera' : 'Turn on camera',
      icon: isCameraOn ? <Video /> : <VideoOff className="text-red-500" />,
      onClick: onCameraToggle,
      isActive: isCameraOn,
    },
    {
      label: 'Share screen',
      icon: <ScreenShare />,
      onClick: () => {}, // TODO: Implement screen sharing
    },
    {
      label: 'Show chat',
      icon: <MessageSquare />,
      onClick: () => {}, // This would likely toggle a state in the parent
    },
  ];

  return (
    <TooltipProvider>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
        className="flex items-center gap-2 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/20 shadow-2xl"
      >
        {controls.map((control, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={control.onClick}
                className={`w-14 h-14 rounded-full text-white hover:bg-white/10 ${control.isActive === false ? 'bg-white/10' : ''}`}
              >
                {control.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-black/80 text-white border-none">
              <p>{control.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="w-px h-8 bg-white/20 mx-2" />

        <Tooltip>
          <TooltipTrigger asChild>
              <Button
                onClick={handleLeave}
                size="icon"
                className="w-16 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
              >
                <PhoneOff />
              </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-black/80 text-white border-none">
            <p>Leave call</p>
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  );
}
