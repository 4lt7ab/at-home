/**
 * registerAll -- registers all atoms and key molecules in the component gallery.
 *
 * Wrapped in ensureRegistered() to prevent double registration during
 * hot-reload or re-import.
 */
import { registerComponent, ensureRegistered } from "./registry";
import { Button } from "../components/atoms/Button";
import { Badge } from "../components/atoms/Badge";
import { Input } from "../components/atoms/Input";
import { Select } from "../components/atoms/Select";
import { Textarea } from "../components/atoms/Textarea";
import { Icon } from "../components/atoms/Icon";
import { StatusDot } from "../components/atoms/StatusDot";
import { SectionLabel } from "../components/atoms/SectionLabel";
import { Skeleton } from "../components/atoms/Skeleton";
import { Overlay } from "../components/atoms/Overlay";
import { Card } from "../components/molecules/Card";
import { Stack } from "../components/molecules/Stack";
import { EmptyState } from "../components/molecules/EmptyState";
import { ThemeSwitcher } from "../components/molecules/ThemeSwitcher";
import type { BadgeVariant } from "../components/atoms/Badge";
import type { ButtonProps } from "../components/atoms/Button";

function registerAllComponents() {
  // -------------------------------------------------------------------------
  // Atoms
  // -------------------------------------------------------------------------

  registerComponent({
    name: "Button",
    description: "Primary action button with variants, sizes, and loading state.",
    category: "atom",
    propDefs: [
      { name: "variant", type: "enum", defaultValue: "primary", options: ["primary", "ghost", "danger", "icon"], description: "Visual style variant" },
      { name: "size", type: "enum", defaultValue: "md", options: ["sm", "md"], description: "Button size" },
      { name: "children", type: "string", defaultValue: "Click Me", description: "Button label text" },
      { name: "disabled", type: "boolean", defaultValue: false, description: "Disable interactions" },
      { name: "loading", type: "boolean", defaultValue: false, description: "Show loading spinner" },
    ],
    render: (props) => (
      <Button
        variant={props.variant as ButtonProps["variant"]}
        size={props.size as ButtonProps["size"]}
        disabled={props.disabled as boolean}
        loading={props.loading as boolean}
      >
        {String(props.children)}
      </Button>
    ),
    variants: [
      { name: "Primary", props: { variant: "primary", children: "Primary" } },
      { name: "Ghost", props: { variant: "ghost", children: "Ghost" } },
      { name: "Danger", props: { variant: "danger", children: "Danger" } },
      { name: "Icon", props: { variant: "icon", children: "edit" } },
      { name: "Small", props: { size: "sm", children: "Small" } },
      { name: "Loading", props: { loading: true, children: "Loading" } },
      { name: "Disabled", props: { disabled: true, children: "Disabled" } },
    ],
    codeTemplate: `<Button variant="primary" size="md">Click Me</Button>`,
  });

  registerComponent({
    name: "Badge",
    description: "Variant-based colored badge for status labels and tags.",
    category: "atom",
    propDefs: [
      {
        name: "variant",
        type: "enum",
        defaultValue: "default",
        options: ["active", "paused", "done", "archived", "area", "effort", "overdue", "completion", "recurrence", "content", "standalone", "status", "default"],
        description: "Color variant",
      },
      { name: "children", type: "string", defaultValue: "Badge", description: "Badge text" },
    ],
    render: (props) => (
      <Badge variant={props.variant as BadgeVariant}>{String(props.children)}</Badge>
    ),
    variants: [
      { name: "Active", props: { variant: "active", children: "Active" } },
      { name: "Paused", props: { variant: "paused", children: "Paused" } },
      { name: "Done", props: { variant: "done", children: "Done" } },
      { name: "Archived", props: { variant: "archived", children: "Archived" } },
      { name: "Area", props: { variant: "area", children: "Area" } },
      { name: "Effort", props: { variant: "effort", children: "Low" } },
      { name: "Overdue", props: { variant: "overdue", children: "Overdue" } },
      { name: "Completion", props: { variant: "completion", children: "75%" } },
      { name: "Recurrence", props: { variant: "recurrence", children: "Weekly" } },
      { name: "Content", props: { variant: "content", children: "3 notes" } },
      { name: "Standalone", props: { variant: "standalone", children: "Standalone" } },
      { name: "Status", props: { variant: "status", children: "Status" } },
      { name: "Default", props: { variant: "default", children: "Default" } },
    ],
    codeTemplate: `<Badge variant="active">Active</Badge>`,
  });

  registerComponent({
    name: "Input",
    description: "Text input with optional label and focus glow.",
    category: "atom",
    propDefs: [
      { name: "label", type: "string", defaultValue: "Label", description: "Optional label above input" },
      { name: "placeholder", type: "string", defaultValue: "Type here...", description: "Placeholder text" },
      { name: "disabled", type: "boolean", defaultValue: false, description: "Disable input" },
    ],
    render: (props) => (
      <Input
        label={props.label as string}
        placeholder={props.placeholder as string}
        disabled={props.disabled as boolean}
      />
    ),
    variants: [
      { name: "With Label", props: { label: "Email", placeholder: "you@example.com" } },
      { name: "No Label", props: { label: "", placeholder: "Search..." } },
      { name: "Disabled", props: { label: "Disabled", disabled: true } },
    ],
    codeTemplate: `<Input label="Email" placeholder="you@example.com" />`,
  });

  registerComponent({
    name: "Select",
    description: "Dropdown select with optional label and focus glow.",
    category: "atom",
    propDefs: [
      { name: "label", type: "string", defaultValue: "Label", description: "Optional label above select" },
      { name: "disabled", type: "boolean", defaultValue: false, description: "Disable select" },
    ],
    render: (props) => (
      <Select label={props.label as string} disabled={props.disabled as boolean}>
        <option>Option A</option>
        <option>Option B</option>
        <option>Option C</option>
      </Select>
    ),
    variants: [
      { name: "With Label", props: { label: "Priority" } },
      { name: "No Label", props: { label: "" } },
      { name: "Disabled", props: { label: "Disabled", disabled: true } },
    ],
    codeTemplate: `<Select label="Priority">\n  <option>High</option>\n  <option>Low</option>\n</Select>`,
  });

  registerComponent({
    name: "Textarea",
    description: "Multi-line text input with optional label and focus glow.",
    category: "atom",
    propDefs: [
      { name: "label", type: "string", defaultValue: "Notes", description: "Optional label above textarea" },
      { name: "placeholder", type: "string", defaultValue: "Write something...", description: "Placeholder text" },
      { name: "rows", type: "number", defaultValue: 3, description: "Number of visible rows" },
      { name: "disabled", type: "boolean", defaultValue: false, description: "Disable textarea" },
    ],
    render: (props) => (
      <Textarea
        label={props.label as string}
        placeholder={props.placeholder as string}
        rows={props.rows as number}
        disabled={props.disabled as boolean}
      />
    ),
    variants: [
      { name: "With Label", props: { label: "Description", placeholder: "Enter description..." } },
      { name: "No Label", props: { label: "", placeholder: "Quick note..." } },
    ],
    codeTemplate: `<Textarea label="Notes" placeholder="Write something..." rows={3} />`,
  });

  registerComponent({
    name: "Icon",
    description: "Renders a Material Symbols Outlined icon by name.",
    category: "atom",
    propDefs: [
      { name: "name", type: "string", defaultValue: "home", description: "Material Symbol icon name" },
      { name: "size", type: "number", defaultValue: 24, description: "Icon size in pixels" },
    ],
    render: (props) => <Icon name={props.name as string} size={props.size as number} />,
    variants: [
      { name: "Home", props: { name: "home" } },
      { name: "Settings", props: { name: "settings" } },
      { name: "Check", props: { name: "check_circle" } },
      { name: "Delete", props: { name: "delete" } },
      { name: "Edit", props: { name: "edit" } },
      { name: "Add", props: { name: "add" } },
      { name: "Large", props: { name: "star", size: 40 } },
      { name: "Small", props: { name: "star", size: 16 } },
    ],
    codeTemplate: `<Icon name="home" size={24} />`,
  });

  registerComponent({
    name: "StatusDot",
    description: "Small colored circle indicating entity status.",
    category: "atom",
    propDefs: [
      { name: "status", type: "enum", defaultValue: "active", options: ["active", "paused", "done", "archived"], description: "Status name for auto-coloring" },
      { name: "size", type: "number", defaultValue: 8, description: "Dot size in pixels" },
      { name: "animate", type: "boolean", defaultValue: false, description: "Enable pulse animation" },
    ],
    render: (props) => (
      <StatusDot
        status={props.status as string}
        size={props.size as number}
        animate={props.animate as boolean}
        glowColor={props.animate ? "#5dade244" : undefined}
      />
    ),
    variants: [
      { name: "Active", props: { status: "active" } },
      { name: "Paused", props: { status: "paused" } },
      { name: "Done", props: { status: "done" } },
      { name: "Archived", props: { status: "archived" } },
      { name: "Animated", props: { status: "active", animate: true } },
    ],
    codeTemplate: `<StatusDot status="active" size={8} />`,
  });

  registerComponent({
    name: "SectionLabel",
    description: "Uppercase micro-label for section headings.",
    category: "atom",
    propDefs: [
      { name: "children", type: "string", defaultValue: "Section Title", description: "Label text" },
    ],
    render: (props) => <SectionLabel>{String(props.children)}</SectionLabel>,
    variants: [
      { name: "Default", props: { children: "SECTION TITLE" } },
      { name: "Short", props: { children: "INFO" } },
    ],
    codeTemplate: `<SectionLabel>Section Title</SectionLabel>`,
  });

  registerComponent({
    name: "Skeleton",
    description: "Shimmer loading placeholder with customizable dimensions.",
    category: "atom",
    propDefs: [
      { name: "width", type: "string", defaultValue: "200px", description: "Width (CSS value)" },
      { name: "height", type: "number", defaultValue: 16, description: "Height in pixels" },
      { name: "borderRadius", type: "number", defaultValue: 4, description: "Border radius in pixels" },
    ],
    render: (props) => (
      <Skeleton
        width={props.width as string}
        height={props.height as number}
        borderRadius={props.borderRadius as number}
      />
    ),
    variants: [
      { name: "Line", props: { width: "100%", height: 14 } },
      { name: "Title", props: { width: "60%", height: 20 } },
      { name: "Avatar", props: { width: "40px", height: 40, borderRadius: 9999 } },
      { name: "Card", props: { width: "100%", height: 80, borderRadius: 8 } },
    ],
    codeTemplate: `<Skeleton width="100%" height={16} />`,
  });

  registerComponent({
    name: "Overlay",
    description: "Fixed full-screen backdrop for modals and overlays.",
    category: "atom",
    propDefs: [
      { name: "zIndex", type: "number", defaultValue: 100, description: "CSS z-index" },
    ],
    render: (props) => (
      <div style={{ position: "relative", height: 80, overflow: "hidden", borderRadius: 4 }}>
        <div style={{ padding: 12, color: "#e0e0e0" }}>Content behind overlay</div>
        <Overlay
          zIndex={props.zIndex as number}
          style={{ position: "absolute" }}
          onClick={() => {}}
        />
      </div>
    ),
    variants: [],
    codeTemplate: `<Overlay onClick={onClose} zIndex={100} />`,
  });

  // -------------------------------------------------------------------------
  // Molecules
  // -------------------------------------------------------------------------

  registerComponent({
    name: "Card",
    description: "Container with variant-specific styling (bordered, flat, elevated, live).",
    category: "molecule",
    propDefs: [
      { name: "variant", type: "enum", defaultValue: "default", options: ["default", "flat", "elevated", "live"], description: "Card style variant" },
      { name: "hover", type: "boolean", defaultValue: false, description: "Enable hover lift effect" },
      { name: "children", type: "string", defaultValue: "Card content goes here", description: "Card content" },
    ],
    render: (props) => (
      <Card variant={props.variant as "default" | "flat" | "elevated" | "live"} hover={props.hover as boolean}>
        <span>{String(props.children)}</span>
      </Card>
    ),
    variants: [
      { name: "Default", props: { variant: "default", children: "Default card" } },
      { name: "Flat", props: { variant: "flat", children: "Flat card" } },
      { name: "Elevated", props: { variant: "elevated", children: "Elevated card" } },
      { name: "Live", props: { variant: "live", children: "Live card (animated)" } },
      { name: "Hoverable", props: { variant: "default", hover: true, children: "Hover me!" } },
    ],
    codeTemplate: `<Card variant="default" hover>\n  <p>Content</p>\n</Card>`,
  });

  registerComponent({
    name: "Stack",
    description: "Thin flexbox wrapper with direction, gap, and alignment props.",
    category: "molecule",
    propDefs: [
      { name: "direction", type: "enum", defaultValue: "row", options: ["row", "column"], description: "Flex direction" },
      { name: "gap", type: "enum", defaultValue: "md", options: ["xs", "sm", "md", "lg", "xl"], description: "Gap between items" },
      { name: "wrap", type: "boolean", defaultValue: false, description: "Allow flex wrapping" },
    ],
    render: (props) => (
      <Stack
        direction={props.direction as "row" | "column"}
        gap={props.gap as "xs" | "sm" | "md" | "lg" | "xl"}
        wrap={props.wrap as boolean}
      >
        <Badge variant="active">Item 1</Badge>
        <Badge variant="area">Item 2</Badge>
        <Badge variant="recurrence">Item 3</Badge>
      </Stack>
    ),
    variants: [
      { name: "Row", props: { direction: "row", gap: "md" } },
      { name: "Column", props: { direction: "column", gap: "md" } },
      { name: "Tight", props: { direction: "row", gap: "xs" } },
      { name: "Wrapped", props: { direction: "row", gap: "sm", wrap: true } },
    ],
    codeTemplate: `<Stack direction="row" gap="md">\n  <Child />\n  <Child />\n</Stack>`,
  });

  registerComponent({
    name: "EmptyState",
    description: "Centered icon + message for zero-data states.",
    category: "molecule",
    propDefs: [
      { name: "icon", type: "string", defaultValue: "inbox", description: "Material Symbol icon name" },
      { name: "message", type: "string", defaultValue: "No items yet", description: "Message text" },
      { name: "variant", type: "enum", defaultValue: "plain", options: ["plain", "card"], description: "Render variant" },
    ],
    render: (props) => (
      <EmptyState
        icon={props.icon as string}
        message={props.message as string}
        variant={props.variant as "plain" | "card"}
      />
    ),
    variants: [
      { name: "Plain", props: { icon: "inbox", message: "Nothing here yet" } },
      { name: "Card", props: { icon: "search", message: "No results found", variant: "card" } },
    ],
    codeTemplate: `<EmptyState icon="inbox" message="No items yet" variant="card" />`,
  });

  registerComponent({
    name: "ThemeSwitcher",
    description: "Dropdown to switch the active application theme.",
    category: "molecule",
    propDefs: [],
    render: () => <ThemeSwitcher />,
    variants: [],
    codeTemplate: `<ThemeSwitcher />`,
  });
}

// ---------------------------------------------------------------------------
// Exported initialization
// ---------------------------------------------------------------------------

export function initializeGallery(): void {
  ensureRegistered(registerAllComponents);
}
