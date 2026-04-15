# Font Visibility Draft Options

Open the localhost site and add `?draft=1` or `?draft=2` to the URL to preview each option.

## How to preview:
1. Make sure localhost is running: http://localhost:5173/Intern-Dashboard/
2. Open browser DevTools (Cmd+Option+I)
3. Paste the CSS from each draft file into the Console to preview

## Draft 1: Subtle — brighten colors only
- Grey text (#666 → #8a8a90, #999 → #b0b0b6)
- No font size changes
- Minimal visual impact

## Draft 2: Visible — brighten colors + bump sizes +1px
- Same color brightening as Draft 1
- All small fonts (8-13px) bumped up 1px each
- More readable but slightly larger

## Draft 3: Bold — brighten colors + bump sizes +2px
- Same color brightening
- All small fonts bumped up 2px
- Most readable, but changes the layout feel

Copy/paste CSS from the .css files into browser DevTools to preview each.
