# Legacy frontend (read-only reference)

Snapshot of the pre-refactor static frontend (`src/main/resources/static/`).
Kept here only as a visual / animation reference. **Do not run, do not import
into the new app.** The new frontend lives in `apps/gomoku-cf/`.

## What's worth lifting

### Typewriter poem reveal — the main one
- **CSS**: `style.css` lines 102–126 — `.typewriter` plus the `@keyframes typing`
  + `@keyframes blink-caret` pair. The element starts with `width: 0` and
  `overflow: hidden`, then `steps(40, end)` ticks the width to 100% over 3.5 s,
  while the right border blinks orange to look like a cursor.
- **Trigger**: `script.js` lines 45–62 (`displayPoem`). Note the
  `void poemSection.offsetWidth` reflow trick on line 57 — that's what lets the
  same `.typewriter` class re-run from scratch on each win without a page
  reload.

### Caveat to fix when porting
The `steps(40, end)` count is hardcoded. Short poems finish revealing well
before the 3.5 s timer; long poems get cut off. Make the step count and
duration proportional to the actual character count.

## What to ignore here
- The REST + STOMP/SockJS plumbing in `script.js` (lines 1–35, 80+). It talks
  to the now-deleted Spring controllers and the hardcoded `"G"` AI player. The
  React/Workers version replaces all of it.
- The table-based board (`<table id="board">`) and 40×40 `td` styling. The
  React version will rebuild this with a more accessible structure.
- General layout (header, container, flex columns) — generic CSS, not worth
  copying verbatim.
