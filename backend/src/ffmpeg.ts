import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import path from 'path';

export let ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
const HLS_OUTPUT_DIR = './public/hls';

interface RtpConfig {
    videoPort: number;
    audioPort: number;
}

// MODIFIED FUNCTION: Generates an SDP file for VIDEO ONLY because on my machine
const generateSdpFile = (fileName: string, rtpConfig: RtpConfig) => {
    const sdp = `
v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg
c=IN IP4 127.0.0.1
t=0 0
m=video ${rtpConfig.videoPort} RTP/AVP 101
a=rtpmap:101 VP8/90000
`;
// -- AUDIO LINES REMOVED --
// m=audio ${rtpConfig.audioPort} RTP/AVP 102
// a=rtpmap:102 opus/48000/2

    fs.writeFileSync(fileName, sdp);
    console.log(`Generated VIDEO-ONLY SDP file: ${fileName}`);
};

// --- MODIFIED: Builds the composite command for VIDEO ONLY
export const startFfmpeg = (rtpConfigs: { producer1: RtpConfig, producer2: RtpConfig }) => {
    if (ffmpegProcess) {
        console.warn('FFmpeg process is already running.');
        return;
    }

    fs.rmSync(HLS_OUTPUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });

    generateSdpFile('./ffmpeg1.sdp', rtpConfigs.producer1);
    generateSdpFile('./ffmpeg2.sdp', rtpConfigs.producer2);

    // --- REWRITTEN FFMPEG OPTIONS for VIDEO ONLY ---
    const options = [
        '-analyzeduration', '20M',
        '-probesize', '20M',
        // Inputs
        '-protocol_whitelist', 'file,udp,rtp', '-i', 'ffmpeg1.sdp',
        '-protocol_whitelist', 'file,udp,rtp', '-i', 'ffmpeg2.sdp',

        // Video-only filter complex
        '-filter_complex',
        '[0:v]scale=640:720,setdar=9/16[left];' +
        '[1:v]scale=640:720,setdar=9/16[right];' +
        '[left][right]hstack=inputs=2[v]',

        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-r', '24',
        '-g', '48',

        // Explicitly disable audio processing 
        '-an',

        // HLS output settings
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '5',
        '-hls_flags', 'delete_segments',
        '-hls_playlist_type', 'event',
        path.join(HLS_OUTPUT_DIR, 'stream.m3u8')
    ];

    console.log(`Starting FFmpeg with VIDEO-ONLY command: ffmpeg ${options.join(' ')}`);

    ffmpegProcess = spawn('ffmpeg', options);

    ffmpegProcess.stderr.on('data', (data: any) => {
        const dataStr = data.toString();
        if (!dataStr.includes('Last message repeated')) {
            console.error(`FFmpeg stderr: ${dataStr}`);
        }
    });

    ffmpegProcess.on('error', (err: any) => console.error('FFmpeg process error:', err));
    ffmpegProcess.on('exit', (code: any, signal: any) => {
        console.log(`FFmpeg exited with code ${code} and signal ${signal}`);
        ffmpegProcess = null;
        fs.rmSync(HLS_OUTPUT_DIR, { recursive: true, force: true });
    });
};

export const stopFfmpeg = () => {
    if (ffmpegProcess) {
        console.log("Stopping FFmpeg process...");
        ffmpegProcess.kill('SIGINT');
        ffmpegProcess = null;
    }
};