import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = "/Users/bridges/GITHUB/Dashboard-V3";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = path.join(root, "docs/Marketing/studio-services/drafts");
const slugs = [
  "checkmark-studio-services-draft-01-basement-show",
  "checkmark-studio-services-draft-02-pink-zine",
  "checkmark-studio-services-draft-03-newsprint-rip",
  "checkmark-studio-services-draft-04-copy-machine",
];

function runChrome(args) {
  spawnSync(chrome, args, {
    cwd: root,
    timeout: 9000,
    stdio: "ignore",
  });
}

for (const [index, slug] of slugs.entries()) {
  const html = `file://${path.join(outDir, `${slug}.html`)}`;
  const png = path.join(outDir, `${slug}.png`);
  const pdf = path.join(outDir, `${slug}.pdf`);
  const userDataDir = `/private/tmp/chrome-studio-draft-${index + 1}`;

  runChrome([
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-background-networking",
    "--disable-sync",
    `--user-data-dir=${userDataDir}`,
    `--screenshot=${png}`,
    "--window-size=816,1056",
    html,
  ]);

  runChrome([
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-background-networking",
    "--disable-sync",
    `--user-data-dir=${userDataDir}-pdf`,
    `--print-to-pdf=${pdf}`,
    html,
  ]);

  console.log(`${slug}: png=${fs.existsSync(png)} pdf=${fs.existsSync(pdf)}`);
}
