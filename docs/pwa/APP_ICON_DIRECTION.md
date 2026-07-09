# App Icon Direction

Purpose: define the visual direction for Checkmark Workspace app icons before producing final assets.

## App Name

- Full name: `Checkmark Workspace`
- Short name: `Checkmark`

## Visual Principles

- recognizable at small sizes
- dark-mode native
- black/white/gold core
- purple may appear as a subtle accent
- should feel like a studio/workspace tool, not a generic SaaS app
- should remain related to Checkmark Audio branding

## Concept A: Desktop Portal

Description:

- simplified computer/desktop screen or app window
- Checkmark logo inside the screen
- gold highlight or small check indicator
- black/dark background

Why it fits:

- communicates workspace/app
- fits the "portal where tasks are managed" idea
- can become a strong app icon separate from the website header logo

Risks:

- too much detail at 192px or smaller
- must avoid looking like a generic monitor icon

## Concept B: Refined Current Logo

Description:

- adapt current Checkmark Audio microphone/headphones logo into a clean app icon
- dark rounded-square background
- high-contrast white mark
- gold detail/accent

Why it fits:

- fastest for PWA v1
- brand continuity
- lower risk

Risks:

- may feel more like "company logo" than "workspace app"

## Concept C: 8-Bit Studio Terminal

Description:

- pixel or 8-bit inspired logo treatment
- simplified Checkmark mark or microphone/headphones shape
- dark terminal-like square with gold/white pixels

Why it fits:

- memorable
- nods to creative tools and digital audio culture

Risks:

- may feel less premium/professional
- pixel art can fight the refined app direction

## Recommendation

For first PWA foundation:

- Explore Concept A as the preferred long-term app icon.
- Use Concept B if we need a quick, low-risk PWA v1 icon.
- Keep Concept C as an optional playful variant, not the default unless it clearly wins visually.

## Required Assets Later

- 192x192 app icon
- 512x512 app icon
- 512x512 maskable icon
- Apple touch icon
- favicon alignment if needed

## Claude Prompt Later

Create three app icon concepts for Checkmark Workspace based on `docs/pwa/APP_ICON_DIRECTION.md`.

Use black, white, checkmark gold, and a restrained purple accent. Do not redesign the website. Focus only on icon concepts:

1. Desktop Portal
2. Refined Current Logo
3. 8-Bit Studio Terminal

Return visual options and explain which one reads best at small mobile home-screen sizes.
