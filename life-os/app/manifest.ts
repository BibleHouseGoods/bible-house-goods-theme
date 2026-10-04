import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life OS',
    short_name: 'Life OS',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f3ec',
    theme_color: '#f6f3ec',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
