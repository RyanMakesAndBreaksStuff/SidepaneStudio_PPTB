# Design Context

## Overview

Side Pane Studio is a dense Power Platform authoring tool. Product surfaces prioritize clear controls, compact layouts, keyboard access, and theme consistency with the Power Platform host.

## Colors

`src/theme/tokens.ts` is the runtime source of truth. The Newsprint theme uses pure greys: paper surfaces with an ink-black primary in light mode, ink surfaces with a paper-white primary in dark mode, and a vermilion secondary (`accentAlt`) for hints. Controls use `stroke1` for dividers, `strokeAcc` for control borders, `fg3` for secondary icons, `accent` for focus and selected states, `accentBg` for selected fills, and `accentFg` for anything drawn on an accent fill. The code well reads only the `code*` tokens and is dark in both modes.

## Typography

Use the existing `font` and `mono` theme tokens from `src/theme/tokens.ts`; do not add component-local font families.

## Layout

Controls use compact density and the 0px `rS`/`rM` corner tokens (square controls); `rL` 4px is reserved for popups and callouts. Search pickers use a 32px field with a 1px border, 16px leading/trailing icons, and a 2px bottom accent while open. Popup width follows its field.

## Components

Picker affordances remain inside the field: search at leading edge, selected custom-only filter and clear action at trailing edge. Disabled, loading, error, empty, focused, and selected states must retain accessible names and keyboard behavior.
