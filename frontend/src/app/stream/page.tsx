"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from 'mediasoup-client';
import { types } from 'mediasoup-client';


let device: types.Device;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export default function StreamPage() {
  const videoRefLocal = useRef<HTMLVideoElement>(null);
  const videoRefRemote = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (videoRefLocal.current) {
          videoRefLocal.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices:", err);
        setError(err.message || "Could not access camera/microphone.");
      }
    };

    startMedia();

    return () => {
      [videoRefLocal, videoRefRemote].forEach((ref) => {
        if (ref.current?.srcObject) {
          (ref.current.srcObject as MediaStream)
            .getTracks()
            .forEach((track) => track.stop());
        }
      });
    };
  }, []);

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
      } catch (error) {
        console.error('Failed to load mediasoup device:', error);
      }
    })

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-12 text-center">Stream page</h1>

      {error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : (
        <div className="flex justify-center gap-6">
          <video
            ref={videoRefLocal}
            autoPlay
            muted
            playsInline
            className="max-w-[500px] w-[500px] aspect-[16/9] border border-gray-300 object-cover rounded-lg shadow-md"
          />
          <video
            ref={videoRefRemote}
            autoPlay
            playsInline
            className="max-w-[500px] w-[500px] aspect-[16/9] border border-gray-300 object-cover rounded-lg shadow-md"
          />
        </div>
      )}
    </div>
  );
}