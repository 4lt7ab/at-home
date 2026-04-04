/**
 * BackButton molecule -- ghost-style button with left arrow.
 */
import { Button, Icon } from "../atoms";

export interface BackButtonProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
}

export function BackButton({ onClick, label = "Back", style }: BackButtonProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} style={style}>
      <Icon name="arrow_back" size={16} />
      {label}
    </Button>
  );
}
