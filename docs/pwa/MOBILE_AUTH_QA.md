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

## Mobile-Specific Risks

- Recovery/setup links opening in browser instead of installed app.
- Keyboard covering password fields or action buttons.
- Modals exceeding viewport height.
- iOS Safari treating storage/session differently than desktop Chrome.
- Installed app not sharing expected browser session.
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
- first-run personalization is skippable
- app theme choice can differ from website theme choice
- profile/banner media stays account-level across app and website

## Guardrails

- Do not change auth behavior in the same PR as broad visual mobile polish.
- Do not cache auth-sensitive responses in the service worker.
- Do not rely on private offline data.
- Test auth on production preview/prod, not only localhost.
- Do not make profile/banner setup mandatory before users can reach critical workflows.
