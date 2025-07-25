import * as mediasoup from "mediasoup";
import { Server as SocketIOServer, Socket } from "socket.io";

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

export const transports = new Map<string, mediasoup.types.WebRtcTransport>();
export const producers = new Map<string, mediasoup.types.Producer>();
export const consumers = new Map();


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
};

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

  export const createProducer = async ( socket: Socket, transportId: string,
    rtpParameters: mediasoup.types.RtpParameters, kind: mediasoup.types.MediaKind ) => {
    const transport = transports.get(transportId);
    if (!transport) throw new Error("Transport not found");
  
    const producer = await transport.produce({ kind, rtpParameters, appData: { socketId: socket.id }, });
    producers.set(producer.id, producer);

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
