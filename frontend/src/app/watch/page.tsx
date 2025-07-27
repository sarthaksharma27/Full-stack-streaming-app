import HlsPlayerLoader from '@/components/HlsPlayerLoader';

export default function WatchPage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{ maxWidth: '900px', margin: 'auto' }}>
        <HlsPlayerLoader />
      </div>
    </main>
  );
}