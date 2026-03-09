# UI Style Guide — PwC Brand Dark/Light Theme

This document defines the design system used across the application. Use this as a reference when building new pages or components to maintain visual consistency.

## Design Philosophy

- Dark-first design with full light theme support
- Minimal, professional aesthetic inspired by PwC branding
- Subtle depth through layered surfaces (page > surface > raised > overlay)
- Orange (#d04a02) as the singular accent color
- Inter font family throughout
- Generous whitespace, 8px spacing grid
- Smooth 0.15s transitions on interactive elements
- 8px/12px border-radius for rounded but not bubbly feel

---

## Color Tokens (CSS Custom Properties)

### Dark Theme (default)

```css
:root {
  --c-page:          #1a1a1a;       /* App background */
  --c-surface:       #232323;       /* Cards, sidebar, panels */
  --c-raised:        #2d2d2d;       /* Elevated elements within surfaces */
  --c-overlay:       #363636;       /* Hover states on raised elements */
  --c-edge:          #3d3d3d;       /* Default borders */
  --c-edge-strong:   #525252;       /* Hover borders, emphasis borders */
  --c-fg:            #f2f2f2;       /* Primary text */
  --c-fg2:           #a3a3a3;       /* Secondary text, labels */
  --c-fg3:           #737373;       /* Tertiary text, icons, placeholders */
  --c-primary:       #d04a02;       /* PwC orange — buttons, active states */
  --c-primary-hover: #b83f02;       /* Button hover */
  --c-primary-fg:    #ffffff;       /* Text on primary background */
  --c-danger:        #e0301e;       /* Delete, errors */
  --c-success:       #2d8c3c;       /* Success states */
  --c-warn:          #ffb600;       /* Warnings, amber highlights */
  --c-primary-10:    rgba(208, 74, 2, 0.10);  /* Subtle primary bg */
  --c-primary-05:    rgba(208, 74, 2, 0.05);  /* Very subtle primary bg */
  --c-primary-15:    rgba(208, 74, 2, 0.15);
  --c-primary-30:    rgba(208, 74, 2, 0.30);
  --c-danger-10:     rgba(224, 48, 30, 0.10);
  --c-danger-20:     rgba(224, 48, 30, 0.20);
  --c-backdrop:      rgba(0, 0, 0, 0.50);     /* Modal overlay */
  --c-shadow:        rgba(0, 0, 0, 0.25);     /* Box shadows */
  --c-table-header:  rgba(45, 45, 45, 0.50);
  color-scheme: dark;
}
```

### Light Theme

Applied via `[data-theme="light"]` on the `<html>` element.

```css
[data-theme="light"] {
  --c-page:          #f5f5f0;       /* Warm off-white background */
  --c-surface:       #ffffff;
  --c-raised:        #f7f5f2;       /* Warm light gray */
  --c-overlay:       #edeae5;
  --c-edge:          #d9d4cc;       /* Warm border */
  --c-edge-strong:   #b5b0a8;
  --c-fg:            #2d2d2d;
  --c-fg2:           #5c5c5c;
  --c-fg3:           #8a8a8a;
  --c-primary:       #d04a02;       /* Same PwC orange */
  --c-primary-hover: #a33b02;       /* Slightly darker for contrast */
  --c-primary-fg:    #ffffff;
  --c-danger:        #c42a1a;
  --c-success:       #1e7a30;
  --c-warn:          #d49600;
  --c-backdrop:      rgba(0, 0, 0, 0.30);
  --c-shadow:        rgba(0, 0, 0, 0.10);
  --c-table-header:  rgba(247, 245, 242, 0.80);
  color-scheme: light;
}
```

---

## Typography

- **Font family:** `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`
- **Font import:** `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
- **Base line-height:** 1.5
- **Font smoothing:** `-webkit-font-smoothing: antialiased`

### Scale

| Usage | Size | Weight | Color | Letter-spacing |
|-------|------|--------|-------|----------------|
| Page title (h1) | 24px | 700 | `--c-fg` | -0.02em |
| Section title (h2) | 14px | 600 | `--c-fg` | — |
| Card title (h3) | 14px | 600 | `--c-fg` | — |
| Body text | 14px | 400 | `--c-fg` | — |
| Secondary text | 14px | 400 | `--c-fg2` | — |
| Meta / labels | 12-13px | 500 | `--c-fg2` | — |
| Small / captions | 11px | 500 | `--c-fg3` | — |

---

## Spacing & Layout

- **Grid unit:** 8px
- **Page max-width:** 900px, centered with `margin: 0 auto`
- **Page padding:** 40px
- **Card padding:** 16px
- **Card gap (in lists):** 8px
- **Section margin-bottom:** 40px

### App Shell

```
┌──────────┬────────────────────────────────┐
│ Sidebar  │     Main Content               │
│ (240px)  │     (flex: 1, scrollable)       │
│ fixed    │                                 │
│          │     ┌──────────────────────┐    │
│          │     │  page-container      │    │
│          │     │  max-width: 900px    │    │
│          │     │  padding: 40px       │    │
│          │     └──────────────────────┘    │
└──────────┴────────────────────────────────┘
```

---

## Components

### Buttons

**Primary** — Main actions (Start Recording, Save, etc.)
```css
.btn-primary {
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--c-primary);        /* #d04a02 */
  color: var(--c-primary-fg);          /* white */
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 1px 3px var(--c-shadow);
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--c-primary-hover); }
.btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }
```

**Secondary** — Alternate actions
```css
.btn-secondary {
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--c-raised);
  color: var(--c-fg);
  font-size: 14px;
  font-weight: 500;
}
.btn-secondary:hover { background: var(--c-overlay); }
```

**Danger** — Destructive actions (delete, stop)
```css
.btn-danger {
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--c-danger);         /* #e0301e */
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}
```

**Icon Button** — Small square buttons with just an icon
```css
.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  color: var(--c-fg3);
}
.btn-icon:hover { background: var(--c-raised); color: var(--c-fg); }
```

### Cards

```css
.card {
  padding: 16px;
  border-radius: 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-edge);
  transition: border-color 0.15s;
}
.card:hover { border-color: var(--c-edge-strong); }
```

### Meeting Cards (list items)

```css
.meeting-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-edge);
  cursor: pointer;
}
/* Icon container on the left */
.meeting-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--c-raised);
  color: var(--c-fg3);
}
/* Delete button appears on hover */
.meeting-card .btn-delete { opacity: 0; }
.meeting-card:hover .btn-delete { opacity: 1; }
```

### Form Inputs

```css
.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--c-edge);
  background: var(--c-raised);
  color: var(--c-fg);
  font-size: 14px;
}
.form-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-10);
}
.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--c-fg2);
  margin-bottom: 6px;
}
```

### Tags / Pills

```css
/* Standard tag pill */
.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--c-primary-10);
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 500;
}
/* Small tag pill (card meta) */
.tag-pill-sm {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--c-raised);
  font-size: 11px;
  font-weight: 500;
  color: var(--c-fg2);
}
/* Clickable suggestion tag */
.tag-suggestion-btn {
  cursor: pointer;
  border: 1px dashed var(--c-edge-strong);
  background: transparent;
}
.tag-suggestion-btn:hover {
  background: var(--c-primary-10);
  border-color: var(--c-primary);
  color: var(--c-primary);
}
```

### Tag Filter Bar

```css
.tag-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.tag-filter-btn {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--c-edge);
  background: transparent;
  color: var(--c-fg2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.tag-filter-btn.active {
  background: var(--c-primary);
  color: var(--c-primary-fg);
  border-color: var(--c-primary);
}
```

### Search Bar

```css
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--c-raised);
  border: 1px solid var(--c-edge);
  border-radius: 8px;
  color: var(--c-fg2);
  min-width: 200px;
}
.search-bar input {
  border: none;
  background: transparent;
  color: var(--c-fg);
  font-size: 14px;
  width: 100%;
}
.search-bar:focus-within {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-10);
}
```

### Sidebar

```css
.sidebar {
  position: fixed;
  inset: 0;
  width: 240px;
  right: auto;
  background: var(--c-surface);
  border-right: 1px solid var(--c-edge);
}
/* Logo area */
.sidebar-logo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--c-primary);
  color: var(--c-primary-fg);
}
/* Nav links */
.nav-link {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-fg2);
}
.nav-link:hover {
  background: var(--c-raised);
  color: var(--c-fg);
}
.nav-link.active {
  background: var(--c-primary-10);
  color: var(--c-primary);
}
```

### Toast Notifications

```css
.toast {
  padding: 12px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 12px var(--c-shadow);
  animation: slideIn 0.2s ease-out;
}
/* Variants */
.toast.success { background: var(--c-success); color: #fff; }
.toast.error   { background: var(--c-danger);  color: #fff; }
.toast.info    { background: var(--c-raised);   color: var(--c-fg); border: 1px solid var(--c-edge); }
```

### Modal / Dialog

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--c-backdrop);
  z-index: 50;
}
.modal-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  max-height: 80vh;
  background: var(--c-surface);
  border: 1px solid var(--c-edge);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px var(--c-shadow);
  z-index: 51;
}
```

### Slide-in Chat Panel

```css
.chat-panel {
  position: fixed;
  top: 0;
  right: -420px;          /* Hidden off-screen */
  width: 420px;
  height: 100vh;
  background: var(--c-surface);
  border-left: 1px solid var(--c-edge);
  box-shadow: -4px 0 24px var(--c-shadow);
  z-index: 60;
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.chat-panel.open { right: 0; }
```

### Toggle / Source Selector

```css
.source-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--c-edge);
  background: var(--c-raised);
  cursor: pointer;
  transition: all 0.15s;
}
.source-toggle.active {
  border-color: var(--c-primary);
  background: var(--c-primary-05);
}
```

### Suggestions Panel (live meeting)

```css
.suggestions-box {
  background: var(--c-surface);
  border: 1px solid var(--c-edge);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.suggestion-item {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 182, 0, 0.05);   /* Subtle amber */
  border: 1px solid rgba(255, 182, 0, 0.15);
  font-size: 13px;
  color: var(--c-warn);
  margin-top: 8px;
}
```

---

## Scrollbar

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--c-edge); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--c-edge-strong); }
```

---

## Focus States

```css
:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}
/* Input-specific focus */
.form-input:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-10);
}
```

---

## Animations

```css
@keyframes slideIn {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Icons

All icons use inline SVGs from the Lucide icon set with these consistent attributes:

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
```

Standard sizes:
- **Nav / sidebar:** 18px
- **Buttons:** 16px
- **Card meta:** 12px
- **Tags:** 12px

---

## Key Design Principles

1. **Surface layering:** page (darkest) > surface > raised > overlay (lightest). Each step is subtle (~10-15 brightness difference in dark mode).

2. **Single accent color:** PwC orange `#d04a02` is the only brand color. Use `--c-primary-10` for subtle backgrounds, `--c-primary` for active/hover states, `--c-primary-30` for stronger emphasis.

3. **Borders over shadows:** Components are primarily defined by 1px borders (`--c-edge`). Shadows are reserved for elevated elements (modals, toasts, dropdowns).

4. **Hover reveals:** Secondary actions (delete buttons, options) are hidden by default and revealed on hover with `opacity: 0 > 1`.

5. **Consistent border-radius:** 8px for inputs/buttons, 12px for cards/panels, 16px for modals, 999px for pills/tags.

6. **Warm light theme:** The light theme uses warm off-whites (#f5f5f0, #f7f5f2) instead of pure white for a softer look.

7. **Transition timing:** All interactive elements use `transition: all 0.15s` or `transition: [property] 0.15s`. Panels use `0.3s cubic-bezier(0.4, 0, 0.2, 1)`.
