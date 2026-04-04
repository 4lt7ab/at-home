/**
 * Skeleton atom -- shimmer loading placeholder.
 * Requires AnimationStyles to be mounted for the `shimmer` keyframe.
 */
import { useTheme } from "../theme";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, borderRadius, style }: SkeletonProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        width,
        height,
        borderRadius: borderRadius ?? theme.radius.md,
        background: `linear-gradient(90deg, ${theme.color.surfaceContainerHigh} 25%, ${theme.color.surfaceContainerHighest} 50%, ${theme.color.surfaceContainerHigh} 75%)`,
        backgroundSize: "400px 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
