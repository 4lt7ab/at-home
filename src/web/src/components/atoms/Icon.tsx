/**
 * Icon atom -- renders a Material Symbols Outlined icon.
 * This is the only component that uses a CSS class (for the icon font).
 */

export interface IconProps {
  name: string;
  size?: number;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, style }: IconProps) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, lineHeight: 1, ...style }}
    >
      {name}
    </span>
  );
}
