import type { ImgHTMLAttributes } from 'react';
import images from '@/lib/stay-images.json';
type Variant = { src: string; width: number; height: number };
// Only transform bundled photographs; external URLs retain their original behavior.
export function StayImage({ src, loading = 'lazy', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const variants = typeof src === 'string' ? (images as Record<string, Variant[]>)[src] : undefined;
  const largest = variants?.[variants.length - 1];
  // oxlint-disable-next-line next/no-img-element
  return <img {...props} src={largest?.src ?? src} srcSet={variants?.map(variant => `${variant.src} ${variant.width}w`).join(', ')} sizes="(min-width: 1024px) 45vw, 100vw" width={largest?.width ?? 960} height={largest?.height ?? 640} loading={loading} decoding="async" />;
}
