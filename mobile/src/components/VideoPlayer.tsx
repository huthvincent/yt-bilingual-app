import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { colors, borderRadius } from '../theme';

interface VideoPlayerProps {
  videoId: string;
  onTimeUpdate: (time: number) => void;
  seekCommand?: { time: number; timestamp: number } | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  onTimeUpdate,
  seekCommand,
}) => {
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Watch for seek commands
  useEffect(() => {
    if (seekCommand && playerRef.current) {
      playerRef.current.seekTo(seekCommand.time, true);
      if (!isPlaying) {
        setIsPlaying(true);
      }
    }
  }, [seekCommand]);

  // Poll for current time when playing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && playerRef.current) {
      interval = setInterval(async () => {
        try {
          const time = await playerRef.current.getCurrentTime();
          onTimeUpdate(time);
        } catch {
          // Ignore
        }
      }, 200); // 200ms for smooth highlighting on mobile
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, onTimeUpdate]);

  const onStateChange = useCallback((state: string) => {
    if (state === 'playing') {
      setIsPlaying(true);
    } else if (state === 'paused' || state === 'ended') {
      setIsPlaying(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.playerWrapper}>
        <YoutubePlayer
          ref={playerRef}
          height={220}
          videoId={videoId}
          play={isPlaying}
          onChangeState={onStateChange}
          webViewProps={{
            allowsInlineMediaPlayback: true,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    width: '100%',
  },
  playerWrapper: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginVertical: 4,
  },
});
