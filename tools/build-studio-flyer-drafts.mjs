import fs from "node:fs";
import path from "node:path";

const root = "/Users/bridges/GITHUB/Dashboard-V3";
const outDir = path.join(root, "docs/Marketing/studio-services/drafts");
const logoPath = "../../../src/assets/checkmark-audio-logo.png";

const copy = {
  phone: "505-267-0558",
  address: ["Checkmark Audio", "5413 Lomas Blvd", "Albuquerque, NM 87110"],
};

const variants = [
  {
    slug: "checkmark-studio-services-draft-01-basement-show",
    title: "Draft 01 - Basement Show",
    headline: ["Record", "It", "Loud", "Make", "It", "Hit"],
    note: "Big torn-headline blocks, black ink, basement-show flyer energy.",
    paper: "#f5f0dc",
    ink: "#080808",
    accent: "#ffffff",
    accent2: "#d7d2c0",
    rotate: "-0.7deg",
    texture: "dots",
    border: "stripe",
  },
  {
    slug: "checkmark-studio-services-draft-02-pink-zine",
    title: "Draft 02 - Pink Zine",
    headline: ["Vocals", "Mixing", "Mastering", "Now"],
    note: "Photocopy zine style with one loud pink paper-strip accent.",
    paper: "#f7eddc",
    ink: "#050505",
    accent: "#ff2da0",
    accent2: "#ffffff",
    rotate: "0.9deg",
    texture: "halftone",
    border: "rough",
  },
  {
    slug: "checkmark-studio-services-draft-03-newsprint-rip",
    title: "Draft 03 - Newsprint Rip",
    headline: ["Track", "Mix", "Master", "Repeat"],
    note: "Old classified/newsprint feel with ripped blocks and a huge phone CTA.",
    paper: "#eee8d5",
    ink: "#111111",
    accent: "#c9ff3d",
    accent2: "#ffffff",
    rotate: "-1.2deg",
    texture: "newsprint",
    border: "double",
  },
  {
    slug: "checkmark-studio-services-draft-04-copy-machine",
    title: "Draft 04 - Copy Machine",
    headline: ["Studio", "Time", "$50", "Hour"],
    note: "Heavy xerox contrast, warning-label layout, and bold tear-off tabs.",
    paper: "#f1efdf",
    ink: "#000000",
    accent: "#00aaff",
    accent2: "#ffffff",
    rotate: "1.1deg",
    texture: "scanlines",
    border: "checker",
  },
];

function textureCss(type) {
  if (type === "halftone") {
    return `
      radial-gradient(circle at 1px 1px, rgba(0,0,0,.24) 1px, transparent 1.8px),
      radial-gradient(circle at 5px 5px, rgba(0,0,0,.13) 1px, transparent 2px)`;
  }
  if (type === "newsprint") {
    return `
      repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0 1px, transparent 1px 5px),
      radial-gradient(circle at 1px 1px, rgba(0,0,0,.16) 1px, transparent 2px)`;
  }
  if (type === "scanlines") {
    return `
      repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(0,0,0,.03) 0 1px, transparent 1px 8px)`;
  }
  return `
    radial-gradient(circle at 2px 2px, rgba(0,0,0,.18) 1px, transparent 2px),
    radial-gradient(circle at 8px 6px, rgba(0,0,0,.11) 1px, transparent 2px)`;
}

function edgeCss(border, ink) {
  if (border === "checker") {
    return `repeating-linear-gradient(90deg, ${ink} 0 .12in, transparent .12in .24in)`;
  }
  if (border === "double") {
    return `linear-gradient(${ink}, ${ink})`;
  }
  if (border === "rough") {
    return `repeating-linear-gradient(135deg, ${ink} 0 .08in, transparent .08in .15in)`;
  }
  return `repeating-linear-gradient(135deg, ${ink} 0 .055in, transparent .055in .12in)`;
}

function wordsHtml(words, variant) {
  return words.map((word, index) => {
    const light = index % 2 === 1 ? " light" : "";
    const skew = index % 3 === 2 ? " skew" : "";
    return `<span class="word${light}${skew}">${word}</span>`;
  }).join("\n        ");
}

function tabs(phone) {
  const labels = ["Book", "Record", "Mix", "Master", "Studio", "Music", "Consult"];
  return labels.map((label, index) =>
    `<div class="tab t${index + 1}"><b>${label}</b><span>${phone}</span></div>`
  ).join("\n        ");
}

function html(v) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${v.title}</title>
  <style>
    @page { size: Letter; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #222;
      color: ${v.ink};
      font-family: Impact, "Arial Black", Arial, Helvetica, sans-serif;
    }
    .page {
      position: relative;
      width: 8.5in;
      height: 11in;
      overflow: hidden;
      isolation: isolate;
      padding: .36in .42in .24in;
      background:
        ${textureCss(v.texture)},
        ${v.paper};
      background-size: 10px 10px, 14px 14px, auto;
    }
    .page::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: .28;
      background:
        repeating-linear-gradient(${v.rotate}, transparent 0 38px, rgba(0,0,0,.1) 39px, transparent 43px),
        repeating-linear-gradient(-9deg, transparent 0 62px, rgba(255,255,255,.42) 63px, transparent 65px);
      mix-blend-mode: multiply;
      z-index: -1;
    }
    .page::after {
      content: "";
      position: absolute;
      inset: .08in;
      border: .045in solid ${v.ink};
      pointer-events: none;
      box-shadow: inset 0 0 0 .025in ${v.paper}, inset 0 0 0 .04in ${v.ink};
    }
    .edge {
      position: absolute;
      left: -.2in;
      right: -.2in;
      height: .22in;
      background: ${edgeCss(v.border, v.ink)};
      opacity: .95;
    }
    .edge.top { top: .13in; transform: rotate(${v.rotate}); }
    .edge.bottom { bottom: .13in; transform: rotate(calc(${v.rotate} * -1)); }
    .brand {
      position: relative;
      display: grid;
      grid-template-columns: .82in 1fr;
      gap: .12in;
      align-items: center;
      margin: .18in 0 .12in;
      transform: rotate(${v.rotate});
    }
    .logo {
      display: grid;
      place-items: center;
      width: .78in;
      height: .78in;
      background: ${v.ink};
      border: .035in solid ${v.ink};
      box-shadow: .07in .07in 0 ${v.accent2};
    }
    .logo img {
      width: .6in;
      height: .6in;
      object-fit: contain;
      filter: contrast(1.3);
    }
    .brand-copy {
      background: ${v.ink};
      color: ${v.paper};
      padding: .08in .14in;
      box-shadow: .07in .07in 0 ${v.accent};
    }
    .brand-copy h2 {
      margin: 0;
      font-size: .35in;
      line-height: .85;
      text-transform: uppercase;
    }
    .brand-copy p {
      margin: .055in 0 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: .095in;
      font-weight: 950;
      letter-spacing: .18em;
      text-transform: uppercase;
    }
    .tags {
      display: flex;
      gap: .075in;
      margin: .08in 0 .12in;
      transform: rotate(calc(${v.rotate} * -1));
    }
    .tags span {
      display: inline-block;
      padding: .055in .08in;
      background: ${v.accent2};
      border: .035in solid ${v.ink};
      box-shadow: .04in .04in 0 ${v.ink};
      font-size: .145in;
      text-transform: uppercase;
    }
    .tags span:first-child {
      background: ${v.accent};
    }
    .headline {
      width: 7.35in;
      margin: .12in 0 .1in;
      transform: rotate(${v.rotate});
    }
    .word {
      display: inline-block;
      margin: 0 .04in .055in 0;
      padding: .018in .075in .038in;
      background: ${v.ink};
      color: ${v.paper};
      border: .035in solid ${v.ink};
      box-shadow: .045in .045in 0 ${v.accent2};
      font-size: .7in;
      line-height: .88;
      text-transform: uppercase;
    }
    .word.light {
      background: ${v.paper};
      color: ${v.ink};
      box-shadow: .045in .045in 0 ${v.ink};
    }
    .word.skew {
      transform: rotate(1.4deg) skew(-4deg);
    }
    .subhead {
      width: 7.1in;
      margin: .1in 0 .16in;
      padding: .12in .15in;
      background: ${v.ink};
      color: ${v.paper};
      border-left: .14in solid ${v.accent};
      outline: .03in solid ${v.ink};
      font-family: Arial, Helvetica, sans-serif;
      font-size: .16in;
      line-height: 1.16;
      font-weight: 950;
      transform: rotate(calc(${v.rotate} * -0.5));
    }
    .grid {
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: .18in;
      align-items: start;
    }
    .stack {
      display: grid;
      gap: .09in;
    }
    .service {
      min-height: .86in;
      padding: .1in .12in .095in;
      background: ${v.paper};
      border: .045in solid ${v.ink};
      box-shadow: .07in .07in 0 ${v.ink};
    }
    .service:nth-child(1) { transform: rotate(-.7deg); }
    .service:nth-child(2) { transform: rotate(.8deg); }
    .service:nth-child(3) { transform: rotate(-1deg); }
    .service .num {
      display: inline-block;
      margin-bottom: .035in;
      padding: .028in .055in;
      background: ${v.ink};
      color: ${v.paper};
      font-size: .086in;
      text-transform: uppercase;
    }
    .service h3 {
      margin: 0;
      font-size: .285in;
      line-height: .86;
      text-transform: uppercase;
    }
    .service p {
      margin: .05in 0 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: .092in;
      line-height: 1.2;
      font-weight: 950;
    }
    .rate {
      position: relative;
      min-height: 1.82in;
      padding: .15in;
      background: ${v.ink};
      color: ${v.paper};
      border: .045in solid ${v.ink};
      box-shadow: .08in .08in 0 ${v.accent};
      transform: rotate(calc(${v.rotate} * -1));
      overflow: hidden;
    }
    .rate::before {
      content: "";
      position: absolute;
      inset: -.2in;
      opacity: .22;
      background: repeating-linear-gradient(-38deg, transparent 0 .16in, ${v.accent2} .17in .19in);
    }
    .rate > * { position: relative; }
    .rate .label {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: .095in;
      font-weight: 950;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .price {
      margin: .03in 0;
      font-size: .66in;
      line-height: .9;
    }
    .regular {
      display: inline-block;
      padding: .045in .07in;
      background: ${v.paper};
      color: ${v.ink};
      font-family: Arial, Helvetica, sans-serif;
      font-size: .105in;
      font-weight: 950;
      text-transform: uppercase;
    }
    .fit {
      margin-top: .15in;
      padding: .13in;
      background: ${v.accent2};
      border: .045in solid ${v.ink};
      box-shadow: .07in .07in 0 ${v.ink};
      transform: rotate(${v.rotate});
    }
    .fit h3 {
      margin: 0 0 .075in;
      font-size: .28in;
      line-height: .86;
      text-transform: uppercase;
    }
    .fit ul {
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: .05in;
      list-style: none;
    }
    .fit li {
      padding: .038in .052in;
      border: .025in solid ${v.ink};
      background: ${v.paper};
      font-family: Arial, Helvetica, sans-serif;
      font-size: .088in;
      font-weight: 950;
      text-transform: uppercase;
    }
    .contact-row {
      position: absolute;
      left: .58in;
      right: .58in;
      bottom: 1.16in;
      display: grid;
      grid-template-columns: .92fr 1.08fr;
      gap: .16in;
      align-items: stretch;
    }
    .callout,
    .contact {
      border: .045in solid ${v.ink};
      box-shadow: .07in .07in 0 ${v.ink};
    }
    .callout {
      padding: .13in;
      background: ${v.accent};
      transform: rotate(calc(${v.rotate} * -1));
    }
    .callout h3 {
      margin: 0;
      font-size: .29in;
      line-height: .86;
      text-transform: uppercase;
    }
    .callout p {
      margin: .08in 0 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: .096in;
      line-height: 1.18;
      font-weight: 950;
    }
    .contact {
      padding: .13in;
      background: ${v.ink};
      color: ${v.paper};
      transform: rotate(${v.rotate});
    }
    .contact .label {
      margin: 0;
      font-size: .135in;
      text-transform: uppercase;
    }
    .phone {
      margin: .045in 0 .07in;
      font-size: .32in;
      line-height: .88;
    }
    .address {
      font-family: Arial, Helvetica, sans-serif;
      font-size: .1in;
      line-height: 1.22;
      font-weight: 950;
      text-transform: uppercase;
    }
    .tearoffs {
      position: absolute;
      left: .58in;
      right: .58in;
      bottom: .24in;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: .045in;
    }
    .tab {
      min-height: .75in;
      padding: .045in .035in;
      background: ${v.paper};
      border: .035in solid ${v.ink};
      text-align: center;
    }
    .tab:nth-child(odd) { transform: rotate(-1.2deg); }
    .tab:nth-child(even) { transform: rotate(1deg); }
    .tab b {
      display: block;
      font-size: .07in;
      line-height: 1;
      text-transform: uppercase;
    }
    .tab span {
      display: block;
      margin-top: .035in;
      font-family: Arial, Helvetica, sans-serif;
      font-size: .088in;
      line-height: 1.03;
      font-weight: 950;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      margin-left: auto;
      margin-right: auto;
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="edge top"></div>
    <div class="edge bottom"></div>
    <header class="brand">
      <div class="logo"><img src="${logoPath}" alt="Checkmark Audio logo"></div>
      <div class="brand-copy">
        <h2>Checkmark Audio</h2>
        <p>Recording studio / Albuquerque</p>
      </div>
    </header>
    <div class="tags">
      <span>Vocal recording</span>
      <span>Mixing</span>
      <span>Mastering</span>
    </div>
    <section class="headline">${wordsHtml(v.headline, v)}</section>
    <p class="subhead">
      Studio services for singers, rappers, bands, voiceover, demos, hooks, ad libs,
      and songs that need to sound finished.
    </p>
    <section class="grid">
      <div class="stack">
        <article class="service"><span class="num">01 / Track</span><h3>Vocal Recording</h3><p>Clean takes in a focused room. Bring the song, verse, script, or idea.</p></article>
        <article class="service"><span class="num">02 / Shape</span><h3>Mixing</h3><p>Balance, punch, space, and polish so your track feels alive.</p></article>
        <article class="service"><span class="num">03 / Finish</span><h3>Mastering</h3><p>Final loudness and clarity for sharing, streaming, and showing people.</p></article>
      </div>
      <div>
        <section class="rate"><p class="label">Summer vocal recording rate</p><div class="price">$50/hr</div><div class="regular">Regular rate $65/hr</div></section>
        <section class="fit"><h3>Good for</h3><ul><li>Singers</li><li>Rappers</li><li>Hooks</li><li>Demos</li><li>Voiceover</li><li>Ad libs</li><li>Bands</li><li>Creators</li></ul></section>
      </div>
    </section>
    <section class="contact-row">
      <div class="callout"><h3>Bring the track. We’ll help shape the sound.</h3><p>Call or text to book a session, ask about available times, or set up a free consult.</p></div>
      <div class="contact"><p class="label">Call or text</p><div class="phone">${copy.phone}</div><div class="address">${copy.address.join("<br>")}</div></div>
    </section>
    <section class="tearoffs">${tabs(copy.phone)}</section>
  </main>
</body>
</html>`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const variant of variants) {
  fs.writeFileSync(path.join(outDir, `${variant.slug}.html`), html(variant));
}
