"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from 'mediasoup-client';
import { types } from 'mediasoup-client';


let device: types.Device;
let sendTransport: types.Transport;
let recvTransport: types.Transport;

const consumers = new Map();

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

        socket.emit('get-producers');
        
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

    socket.on("new-producer",({ producerId }: { producerId: string })  => {
      console.log("Hey a new producer join", producerId);
      consumeProducer(producerId);
    })

    socket.on("existing-producers", async ({ producerIds }: { producerIds: string[] }) => { 
      console.log("Hey there are some user who already producing", producerIds);
      for( const producerId of producerIds) {
          await consumeProducer(producerId);
      }
    });

  socket.on("producer-closed", ({ producerId }: { producerId: string }) => {
    console.log(`Producer ${producerId} has closed. Cleaning up.`);

    let consumerToClose;
    for (const consumer of consumers.values()) {
        if (consumer.producerId === producerId) {
            consumerToClose = consumer;
            break;
        }
    }

    if (!consumerToClose) {
        return;
    }

    consumerToClose.close();
    
    consumers.delete(consumerToClose.id);
    
    const videoElement = document.getElementById(`vid-${producerId}`);
    if (videoElement) {
        videoElement.parentNode?.removeChild(videoElement);
    }
  });

    async function consumeProducer(producerId: string) {
      await createRecvTransport();
  
      await consume(producerId);
    }

    async function createRecvTransport() {
      if (recvTransport) {
          return;
      }
  
      const params: types.TransportOptions = await new Promise((resolve) => {
          socket.emit('create-recv-transport', (data: types.TransportOptions) => resolve(data));
      });
  
      recvTransport = device.createRecvTransport(params);
      console.log("Recv Transport created on client", recvTransport);
      
  
      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socket.emit('connect-recv-transport', { transportId: recvTransport.id, dtlsParameters }, () => {
              callback();
          });
      });
    }

    type ConsumerParams = {
      error: any;
      id: string;
      producerId: string;
      kind: 'audio' | 'video';
      rtpParameters: types.RtpParameters
    };
  
  async function consume(producerId: string) {
    const { rtpCapabilities } = device;

    const data: ConsumerParams = await new Promise((resolve) => {
        socket.emit('consume', {
            producerId,
            transportId: recvTransport.id,
            rtpCapabilities,
        }, (d: ConsumerParams) => resolve(d));
    });

    if (data.error) {
      console.error('Failed to create consumer:', data.error);
      return;
  }

    console.log("Recived consume from Server", data);
    

    const { id, kind, rtpParameters } = data;

    const consumer = await recvTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
    });
    
    consumers.set(id, consumer);

    socket.emit('resume-consumer', { consumerId: consumer.id });
    console.log("Consumer created and resume request sent.");

    
    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    document.body.appendChild(videoElement);
  }
 

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