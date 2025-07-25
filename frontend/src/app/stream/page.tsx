"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from 'mediasoup-client';
import { types } from 'mediasoup-client';


let device: types.Device;
let sendTransport: types.Transport;
let recvTransport;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export default function StreamPage() {

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("user-joined", (data) => {
      console.log(data.message);
    });

    socket.on("routerRtpCapabilities", async (routerRtpCapabilities: types.RtpCapabilities) => {
      console.log('Recived Router RTP Capabilities from server:', routerRtpCapabilities);
      try {
        device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities });
        console.log('Mediasoup Device loaded successfully:', device.rtpCapabilities);
        
        socket.emit('createSendTransport', (transportParams: types.TransportOptions) => {
          console.log('Received transport from server:', transportParams);
          sendTransport = device.createSendTransport(transportParams);
      
          console.log('Send transport created on client:', sendTransport);

          startProducing();

          sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            console.log("Connect event fired. Sending DTLS parameters to server...");
          
            socket.emit('connectTransport', {
              transportId: sendTransport.id,
              dtlsParameters
            }, () => {
              console.log("Server confirmed the connection.");
              callback();
            });
          });

          sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            try {
              socket.emit('produce', {
                transportId: sendTransport.id,
                kind,
                rtpParameters
              }, (producerId: string) => { 
                callback({ id: producerId });
              });
            } catch (error) {
              
            }
          });
      
        });
      } catch (error) {
        console.error('Failed to load mediasoup device:', error);
      }
    })

    
    async function startProducing() {
      console.log('Starting video production...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      
      const producer = await sendTransport.produce({ track });
      
      console.log('✅ Successfully producing video!');
      console.log('Client-side producer created:', producer);
    }

    socket.on("new-producer",(producerId: string) => {
      console.log("Hey a new producer join", producerId);
      
    })

    socket.on("existing-producers", ({ producerIds }: { producerIds: string[] }) => { 
      console.log("Hey there are some user who already producing", producerIds);
    });


    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>This is stream page. Thankyou for visit</div>
  );
}