# PWA Install QA Checklist

Purpose: verify Checkmark Workspace installs and launches like an app before deeper mobile polish begins.

## Desktop Chrome

- Open production URL.
- Confirm install prompt appears or browser install action is available.
- Install app.
- Launch from installed app window.
- Confirm app name is `Checkmark Workspace`.
- Confirm icon is correct.
- Confirm theme color/header color is acceptable.
- Confirm app launches without browser address bar if supported.
- Login works.
- Refresh/reopen preserves expected session behavior.

## Android Chrome

- Open production URL in Chrome on Android.
- Confirm install prompt or "Add to Home screen" is available.
- Install app.
- Launch from home screen.
- Confirm app name and icon.
- Confirm standalone/fullscreen behavior.
- Confirm login works.
- Confirm Overview loads.
- Confirm basic navigation works.

## iPhone Safari

- Open production URL in Safari.
- Use Share -> Add to Home Screen.
- Confirm name can be `Checkmark Workspace`.
- Launch from home screen.
- Confirm status bar/theme behavior is acceptable.
- Confirm login works.
- Confirm keyboard does not break login or forms.
- Confirm app returns to expected route after relaunch.

## Install Failure Checks

If install is unavailable:

- Manifest link exists in `src/index.html`.
- Manifest is served with correct content type.
- Required icon sizes exist.
- `start_url` is valid.
- `display` is `standalone` or similar.
- App is served over HTTPS.
- Service worker requirements are met for install target.

## App Launch Checks

- App launches to the intended role-based home.
- User is not trapped on a blank screen.
- Auth loading state is visible.
- Network failure shows a clear reconnect message.
- No private data appears while unauthenticated.

## Pass Definition

Install QA passes when:

- desktop install works
- Android install works or has a documented browser/device limitation
- iPhone Add to Home Screen works
- login works from installed app launch
- no obvious app-shell regressions appear
