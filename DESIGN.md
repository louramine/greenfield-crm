# Design

Greenfield CRM, Operate surface. Visual identity pinned to greenfield.plus (see PRODUCT.md, Brand Commitments). Written after the build, from the built world.

## Color

Restrained strategy on a committed dark shell: ink rail, deep green ground, light paper panels for dense data, mint for action and selection only.

| Token | Value | Role |
|---|---|---|
| `--gf-ink` | `#0a1410` | Rail, table headers, active segmented control |
| `--gf-bg` | `#0e1f17` | Page ground |
| `--gf-bg-2` | `#122a1f` | Sheets, filter controls |
| `--gf-line` / `--gf-line-strong` | `rgba(126,224,164,.14)` / `.28` | Hairlines and outlines on dark |
| `--gf-mint` | `#7ee0a4` | Primary buttons (ink text), selection, active nav, upcoming state |
| `--gf-mint-soft` | `#a8ebc2` | Primary hover |
| `--gf-mint-deep` | `#1f7a4d` | Accent text and bars on paper |
| `--gf-fg` / `--gf-fg-dim` | `#e8f2ea` / `#9cb3a3` | Text on dark |
| `--card-bg` | `#f4f9f5` | Paper panels, cards, tables, sheets of data |
| Text on paper | `#0a1410` / `#4f6a5c` | Primary / secondary (secondary meets 4.5:1) |
| Late | `#d9483b` on `#fbe3e0` | Overdue actions, refusals |
| Today | `#e3a13b` on `#fdf0d9` | Due today, waiting answers |
| WhatsApp | `#25D366` | WhatsApp actions only |

Zoning plaques (signature move), by zone family: B `#7ee0a4`, D `#cde88f`, I `#f2b860`, E `#9fcaff`, A `#78d6cb`, C `#c3b2ff`, R `#e2cf9e`, other `#d3dcd6`, ink text, mono 10.5px, radius 5px.

## Typography

- Archivo 800 to 900: page titles (uppercase, -0.02em), panel titles, key numbers.
- Inter Tight 400 to 700: all UI text, buttons, data.
- JetBrains Mono 500: small labels (form labels, table headers, zoning plaques, due chips), 11px minimum.
- Data uses tabular numerals.

## Shape and depth

Buttons and filters are pills (999px). Panels 16 to 18px radius, cards 14px. One soft shadow on paper over dark (`0 4px 24px rgba(0,0,0,.18)`). No coloured glows, no coloured side stripes: state is a dot or a chip.

## Components

- Action row: state dot, title and context, due chip, inline actions (Appeler, WhatsApp, Ouvrir, Noter, Fait).
- Counter strip: five outlined counters on the dark ground, each a link to its list.
- Segmented control (Moi / Équipe): ink fill when active.
- Bottom tab bar and + button on phone (900px and below); sheets slide from the bottom for filters, Plus and Ajouter.

## Motion

150 to 250 ms for state changes (hover, sheet slide, drag to close). No entrance choreography.
