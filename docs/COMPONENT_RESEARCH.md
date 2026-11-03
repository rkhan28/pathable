# Component research

Each library was judged on four criteria:
1. Accessibility semantics we would otherwise hand-roll.
2. Motion cost: does it move things nobody asked to move?
3. Licence.
4. Maintenance.

| Library | Used? | Why |
| --- | --- | --- |
| **Radix primitives** (`radix-ui`) | Yes: Dialog, AlertDialog, DropdownMenu, Popover, Tabs, Switch, Slider | Correct focus management, roles and keyboard models. Unstyled, so they take the Wayfinding tokens with no fighting. MIT. |
| **shadcn/ui** | Patterns only | We copy its approach (own the component source, style with tokens) but not its default look, which reads as generic. MIT. |
| **Motion for React** | Yes: card and details `layoutId` morph, sheet springs | Springs with velocity hand-off for the sheet. All tokens live in `src/lib/motion.ts`, and reduced motion is respected. MIT. |
| **Lucide** | Yes | Consistent 1.5 px stroke icons, tree-shaken. ISC. |
| **Sonner** | Yes, for non-critical toasts only | Small. Errors that block a task use the assertive live region and inline messages, never toasts. MIT. |
| **cmdk** | Yes: the command palette | Opens with ⌘K or Ctrl+K and loads on first use, so none of it ships with the page. MIT. |
| **Ark UI** | No | Strong state machines, but it would duplicate Radix. MIT. |
| **Magic UI** | No | Its components are decorative motion (marquees, number tickers, shimmer), which the design direction bans. MIT. |
| **Aceternity UI** | No | Its signature effects (aurora, spotlight, glowing cards) are on the banned list. |
| **React Bits** | No | Its licence is MIT plus the Commons Clause, which restricts selling. It is also motion-heavy. |
| **21st.dev** | No | A registry of community components with mixed licences and quality. Each piece would need its own review, and none solved a problem we had. |
| **Vaul** | No | It is unmaintained, and its drawer is modal, which is wrong for a map sheet: the map must stay usable behind it. The bottom sheet is our own non-modal component with keyboard snapping. |
| **MapLibre GL JS** | Yes | Open source vector maps with no vendor lock-in or key. BSD-3-Clause. |
| **TanStack Query, Zustand, Zod, React Hook Form, next-intl** | Yes | Each does one job. All are MIT. |

## What we built ourselves, and why

- **Route cards as a native radio group.** Arrow keys, form semantics and
  screen-reader announcements come free from `<input type="radio">`.
- **Bottom sheet.** It is non-modal, uses velocity-projected snapping with
  rubber-banding, and its handle is a real button with arrow-key snapping.
- **Combobox.** It follows WAI-ARIA 1.2 with `aria-activedescendant`. Radix has
  no combobox primitive, and cmdk is a command menu, not a form field.
- **Knowledge-state encoding.** Colour, line pattern and icon with a label.
  This is product-specific.
