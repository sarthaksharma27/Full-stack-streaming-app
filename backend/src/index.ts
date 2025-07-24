import express from "express";
import http from "http";
import { Server } from "socket.io";
import { startMediasoupWorker, getRouterRtpCapabilities, createWebRtcTransport, connectWebRtcTransport } from "./mediasoupServer.js";

const app = express();
const server = http.createServer(app);
import 'dotenv/config';
const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000', 
      methods: ['GET', 'POST']
    }
});


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

      socket.on('createSendTransport', async (callback) => {
        console.log('Browser requested to create a send transport');
        try {
          const transportParams = await createWebRtcTransport();
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

      socket.on('disconnect', () => {
        console.log(`user disconnected ${socket.id}`)
      });
  });


  server.listen(process.env.PORT, () => {
      console.log(`Server is listening on port ${process.env.PORT}`);
  });

}


main().catch((err) => {
  console.error("Failed to start main server:", err);
  process.exit(1);
});

