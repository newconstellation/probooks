import React from 'react';
import { useIsDarkMode } from '@/hooks/useDarkMode';

export const BRAND_NAME = 'Probooks';

interface BrandLogoProps {
  /** Logo height in pixels. The width follows the artwork's proportions. */
  height?: number;
  /**
   * Which wordmark to show. "auto" picks white text in dark mode and navy
   * text in light mode; "white" is for coloured or dark backgrounds.
   */
  tone?: 'auto' | 'dark' | 'white';
  className?: string;
}

/**
 * The Probooks logo: the blue folded-ribbon "P" plus the wordmark.
 */
export function BrandLogo({
  height = 37,
  tone = 'auto',
  className,
}: BrandLogoProps) {
  const isDarkMode = useIsDarkMode();
  const white = tone === 'white' || (tone === 'auto' && isDarkMode);

  return (
    <img
      src={
        white ? '/brand/probooks-logo-white.png' : '/brand/probooks-logo.png'
      }
      alt={BRAND_NAME}
      height={height}
      style={{ height, width: 'auto', display: 'inline-block' }}
      className={className}
    />
  );
}

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The "P" mark on its own, for small spots like the sidebar.
 */
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <img
      src="/brand/probooks-mark.png"
      alt={BRAND_NAME}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'inline-block' }}
      className={className}
    />
  );
}
