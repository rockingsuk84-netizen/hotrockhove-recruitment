import Image, { type ImageProps } from "next/image";

/**
 * Images are referenced as `/images/...` (bundled with the project) or an
 * https:// URL managed from the admin (e.g. Cloudinary). Project and Cloudinary
 * images go through Next.js optimisation; other hosts are served as-is.
 */
export function SiteImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  const optimisable = src.startsWith("/") || src.startsWith("https://res.cloudinary.com/");
  return <Image src={src} alt={alt} unoptimized={!optimisable} {...props} />;
}
