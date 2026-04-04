/**
 * GalleryComponentView -- renders a single component entry with:
 * - Multi-theme preview (via PreviewPanel)
 * - Variant grid
 * - Interactive props playground
 */
import { useState, useCallback } from "react";
import type { ComponentEntry, PropDef } from "./registry";
import { PreviewPanel } from "./PreviewPanel";
import { viewerTheme, viewerPanel, viewerLabel, viewerSubheading } from "./viewerTheme";

// ---------------------------------------------------------------------------
// Props Playground Controls
// ---------------------------------------------------------------------------

function PropControl({
  def,
  value,
  onChange,
}: {
  def: PropDef;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
}) {
  const controlStyle: React.CSSProperties = {
    padding: "4px 8px",
    background: viewerTheme.bgSurface,
    border: `1px solid ${viewerTheme.border}`,
    borderRadius: 4,
    color: viewerTheme.text,
    fontFamily: viewerTheme.font,
    fontSize: viewerTheme.fontSize.sm,
    outline: "none",
    width: "100%",
  };

  switch (def.type) {
    case "enum":
      return (
        <select
          value={String(value)}
          onChange={(e) => onChange(def.name, e.target.value)}
          style={controlStyle}
        >
          {def.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "boolean":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(def.name, e.target.checked)}
          />
          <span style={{ color: viewerTheme.text, fontSize: viewerTheme.fontSize.sm }}>
            {value ? "true" : "false"}
          </span>
        </label>
      );

    case "number":
      return (
        <input
          type="number"
          value={Number(value)}
          onChange={(e) => onChange(def.name, Number(e.target.value))}
          style={controlStyle}
        />
      );

    case "string":
    default:
      return (
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onChange(def.name, e.target.value)}
          style={controlStyle}
        />
      );
  }
}

function PropsPlayground({
  propDefs,
  values,
  onChange,
}: {
  propDefs: PropDef[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  if (propDefs.length === 0) return null;

  return (
    <div style={{ ...viewerPanel(), marginTop: viewerTheme.spacing.md }}>
      <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.md }}>
        Props Playground
      </span>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr",
          gap: viewerTheme.spacing.sm,
          alignItems: "center",
        }}
      >
        {propDefs.map((def) => (
          <div key={def.name} style={{ display: "contents" }}>
            <span
              style={{
                color: viewerTheme.accent,
                fontSize: viewerTheme.fontSize.sm,
                fontFamily: viewerTheme.fontMono,
              }}
              title={def.description}
            >
              {def.name}
            </span>
            <PropControl def={def} value={values[def.name]} onChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant Grid
// ---------------------------------------------------------------------------

function VariantGrid({ entry, baseProps }: { entry: ComponentEntry; baseProps: Record<string, unknown> }) {
  if (!entry.variants || entry.variants.length === 0) return null;

  return (
    <div style={{ marginTop: viewerTheme.spacing.md }}>
      <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.md }}>
        Variants
      </span>
      <PreviewPanel>
        {() => (
          <div style={{ display: "flex", flexWrap: "wrap", gap: viewerTheme.spacing.lg, alignItems: "flex-start" }}>
            {entry.variants!.map((v) => (
              <div key={v.name} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: viewerTheme.fontSize.xs,
                    color: viewerTheme.textMuted,
                    fontFamily: viewerTheme.fontMono,
                  }}
                >
                  {v.name}
                </span>
                {entry.render({ ...baseProps, ...v.props })}
              </div>
            ))}
          </div>
        )}
      </PreviewPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component View
// ---------------------------------------------------------------------------

export function GalleryComponentView({ entry }: { entry: ComponentEntry }) {
  // Build initial prop values from propDefs defaults
  const [propValues, setPropValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const def of entry.propDefs) {
      initial[def.name] = def.defaultValue;
    }
    return initial;
  });

  const handlePropChange = useCallback((name: string, value: unknown) => {
    setPropValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  return (
    <div style={{ marginBottom: viewerTheme.spacing.xl }}>
      {/* Header */}
      <div style={{ marginBottom: viewerTheme.spacing.md }}>
        <h3 style={{ ...viewerSubheading(), marginBottom: 4 }}>{entry.name}</h3>
        <p
          style={{
            color: viewerTheme.textMuted,
            fontSize: viewerTheme.fontSize.sm,
            fontFamily: viewerTheme.font,
            margin: 0,
          }}
        >
          {entry.description}
        </p>
      </div>

      {/* Live preview with current props */}
      <div>
        <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.sm }}>
          Preview
        </span>
        <PreviewPanel>{() => entry.render(propValues)}</PreviewPanel>
      </div>

      {/* Props playground */}
      <PropsPlayground propDefs={entry.propDefs} values={propValues} onChange={handlePropChange} />

      {/* Variant grid */}
      <VariantGrid entry={entry} baseProps={propValues} />

      {/* Code template */}
      {entry.codeTemplate && (
        <div style={{ marginTop: viewerTheme.spacing.md }}>
          <span style={{ ...viewerLabel(), display: "block", marginBottom: viewerTheme.spacing.sm }}>
            Usage
          </span>
          <pre
            style={{
              ...viewerPanel(),
              fontFamily: viewerTheme.fontMono,
              fontSize: viewerTheme.fontSize.sm,
              color: viewerTheme.accent,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {entry.codeTemplate}
          </pre>
        </div>
      )}
    </div>
  );
}
