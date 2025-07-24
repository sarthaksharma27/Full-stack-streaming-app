import * as mediasoup from "mediasoup";

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

const transports = new Map<string, mediasoup.types.WebRtcTransport>();
const producers = new Map<string, mediasoup.types.Producer>();

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

export const createWebRtcTransport = async () => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });
  
    transports.set(transport.id, transport);
  
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  };

  export const connectWebRtcTransport = async (transportId: string, dtlsParameters: mediasoup.types.DtlsParameters) => {
    const transport = transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport with id "${transportId}" not found`);
    }
    await transport.connect({ dtlsParameters });
  };

  export const createProducer = async (transportId: string, rtpParameters: mediasoup.types.RtpParameters, kind: mediasoup.types.MediaKind) => {
    const transport = transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
  
    const producer = await transport.produce({ kind, rtpParameters });
    producers.set(producer.id, producer);
    
    console.log("Server-side producer created with ID:", producer.id);
    
    return producer.id;
  };
