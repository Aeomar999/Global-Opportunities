/**
 * BrandMark: orange rounded-square "G" logo, drawn as inline SVG so it needs
 * no image file and follows the brand tokens.
 *
 * Props:
 * - size: pixel size of the square (default 36)
 * - className: extra classes
 * Decorative (aria-hidden): the product name is always shown beside it.
 */
interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className={className}>
      <rect width="36" height="36" rx="10" className="fill-orange-500" />
      <text
        x="18"
        y="25.5"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        className="fill-white font-display"
      >
        G
      </text>
    </svg>
  );
}
