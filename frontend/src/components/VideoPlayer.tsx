import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { YouTubeProps } from 'react-youtube';
import YouTube from 'react-youtube';

interface VideoPlayerProps {
    videoId: string;
    onTimeUpdate: (time: number) => void;
    seekCommand?: { time: number; timestamp: number } | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onTimeUpdate, seekCommand }) => {
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
        // Start polling immediately if it autoplays
        event.target.playVideo();
    };

    const onStateChange: YouTubeProps['onStateChange'] = (event) => {
        // PlayerState.PLAYING = 1
        setIsPlaying(event.data === 1);
    };

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1
        },
    };

    return (
        <div className="w-full h-full bg-black relative">
            <div className="absolute inset-x-0 inset-y-0 p-4">
                <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                    <YouTube
                        videoId={videoId}
                        opts={opts}
                        onReady={onReady}
                        onStateChange={onStateChange}
                        className="w-full h-full"
                        iframeClassName="w-full h-full"
                    />
                </div>
            </div>
        </div>
    );
};
