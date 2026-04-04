/**
 * GalleryPage -- main page component for the component gallery.
 *
 * Accessible at /#/gallery. Shows all registered components organized
 * by category (atoms, molecules, organisms) with multi-theme preview,
 * props playground, and variant grid.
 */
import { useState, useMemo } from "react";
import { getComponents, getComponentsByCategory } from "./registry";
import { initializeGallery } from "./registerAll";
import { GalleryComponentView } from "./GalleryComponentView";
import { viewerTheme, viewerHeading, viewerLabel, viewerPanel } from "./viewerTheme";
import { AnimationStyles } from "../components/atoms";

import type { ComponentEntry } from "./registry";

// Ensure components are registered on first render
initializeGallery();

// ---------------------------------------------------------------------------
// Category sections
// ---------------------------------------------------------------------------

const CATEGORIES: { key: ComponentEntry["category"]; label: string }[] = [
  { key: "atom", label: "Atoms" },
  { key: "molecule", label: "Molecules" },
  { key: "organism", label: "Organisms" },
  { key: "template", label: "Templates" },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({
  components,
  selected,
  onSelect,
  filterCategory,
  onFilterCategory,
}: {
  components: ComponentEntry[];
  selected: string | null;
  onSelect: (name: string) => void;
  filterCategory: string;
  onFilterCategory: (cat: string) => void;
}) {
  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: `1px solid ${viewerTheme.border}`,
        padding: viewerTheme.spacing.lg,
        overflowY: "auto",
        background: viewerTheme.bgSurface,
      }}
    >
      <h1 style={{ ...viewerHeading(), fontSize: viewerTheme.fontSize.lg, marginBottom: viewerTheme.spacing.lg }}>
        Gallery
      </h1>

      {/* Category filter */}
      <div style={{ marginBottom: viewerTheme.spacing.lg }}>
        <select
          value={filterCategory}
          onChange={(e) => onFilterCategory(e.target.value)}
          style={{
            width: "100%",
            padding: "4px 8px",
            background: viewerTheme.bgPanel,
            border: `1px solid ${viewerTheme.border}`,
            borderRadius: 4,
            color: viewerTheme.text,
            fontFamily: viewerTheme.font,
            fontSize: viewerTheme.fontSize.sm,
          }}
        >
          <option value="all">All ({components.length})</option>
          {CATEGORIES.map((cat) => {
            const count = components.filter((c) => c.category === cat.key).length;
            if (count === 0) return null;
            return (
              <option key={cat.key} value={cat.key}>
                {cat.label} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* Component list */}
      {CATEGORIES.map((cat) => {
        const items = components.filter((c) => c.category === cat.key);
        if (items.length === 0) return null;
        if (filterCategory !== "all" && filterCategory !== cat.key) return null;

        return (
          <div key={cat.key} style={{ marginBottom: viewerTheme.spacing.lg }}>
            <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.sm }}>
              {cat.label}
            </span>
            {items.map((comp) => {
              const isSelected = selected === comp.name;
              return (
                <button
                  key={comp.name}
                  onClick={() => onSelect(comp.name)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: `${viewerTheme.spacing.xs} ${viewerTheme.spacing.sm}`,
                    background: isSelected ? viewerTheme.accent + "22" : "transparent",
                    border: "none",
                    borderRadius: 4,
                    color: isSelected ? viewerTheme.accent : viewerTheme.text,
                    fontFamily: viewerTheme.font,
                    fontSize: viewerTheme.fontSize.sm,
                    cursor: "pointer",
                    marginBottom: 2,
                  }}
                >
                  {comp.name}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// GalleryPage
// ---------------------------------------------------------------------------

export function GalleryPage() {
  const allComponents = useMemo(() => getComponents(), []);
  const [selected, setSelected] = useState<string | null>(allComponents[0]?.name ?? null);
  const [filterCategory, setFilterCategory] = useState("all");

  const filteredComponents = useMemo(() => {
    if (filterCategory === "all") return allComponents;
    return getComponentsByCategory(filterCategory as ComponentEntry["category"]);
  }, [allComponents, filterCategory]);

  const selectedEntry = useMemo(
    () => allComponents.find((c) => c.name === selected) ?? null,
    [allComponents, selected],
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: viewerTheme.bg,
        color: viewerTheme.text,
        fontFamily: viewerTheme.font,
        overflow: "hidden",
      }}
    >
      <AnimationStyles />

      {/* Sidebar */}
      <Sidebar
        components={allComponents}
        selected={selected}
        onSelect={setSelected}
        filterCategory={filterCategory}
        onFilterCategory={setFilterCategory}
      />

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: viewerTheme.spacing.xl,
        }}
      >
        {selectedEntry ? (
          <GalleryComponentView key={selectedEntry.name} entry={selectedEntry} />
        ) : (
          <div
            style={{
              ...viewerPanel(),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 200,
              color: viewerTheme.textMuted,
              fontSize: viewerTheme.fontSize.md,
            }}
          >
            Select a component from the sidebar
          </div>
        )}
      </main>
    </div>
  );
}
