import express from "express";
import http from "http";
import { Server } from "socket.io";

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

io.on('connection', (socket) => {
    console.log(`user connected ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`user disconnected ${socket.id}`)
    });
});

server.listen(process.env.PORT, () => {
    console.log(`Server is listening on port ${process.env.PORT}`);
});
