"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// The URL of your backend server, from your .env.local file
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export default function StreamPage() {
  const videoRefLocal = useRef<HTMLVideoElement>(null);
  const videoRefRemote = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // This useEffect handles the camera and microphone access. It is unchanged.
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

  // --- ADDED FOR SOCKET.IO ---
  // This new useEffect handles the socket connection lifecycle.
  useEffect(() => {
    // Connect to the socket server
    const socket: Socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    // Cleanup function to disconnect the socket when the component unmounts
    return () => {
      socket.disconnect();
    };
  }, []); // The empty array ensures this runs only once.

  // The original UI is returned without any changes.
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