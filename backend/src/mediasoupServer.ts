import * as mediasoup from "mediasoup";
import { Server as SocketIOServer, Socket } from "socket.io";
import { ffmpegProcess, startFfmpeg } from "./ffmpeg.js";

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

let videoPlainTransport: mediasoup.types.PlainTransport;
let audioPlainTransport: mediasoup.types.PlainTransport;
let videoPlainTransport2: mediasoup.types.PlainTransport;
let audioPlainTransport2: mediasoup.types.PlainTransport;

export const transports = new Map<string, mediasoup.types.WebRtcTransport>();
export const producers = new Map<string, mediasoup.types.Producer>();
export const consumers = new Map();
const videoProducersForHls = new Map();
const ffmpegConsumers = new Map<string, mediasoup.types.Consumer>();

const ffmpegRtpConfig = {
  ip: '127.0.0.1',
  videoPort: 5004,
  videoRtcpPort: 5005,
  audioPort: 5006,
  audioRtcpPort: 5007,
  videoPort2: 5008,
  videoRtcpPort2: 5009,
  audioPort2: 5010,
  audioRtcpPort2: 5011,
};


export const startMediasoupWorker = async () => {
    
    const workerSettings: mediasoup.types.WorkerSettings = {
      rtcMinPort: 20000,
      rtcMaxPort: 20100,
      logLevel: 'warn',
      logTags: [],
    };

    worker = await mediasoup.createWorker(workerSettings);

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

   videoPlainTransport = await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1' },
        rtcpMux: false,
    });
    await videoPlainTransport.connect({
        ip: ffmpegRtpConfig.ip,
        port: ffmpegRtpConfig.videoPort,
        rtcpPort: ffmpegRtpConfig.videoRtcpPort
    });
    console.log(`Mediasoup PlainTransport for VIDEO connected to RTP port ${ffmpegRtpConfig.videoPort} and RTCP port ${ffmpegRtpConfig.videoRtcpPort}`);

    audioPlainTransport = await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1' },
        rtcpMux: false,
    });
    await audioPlainTransport.connect({
        ip: ffmpegRtpConfig.ip,
        port: ffmpegRtpConfig.audioPort,
        rtcpPort: ffmpegRtpConfig.audioRtcpPort
    });
    console.log(`Mediasoup PlainTransport for AUDIO connected to RTP port ${ffmpegRtpConfig.audioPort} and RTCP port ${ffmpegRtpConfig.audioRtcpPort}`);

    // for second producer

    videoPlainTransport2 = await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1' },
        rtcpMux: false,
    });
    await videoPlainTransport2.connect({
        ip: ffmpegRtpConfig.ip,
        port: ffmpegRtpConfig.videoPort2,
        rtcpPort: ffmpegRtpConfig.videoRtcpPort2
    });
    console.log(`Mediasoup PlainTransport for VIDEO connected to RTP port ${ffmpegRtpConfig.videoPort2} and RTCP port ${ffmpegRtpConfig.videoRtcpPort2}`);

    audioPlainTransport2 = await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1' },
        rtcpMux: false,
    });
    await audioPlainTransport2.connect({
        ip: ffmpegRtpConfig.ip,
        port: ffmpegRtpConfig.audioPort2,
        rtcpPort: ffmpegRtpConfig.audioRtcpPort2
    });
    console.log(`Mediasoup PlainTransport for AUDIO connected to RTP port ${ffmpegRtpConfig.audioPort2} and RTCP port ${ffmpegRtpConfig.audioRtcpPort2}`);
};

async function startHlsComposition() {
    const [producer1, producer2] = Array.from(videoProducersForHls.values());

    if (!producer1 || !producer2) {
        console.error("Composition started with fewer than two video producers.");
        return;
    }

    // const audioProducer1 = Array.from(producers.values()).find(p => p.appData.socketId === producer1.appData.socketId && p.kind === 'audio');
    // const audioProducer2 = Array.from(producers.values()).find(p => p.appData.socketId === producer2.appData.socketId && p.kind === 'audio');

    // if (!audioProducer1 || !audioProducer2) {
    //     console.error("Could not find matching audio producers for both video producers.");
    //     videoProducersForHls.clear();
    //     return;
    // }

    const videoConsumer1 = await videoPlainTransport.consume({
        producerId: producer1.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: true 
    });
    // const audioConsumer1 = await audioPlainTransport.consume({
    //     producerId: audioProducer1.id,
    //     rtpCapabilities: router.rtpCapabilities,
    // });

    ffmpegConsumers.set(videoConsumer1.id, videoConsumer1);
    // ffmpegConsumers.set(audioConsumer1.id, audioConsumer1);
    // console.log(`Piping User 1 (video: ${producer1.id}, audio: ${audioProducer1.id})`);
    console.log(`Piping User 1 (video: ${producer1.id}})`);

    const videoConsumer2 = await videoPlainTransport2.consume({
        producerId: producer2.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: true 
    });
    // const audioConsumer2 = await audioPlainTransport2.consume({
    //     producerId: audioProducer2.id,
    //     rtpCapabilities: router.rtpCapabilities,
    // });
    ffmpegConsumers.set(videoConsumer2.id, videoConsumer2);
    // ffmpegConsumers.set(audioConsumer2.id, audioConsumer2);
    // console.log(`Piping User 2 (video: ${producer2.id}, audio: ${audioProducer2.id})`);
    console.log(`Piping User 2 (video: ${producer2.id}})`);

    const rtpConfigs = {
        producer1: { videoPort: ffmpegRtpConfig.videoPort, audioPort: ffmpegRtpConfig.audioPort },
        producer2: { videoPort: ffmpegRtpConfig.videoPort2, audioPort: ffmpegRtpConfig.audioPort2 },
    };

    startFfmpeg(rtpConfigs);

    await new Promise(resolve => setTimeout(resolve, 1000));
    await videoConsumer1.requestKeyFrame();
    await videoConsumer2.requestKeyFrame();
    console.log("Keyframes requested from both video consumers.");

    await videoConsumer1.resume();
    await videoConsumer2.resume();
    console.log("Resumed both video consumers. HLS stream should start cleanly.");
}


export const getRouterRtpCapabilities = () => {
    if (!router) {
        throw new Error('Mediasoup router not initialized.');
    }
    return router.rtpCapabilities;
};

export const createWebRtcTransport = async ({ socketId }: { socketId: string }) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,

      appData: { socketId },
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

  export const createProducer = async (
    socket: Socket,
    transportId: string,
    rtpParameters: mediasoup.types.RtpParameters,
    kind: mediasoup.types.MediaKind
) => {
    const transport = transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { socketId: socket.id },
    });
    producers.set(producer.id, producer);

    if (kind === 'video') {
        videoProducersForHls.set(producer.id, producer);

        if (videoProducersForHls.size === 2) {
            console.log("Trigger condition met. Starting composition...");
            startHlsComposition();
        }
    }

    
    socket.broadcast.to('stream-room').emit('new-producer', { producerId: producer.id });
    
    console.log(`Producer ${producer.id} created by socket ${socket.id}`);
    
    return producer.id;
};

  export const createConsumer = async (
      transportId: string,
      producerId: string,
      rtpCapabilities: mediasoup.types.RtpCapabilities
  ) => {
      const transport = transports.get(transportId);
      if (!transport) {
          throw new Error(`Transport with id "${transportId}" not found`);
      }

      if (!router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('Router cannot consume this producer');
      }
      
      const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
      });

      consumers.set(consumer.id, consumer);

      consumer.on('producerclose', () => {
        console.log(`Consumer ${consumer.id} closed on Server because its producer closed`);
        consumers.delete(consumer.id);
     }); // (i can add later for more robust cleanup if need not required now i am assuming)
      
      return {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
  };

  export const resumeConsumer = async ({ consumerId }: { consumerId: string }) => {
    const consumer = consumers.get(consumerId);

    if (consumer) {
        console.log(`Resuming consumer ${consumerId}`);
        await consumer.resume();
    } else {
        console.warn(`resumeConsumer: Consumer with id "${consumerId}" not found.`);
    }
  };

  export const closeProducer = async ({ io, producerId }: { io: SocketIOServer; producerId: string; }) => {
    const producer = producers.get(producerId);
    if (!producer) {
        console.warn(`closeProducer: Producer with id "${producerId}" not found.`);
        return;
    }
    await producer.close();

    producers.delete(producerId);

    io.to('stream-room').emit('producer-closed', { producerId });

    console.log(`Producer ${producerId} closed and cleaned up.`);
};

  export const rmProducer = async (myProducerId: string) => {
    if (producers.has(myProducerId)) {
      producers.delete(myProducerId);
    }
    console.log("removing producer", myProducerId);
  }
