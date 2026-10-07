import { forwardRef, useState } from 'react';
import { IMAGE_PLACEHOLDER, imageSource, isMissingImage } from '@/lib/imageFallback';

// Keeps the original img box/ref and retries when its source changes.
// A fallback is visual only: it never invokes a photo editor's onLoad callback.
const BeautyImage = forwardRef(function BeautyImage({ src, srcSet, alt = '', style, onError, onLoad, className = '', ...props }, ref) {
  const source = imageSource(src);
  const sources = imageSource(srcSet);
  const identity = source + '\n' + sources;
  const [failedSource, setFailedSource] = useState(null);
  const fallback = isMissingImage({ src: source, srcSet: sources, failed: failedSource === identity });
  const defaultStyle = fallback
    ? { objectFit: 'contain', objectPosition: 'center', backgroundColor: '#fbf3ed', ...style }
    : { objectPosition: 'center top', ...style };

  return <img
    {...props}
    ref={ref}
    key={identity + (fallback ? ':fallback' : ':image')}
    src={fallback ? IMAGE_PLACEHOLDER : source || undefined}
    srcSet={fallback ? undefined : sources || undefined}
    alt={fallback && alt ? `${alt} — visuel indisponible` : alt}
    data-image-fallback={fallback ? 'true' : undefined}
    className={className}
    style={defaultStyle}
    onLoad={fallback ? undefined : event => { if (failedSource) setFailedSource(null); onLoad?.(event); }}
    onError={fallback ? undefined : event => { setFailedSource(identity); onError?.(event); }}
  />;
});
export default BeautyImage;
