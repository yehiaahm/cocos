import type { ImgHTMLAttributes } from 'react';
import { imageSources } from '../lib/images';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height'> {
  src: string;
  alt: string;
  /** e.g. "(min-width: 1100px) 25vw, 50vw" — tells the browser which WebP width to fetch. */
  sizes: string;
  /** Load immediately (above-the-fold images). */
  priority?: boolean;
  maxWidth?: number;
}

/** Responsive, lazy WebP image with intrinsic width/height to prevent layout shift. */
export function Picture({ src, alt, sizes, priority, maxWidth, className, style, ...rest }: Props) {
  const s = imageSources(src, maxWidth);
  return (
    <img
      src={s.src}
      srcSet={s.srcSet}
      sizes={s.srcSet ? sizes : undefined}
      width={s.width}
      height={s.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'auto' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      className={className}
      style={{ objectFit: 'cover', display: 'block', ...style }}
      {...rest}
    />
  );
}
