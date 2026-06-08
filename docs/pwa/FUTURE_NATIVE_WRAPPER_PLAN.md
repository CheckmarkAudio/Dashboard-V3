# Future Native Wrapper Plan

Purpose: keep native iOS/Android thinking documented without rushing into a second product before the PWA is proven.

## Current Decision

Do not start native app work yet.

Build the PWA first inside the current repo.

## Why PWA First

- fastest path to desktop and mobile app-like use
- no second codebase
- no App Store review
- no Apple Developer account required for first installable version
- lower maintenance cost
- lets us prove workflows before native packaging

## Future Native Candidate

Likely path if needed:

- Capacitor wrapper around the existing React/Vite app

Possible reasons to move native later:

- App Store / Play Store presence becomes important
- push notifications become central
- native file/media capabilities become necessary
- deeper device integrations become valuable
- team adoption proves the product should have store distribution

## Native Readiness Checklist

Before considering Capacitor:

- PWA install behavior is stable.
- Mobile auth is stable.
- P0 routes work well on phone.
- App icon is settled.
- Offline policy is clear.
- Service worker behavior is boring and predictable.
- Sensitive data caching decisions are documented.
- Production users are actively using the app.

## Native Risks

- increased testing burden
- app store review delays
- more build/deployment complexity
- deep-link/auth redirect complexity
- possible duplicate bug surfaces
- more maintenance cost

## Decision Gate

Revisit native wrapper only after:

- PWA foundation has shipped
- at least one mobile polish pass has shipped
- real users have tried installed app behavior
- we know what native-only capability is worth paying for
