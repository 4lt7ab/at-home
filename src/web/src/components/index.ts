// Components barrel -- re-exports from all tiers

// Atoms
export * from "./atoms";

// Molecules
export * from "./molecules";

// Organisms
export * from "./organisms";

// Templates
export * from "./templates";

// Theme
export * from "./theme";

// Legacy re-exports (backward compatibility -- actual implementations are in molecules/)
export { ContentCard } from "./ContentCard";
export type { ContentCardVariant } from "./ContentCard";
export { SectionHeading } from "./SectionHeading";
export type { SectionHeadingVariant } from "./SectionHeading";
export { MarkdownContent, stripMarkdown } from "./MarkdownContent";
