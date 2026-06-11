# Mobile Auth QA

Purpose: keep authentication and account access stable while turning Checkmark into an installed app.

Auth is a P0 workflow. If this breaks, the app is not usable.

## Critical Flows

Test on mobile browser and installed app when possible:

1. Existing user login.
2. Logout from normal account controls.
3. Clock-out flow -> submit -> completion page/modal -> optional logout.
4. Setup link for a new teammate.
5. Temporary password first login.
6. Forced password change.
7. Forgot/reset password flow.
8. Session persistence after closing/reopening installed app.
9. Expired session behavior.
10. First-run app color-mode choice.
11. Profile picture prompt for users missing a profile image.
12. Banner image prompt for users missing a banner image.
13. Preview auto-login disabled in installed app context.

## Mobile-Specific Risks

- Recovery/setup links opening in browser instead of installed app.
- Keyboard covering password fields or action buttons.
- Modals exceeding viewport height.
- iOS Safari treating storage/session differently than desktop Chrome.
- Installed app not sharing expected browser session.
- Preview auto-login hiding the real login gate during installed-app QA.
- Redirect URLs returning to the wrong route.
- Logout not clearing local state visually.
- Personalization prompts blocking urgent access.
- Existing users with completed profile media being prompted again.

## QA Matrix

| Flow | Desktop browser | Desktop installed | iPhone Safari | iPhone home-screen | Android Chrome | Android installed |
|---|---|---|---|---|---|---|
| Login |  |  |  |  |  |  |
| Logout |  |  |  |  |  |  |
| Clock out + stay logged in |  |  |  |  |  |  |
| Clock out + logout |  |  |  |  |  |  |
| Setup link |  |  |  |  |  |  |
| Temp password |  |  |  |  |  |  |
| Recovery link |  |  |  |  |  |  |
| Reopen app |  |  |  |  |  |  |
| Preview auto-login disabled |  |  |  |  |  |  |
| Choose app mode |  |  |  |  |  |  |
| Add profile picture |  |  |  |  |  |  |
| Add banner image |  |  |  |  |  |  |
| Update later |  |  |  |  |  |  |

## Pass Definition

Auth QA passes when:

- users can get in
- users can get out
- new teammates can get access
- password reset/setup does not dead-end
- clock-out logout decision behaves as designed
- installed app relaunch does not create a confusing auth state
- installed preview app does not use preview auto-login; phone QA exercises real credentials or an existing real session
- first-run personalization is skippable
- app theme choice can differ from website theme choice
- profile/banner media stays account-level across app and website

## Guardrails

- Do not change auth behavior in the same PR as broad visual mobile polish.
- Do not cache auth-sensitive responses in the service worker.
- Do not rely on private offline data.
- Test auth on production preview/prod, not only localhost.
- Treat preview auto-login as browser-preview convenience only. Installed app QA must not rely on it.
- Do not make profile/banner setup mandatory before users can reach critical workflows.

## Installed App Auth Test Steps

Use these steps before any mobile layout polish PR merges:

1. Open the Vercel preview in Safari/Chrome and install it to the home screen.
2. Open the installed app.
3. If it opens directly to the workspace, use the app's logout path.
4. Fully close the installed app.
5. Reopen the installed app.
6. Confirm it lands on the sign-in screen.
7. Sign in with a real provisioned user.
8. Close and reopen again.
9. Confirm the valid session persists.
10. Log out again and confirm a final reopen returns to sign-in.
