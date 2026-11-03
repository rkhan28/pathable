#!/usr/bin/env node
// Turns docs/CASE_STUDY.md into src/content/case-study.ts for the /case-study page.
// Supports what the case study uses: headings, paragraphs and bullet lists
// (nested bullets fold into their parent). Tables stay in the markdown only.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const md = readFileSync(fileURLToPath(new URL("../../../docs/CASE_STUDY.md", import.meta.url)), "utf8");
const plain = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
const blocks = [];
for (const chunk of md.split(/\n\s*\n/)) {
  const c = chunk.trim();
  if (!c || c.startsWith("|")) continue;
  if (c.startsWith("# ")) blocks.push({ t: "h1", text: plain(c.slice(2)) });
  else if (c.startsWith("## ")) blocks.push({ t: "h2", text: plain(c.slice(3)) });
  else if (c.startsWith("- ")) {
    const items = [];
    for (const line of c.split("\n")) {
      if (/^- /.test(line)) items.push(line.slice(2));
      else if (/^\s+- /.test(line)) items[items.length - 1] += (items[items.length - 1].trim().endsWith(":") ? " " : "; ") + line.replace(/^\s+- /, "");
      else items[items.length - 1] += " " + line.trim();
    }
    blocks.push({ t: "ul", items: items.map(plain) });
  } else blocks.push({ t: "p", text: plain(c) });
}
const out = fileURLToPath(new URL("../src/content/case-study.ts", import.meta.url));
writeFileSync(out, `// Generated from docs/CASE_STUDY.md by scripts/build-case-study.mjs. Edit the markdown, then rerun.\nexport const CASE_STUDY = ${JSON.stringify(blocks, null, 1)} as const;\n`);
console.log(`wrote ${blocks.length} blocks`);
