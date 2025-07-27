import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black text-white px-4 relative">
      <div className="flex flex-col items-center justify-center gap-6 mb-24 w-full max-w-md">
        <Link
          href="/stream"
          className="w-full bg-zinc-800/60 hover:bg-zinc-700 transition-colors backdrop-blur-md border border-zinc-700 rounded-xl p-6 text-left"
        >
          <h2 className="text-2xl font-semibold text-white mb-1">Go Live</h2>
          <p className="text-zinc-400 text-sm">Join room and start streaming instantly</p>
        </Link>

        <Link
          href="/watch"
          className="w-full bg-zinc-800/60 hover:bg-zinc-700 transition-colors backdrop-blur-md border border-zinc-700 rounded-xl p-6 text-left"
        >
          <h2 className="text-2xl font-semibold text-white mb-1">Watch Live</h2>
          <p className="text-zinc-400 text-sm">View live HLS playback from the room</p>
        </Link>
      </div>

      <footer className="absolute bottom-6 text-center text-zinc-500 text-sm">
        <p className="mb-1 font-medium text-white">About the Author</p>
        <p>
          Hey, I’m <span className="text-white font-semibold">Sarthak</span> — an engineer who loves building and solving real problems{" "}
        </p>
        <a
          href="https://github.com/sarthaksharma27"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-blue-400 hover:underline"
        >
          Visit GitHub →
        </a>
      </footer>
    </main>
  );
}
