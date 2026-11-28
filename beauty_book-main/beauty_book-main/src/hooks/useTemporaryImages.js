import { useEffect, useRef } from 'react';
import { createTemporaryImages } from '@/lib/stylistImages';

export function useTemporaryImages() {
  const ref = useRef(null);
  if (!ref.current) ref.current = createTemporaryImages();
  useEffect(() => {
    const images = ref.current;
    images.resume();
    // Full document navigation releases blobs immediately. SPA navigation uses TTL.
    const onPageHide = event => { if (!event.persisted) images.clear(); };
    window.addEventListener('pagehide', onPageHide);
    return () => { window.removeEventListener('pagehide', onPageHide); images.leave(); };
  }, []);
  return ref.current;
}
