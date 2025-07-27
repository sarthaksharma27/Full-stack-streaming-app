import express from "express";
import http from "http";
import { Server } from "socket.io";
import { startMediasoupWorker, getRouterRtpCapabilities, createWebRtcTransport, connectWebRtcTransport, 
  createProducer, producers,  
  closeProducer,
  transports,
  createConsumer,
  resumeConsumer} from "./mediasoupServer.js";
  import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
import 'dotenv/config';
const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000', 
      methods: ['GET', 'POST']
    }
});

app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from your Next.js frontend
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, '..', 'public');
console.log(`✅ Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));


app.get('/', (req, res) => {
  res.send('Hello from server!')
})

async function main() {
  await startMediasoupWorker();

  io.on('connection', (socket) => {
      socket.join('stream-room');

      console.log(`user connected ${socket.id}`)

      socket.to("stream-room").emit("user-joined", {
        message: `${socket.id} Joined the room`,
        socketId: socket.id
      });

      try {
        socket.emit('routerRtpCapabilities', getRouterRtpCapabilities());
      } catch (error) {
        console.error('Failed to get RTP Capabilities:', error);
        socket.emit('error', 'Router not ready');
      }

      socket.on('get-producers', (callback) => {
        const producerIds = Array.from(producers.keys());
        console.log(`Sending existing producer ids to ${socket.id}:`, producerIds);
        socket.emit('existing-producers', { producerIds });
    });

      socket.on('createSendTransport', async (callback) => {
        console.log('Browser requested to create a send transport');
        try {
          const transportParams = await createWebRtcTransport({socketId: socket.id});
          callback(transportParams);
        } catch (error) {
          console.error('Failed to create transport:', error);
          callback({ error: error });
        }
      });

      socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
        console.log("Received DTLS parameters from client. Connecting transport");
        await connectWebRtcTransport(transportId, dtlsParameters);
        callback();
      });

      socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
        const producerId = await createProducer(socket, transportId, rtpParameters, kind);
        callback({ id: producerId });
      });

      socket.on('create-recv-transport', async (callback) => {
        console.log(`Request from ${socket.id} to create a recv transport`);
        try {
            const transportParams = await createWebRtcTransport({ socketId: socket.id });
            callback(transportParams);
        } catch (error) {
            console.error('Failed to create recv transport:', error);
            callback({ error: (error as Error).message });
        }
      });

      socket.on('connect-recv-transport', async ({ transportId, dtlsParameters }, callback) => {
        console.log(`Request from ${socket.id} to connect a recv transport`);
        await connectWebRtcTransport(transportId, dtlsParameters);
        callback();
      });

      socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
        try {
            const params = await createConsumer(transportId, producerId, rtpCapabilities);
            callback(params);
        } catch (err: any) {
            console.error('Failed to create consumer:', err.message);
            callback({ error: err.message });
        }
      });

      socket.on('resume-consumer', async ({ consumerId }) => {
        // Call the function from the mediasoupServer file
        await resumeConsumer({ consumerId });
      });

      async function rmTrasport() {
        for (const transport of transports.values()) {
          if (transport.appData.socketId === socket.id) {
              transport.close();
              transports.delete(transport.id);
              console.log(`Cleaned up transport ${transport.id} for disconnecting socket ${socket.id}`);
          }
        }
      }

      async function rmProducer() {
        for (const producer of producers.values()) {
          if (producer.appData.socketId === socket.id) {
              closeProducer({ io, producerId: producer.id });
          }
        }
      }

      socket.on('disconnect', () => {
        console.log(`user disconnected ${socket.id}`)
         rmProducer()
         rmTrasport()
      });
  });

}

main().catch((err) => {
  console.error("Failed to start main server:", err);
  process.exit(1);
});


server.listen(process.env.PORT, () => {
  console.log(`Server is listening on port ${process.env.PORT}`);
});



