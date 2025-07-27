// components/HlsPlayerLoader.tsx

'use client'; // This directive marks it as a Client Component

import dynamic from 'next/dynamic';

// The dynamic import is now safely inside a Client Component
const HlsPlayer = dynamic(() => import('@/components/HlsPlayer'), {
  ssr: false,
});

// This component just returns the player
export default function HlsPlayerLoader() {
  return <HlsPlayer />;
}