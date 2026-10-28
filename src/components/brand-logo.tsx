import Image from 'next/image';
import { cn } from '@/lib/utils';

// Tone describes the surface behind the logo, not the visitor's device theme.
export function BrandLogo({ tone = 'light', className }: {
  tone?: 'light' | 'dark'; className?: string;
}) {
  return <Image className={cn('brand-logo', className)}
    src={`/brand/auto-stilo/logo-on-${tone}.png`} width={48} height={48} unoptimized alt="" />;
}
