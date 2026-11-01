# Design Context

## Overview

Side Pane Studio is a dense Power Platform authoring tool. Product surfaces prioritize clear controls, compact layouts, keyboard access, and theme consistency with the Power Platform host.

## Colors

`src/theme/tokens.ts` is the runtime source of truth. The existing Kiln theme pairs charcoal surfaces with citron accents in dark mode and warm paper with olive accents in light mode. Controls use `stroke1` for borders, `fg3` for secondary icons, `accent` for focus and selected states, and `accentBg` for selected fills.

## Typography

Use the existing `font` and `mono` theme tokens from `src/theme/tokens.ts`; do not add component-local font families.

## Layout

Controls use compact density and the existing 2px corner token. Search pickers use a 32px field with a 1px border, 16px leading/trailing icons, and a 2px bottom accent while open. Popup width follows its field.

## Components

Picker affordances remain inside the field: search at leading edge, selected custom-only filter and clear action at trailing edge. Disabled, loading, error, empty, focused, and selected states must retain accessible names and keyboard behavior.
