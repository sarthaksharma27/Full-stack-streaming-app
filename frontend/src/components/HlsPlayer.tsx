// components/HlsPlayer.tsx
'use client'; 

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const HlsPlayer: React.FC = () => {
    // Type the ref to be an HTMLVideoElement
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamUrl = 'http://localhost:3001/hls/stream.m3u8';

    useEffect(() => {
        // Type the HLS instance
        let hls: Hls | null = null;

        const videoElement = videoRef.current;
        if (!videoElement) return;

        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoElement.play();
            });
        } 
        else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = streamUrl;
            videoElement.addEventListener('loadedmetadata', () => {
                videoElement.play();
            });
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };

    }, []);

    return (
        <video 
            ref={videoRef} 
            controls 
            muted 
            style={{ width: '100%', maxWidth: '800px' }} 
        />
    );
};

export default HlsPlayer;