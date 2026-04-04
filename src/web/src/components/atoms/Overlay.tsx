/**
 * Overlay atom -- fixed full-screen backdrop.
 */

export interface OverlayProps {
  onClick?: () => void;
  zIndex?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Overlay({ onClick, zIndex = 100, style, children }: OverlayProps) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
