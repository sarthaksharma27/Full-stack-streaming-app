"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from 'mediasoup-client';
import { types } from 'mediasoup-client';


let device: types.Device;
let sendTransport: types.Transport;

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

    
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // return (
  //   <div className="min-h-screen flex flex-col items-center p-6">
  //     <h1 className="text-3xl font-bold mb-12 text-center">Stream page</h1>

  //     {error ? (
  //       <p className="text-red-600">Error: {error}</p>
  //     ) : (
  //       <div className="flex justify-center gap-6">
  //         <video
  //           ref={videoRefLocal}
  //           autoPlay
  //           muted
  //           playsInline
  //           className="max-w-[500px] w-[500px] aspect-[16/9] border border-gray-300 object-cover rounded-lg shadow-md"
  //         />
  //         <video
  //           ref={videoRefRemote}
  //           autoPlay
  //           playsInline
  //           className="max-w-[500px] w-[500px] aspect-[16/9] border border-gray-300 object-cover rounded-lg shadow-md"
  //         />
  //       </div>
  //     )}
  //   </div>
  // );
}