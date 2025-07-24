import * as mediasoup from "mediasoup";

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;


export const startMediasoupWorker = async () => {
    worker = await mediasoup.createWorker();

    worker.on('died', (error) => {
        console.error('mediasoup worker has died', error);
        process.exit(1);
    });

    router = await worker.createRouter({
        mediaCodecs: [ 
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000
            }
        ]
    });
};

export const getRouterRtpCapabilities = () => {
    if (!router) {
        throw new Error('Mediasoup router not initialized.');
    }
    return router.rtpCapabilities;
};