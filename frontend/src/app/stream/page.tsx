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

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
      console.log('Starting media production...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      setLocalStream(stream);
    
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      if (videoTrack) {
        const videoProducer = await sendTransport.produce({ 
          track: videoTrack,
          appData: { mediaType: 'video' } 
        });
        console.log('✅ Successfully producing video!', videoProducer.id);
      }
    
      if (audioTrack) {
        const audioProducer = await sendTransport.produce({ 
          track: audioTrack,
          appData: { mediaType: 'audio' }
        });
        console.log('✅ Successfully producing audio!', audioProducer.id);
      }
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

    const audioElement = document.getElementById(`aud-${producerId}`);
    if (audioElement) {
        audioElement.parentNode?.removeChild(audioElement);
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

    if (kind === 'video') {
      const videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      videoElement.id = `vid-${producerId}`; 
      document.body.appendChild(videoElement);
    } else if (kind === 'audio') {
      const audioElement = document.createElement('audio');
      audioElement.srcObject = stream;
      audioElement.autoplay = true;
      audioElement.id = `aud-${producerId}`; 
      document.body.appendChild(audioElement);
    }
  }
 

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'fixed', 
          bottom: '20px',    
          right: '20px',     
          width: '250px',   
          border: '2px solid black',
          borderRadius: '8px',
          backgroundColor: 'black'
        }}
      />
      
      <div>This is stream page. Thankyou for visit</div>
    </div>
  );

}