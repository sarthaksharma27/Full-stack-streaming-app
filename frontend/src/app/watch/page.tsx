// app/watch/page.tsx

import HlsPlayerLoader from '@/components/HlsPlayerLoader'; // Import the new loader

export default function WatchPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Watch Live</h1>
      <div style={{ maxWidth: '900px', margin: 'auto' }}>
        {/* Use the loader component here */}
        <HlsPlayerLoader />
      </div>
    </main>
  );
}