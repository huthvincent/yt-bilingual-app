import React, { useEffect, useRef, useState } from 'react';
import type { YouTubeProps } from 'react-youtube';
import YouTube from 'react-youtube';
import { Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
    videoId: string;
    onTimeUpdate: (time: number) => void;
    seekCommand?: { time: number; timestamp: number } | null;
    wrapperRef?: React.RefObject<HTMLDivElement | null>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onTimeUpdate, seekCommand, wrapperRef }) => {
    const playerRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Watch for seek commands
    useEffect(() => {
        if (seekCommand && playerRef.current) {
            try {
                // target directly exposes YouTube Player API
                playerRef.current.seekTo(seekCommand.time, true);
                if (!isPlaying) {
                    playerRef.current.playVideo();
                }
            } catch (err) {
                console.error("Seek error:", err);
            }
        }
    }, [seekCommand]);

    // Poll for the current time only when playing
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying && playerRef.current) {
            interval = setInterval(async () => {
                try {
                    const time = await playerRef.current.getCurrentTime();
                    onTimeUpdate(time);
                } catch (err) {
                    // Ignore
                }
            }, 100); // 100ms for smooth highlighting
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, onTimeUpdate]);

    const onReady: YouTubeProps['onReady'] = (event) => {
        playerRef.current = event.target;
        if (seekCommand) {
            event.target.seekTo(seekCommand.time, true);
        }
        event.target.playVideo();
    };

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        // PlayerState.PLAYING = 1
        setIsPlaying(event.data === 1);
    };

    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            wrapperRef?.current?.requestFullscreen?.().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen?.();
        }
    };

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0
        },
    };

    return (
        <div className="w-full h-full bg-black relative">
            <div className="absolute inset-x-0 inset-y-0 p-4 group/video">
                <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
                    <YouTube
                        videoId={videoId}
                        opts={opts}
                        onReady={onReady}
                        onStateChange={onStateChange}
                        className="w-full h-full"
                        iframeClassName="w-full h-full pointer-events-auto"
                    />
                    
                    {wrapperRef && (
                        <button
                            onClick={toggleFullscreen}
                            className="absolute bottom-4 right-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md opacity-0 group-hover/video:opacity-100 transition-opacity flex items-center gap-2 z-50 pointer-events-auto"
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
