---
description: Vet a code snippet copied from the web for malicious or sketchy patterns
allowed-tools: Bash, Read, Grep, WebFetch
---

You are running a security review of an untrusted code snippet. The user copied this from somewhere on the internet and wants to know if it's safe to run, paste, or commit. AV scanners are weak on raw source — your job is the AV here.

The snippet to review is in the user's prompt (after `/scan-snippet`), or in a file path they provided, or — if neither — ask them to paste it.

Be a **detective**, not a rubber stamp. A snippet looks innocent until you actually trace what it does. Skim is not enough.

---

## Verdict format

End your response with **one** of:

- ✅ **SAFE** — describe what it does in 1 sentence; recommend running normally.
- ⚠ **CAUTION** — list specific concerns; recommend running in `scripts/sandbox.sh` first.
- ❌ **DO NOT RUN** — list specific malicious patterns with line numbers; do not paste into the project.

Never say "looks fine" without explaining what it does. If you can't tell what something does (heavy obfuscation, unknown binary, opaque external fetch), default to ⚠ or ❌ — uncertainty is a finding.

---

## Patterns to scan for

Run through each category. Quote the offending line + line number when you flag something.

### 1. Remote-code execution
- `curl ... | sh` / `curl ... | bash` / `wget ... | sh` — pipes a remote script into a shell with no review.
- `iex (irm ...)` / `Invoke-Expression` — PowerShell equivalent.
- `eval(...)` over user input or fetched strings (JS/Python/Ruby/PHP).
- `new Function(...)` over a non-literal (JS).
- `exec(...)` / `subprocess` with shell=True over interpolated input.
- `os.system`, `child_process.exec` with non-literal args.

### 2. Network exfil
- Outbound HTTP/fetch to unfamiliar domains (Discord webhooks, telegram bots, pastebin, ngrok, requestbin, IP literals).
- `navigator.sendBeacon` to an unrelated domain.
- DNS exfil (`dig` / `nslookup` of suspicious subdomains).
- Reading `~/.ssh/`, `~/.aws/`, `.env`, `~/.config/gh/`, browser cookie stores, keychains, then transmitting.

### 3. Persistence / privilege
- Writes to `~/.bashrc`, `~/.zshrc`, `~/.profile`, `/etc/`, launchd plists, cron, systemd units.
- `chmod +s`, `sudo` invocations buried in scripts.
- npm/pip postinstall hooks (check `package.json` for `postinstall`/`preinstall`/`prepare` scripts).
- Browser extension that requests broad permissions.

### 4. Obfuscation
- Hex / base64 / unicode-escaped string blobs that are decoded then executed.
- Single-letter variable names + dense one-liners (typical malware shape).
- `String.fromCharCode(...)` chains, `\x..` escape walls.
- Minified code claiming to be source (always view the unminified version).

### 5. Supply-chain (if it's a dependency name)
- Typo-squat suspects: name is one letter off a popular package (`crossenv` vs `cross-env`, `lodahs` vs `lodash`, `python-sqlite` vs `pysqlite3`).
- Recently published / very low download count for what claims to be a "popular utility".
- For a specific package name, optionally check: `npm view <name> versions time maintainers`.

### 6. Credential / secret-stealers
- Reads `process.env`, `os.environ`, dotfiles, and ships them anywhere.
- Anything touching `~/.npmrc`, `~/.docker/config.json`, `~/.kube/config`.

### 7. Destructive
- `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `rm -rf "$DIR"` where `$DIR` could be empty.
- `dd of=/dev/...`, `mkfs.*`, `:(){ :|:& };:` (fork bomb).

---

## What "safe" actually looks like

- Pure-function utility code (sort, format, parse) with no I/O.
- Standard library calls, well-known framework patterns (React hooks, Express routes).
- I/O confined to the scope the snippet claims (a file parser only reads files; a UI component only renders).
- No string-built code execution, no opaque encoded blobs, no unfamiliar network destinations.

If it looks like documentation-quality code from a known framework's official docs, say so and mark ✅.

---

## When in doubt

Recommend running it via `scripts/sandbox.sh` (Docker isolation, network optional, throwaway). That's a containment strategy that works even when your review missed something — defense in depth.
