'use client'; 

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import styles from './HlsPlayer.module.css';

const HlsPlayer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamUrl = 'http://localhost:3001/hls/stream.m3u8';

    useEffect(() => {
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
            if (hls) hls.destroy();
        };
    }, []);

    return (
        <div className={styles.playerContainer}>
            <div className={styles.liveBadge}>LIVE</div>
            <video 
                ref={videoRef} 
                className={styles.videoElement}
                muted // Keep 'muted' as it's required for autoplay in most browsers
                // Note that the 'controls' attribute has been removed
            />
        </div>
    );
};

export default HlsPlayer;