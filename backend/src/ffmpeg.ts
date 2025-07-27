// In index.ts at the top level
import { spawn } from 'child_process';
import * as fs from 'fs';
import path from 'path';

export let ffmpegProcess: any = null;
const HLS_OUTPUT_DIR = './public/hls';

// In ffmpeg.ts
const generateSdpFile = () => {
    const sdp = `
v=0
o=- 0 0 IN IP4 127.0.0.1
s=FFmpeg
c=IN IP4 127.0.0.1
t=0 0
m=video 5004 RTP/AVP 101
a=rtpmap:101 VP8/90000
m=audio 5006 RTP/AVP 102
a=rtpmap:102 opus/48000/2
`;
    fs.writeFileSync('./ffmpeg.sdp', sdp);
};

export const startFfmpeg = () => {
    if (ffmpegProcess) {
        console.log('FFmpeg process is already running.');
        return;
    }

    fs.rmSync(HLS_OUTPUT_DIR, { recursive: true, force: true });

    fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
    
    generateSdpFile();
    
    // <-- 1. Define the options as a clean array.
    // In ffmpeg.ts

    // In ffmpeg.ts

const options = [
    // You can keep these for stability
    '-fflags', '+igndts',
    '-rtbufsize', '250M', 
    
    // Input
    '-protocol_whitelist', 'file,udp,rtp',
    '-i', 'ffmpeg.sdp',
    
    // Map streams
    '-map', '0:v:0',
    '-map', '0:a:0',

    // --- VIDEO RE-ENCODING SETTINGS ---
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    
    // --- ADD THIS LINE ---
    // Force a constant 30fps output framerate
    '-r', '30', 
    
    '-g', '60',

    // --- AUDIO SETTINGS ---
    '-c:a', 'copy',
    
    // --- HLS OUTPUT SETTINGS ---
    '-f', 'hls',
    '-hls_time', '10',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments',
    '-hls_playlist_type', 'event',
    path.join(HLS_OUTPUT_DIR, 'stream.m3u8')
];

    console.log(`Starting FFmpeg for testing with command: ffmpeg ${options.join(' ')}`);

    ffmpegProcess = spawn('ffmpeg', options);

    // This listener is important for seeing FFmpeg's own logs/errors
    ffmpegProcess.stderr.on('data', (data: any) => {
        console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpegProcess.on('error', (err: any) => console.error('FFmpeg process error:', err));
    ffmpegProcess.on('exit', (code: any) => {
        console.log(`FFmpeg exited with code ${code}`);
        ffmpegProcess = null; 
    });
};

