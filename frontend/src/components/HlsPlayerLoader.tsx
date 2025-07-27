'use client';

import dynamic from 'next/dynamic';

const HlsPlayer = dynamic(() => import('@/components/HlsPlayer'), {
  ssr: false,
});

export default function HlsPlayerLoader() {
  return <HlsPlayer />;
}