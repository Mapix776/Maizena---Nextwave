export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host.includes('onrender.com') ||
      host.includes('vercel.app') ||
      (host !== 'localhost' && host !== '127.0.0.1')
    ) {
      return 'https://maizena-nextwave.onrender.com';
    }
  }
  return 'http://localhost:3001';
}

export const backendUrl = getBackendUrl();
