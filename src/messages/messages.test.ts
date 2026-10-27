import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { ENABLED_LOCALES, LOCALE_REGISTRY } from "@/i18n/locales";
import en from "./en-CA.json";
import fr from "./fr-CA.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") acc[key] = v;
    else Object.assign(acc, flatten(v, key));
    return acc;
  }, {});
}

/** Top-level ICU argument names in a message ("{count, plural, ...}" → count). */
function argumentNames(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      if (depth === 0) {
        const m = /^\{\s*([a-zA-Z_][\w]*)/.exec(message.slice(i));
        if (m) names.add(m[1]);
      }
      depth++;
    } else if (message[i] === "}") depth--;
  }
  return [...names].sort();
}

const catalogues = { "en-CA": flatten(en as Tree), "fr-CA": flatten(fr as Tree) };

describe("message catalogues", () => {
  it("every enabled locale has a catalogue", () => {
    for (const locale of ENABLED_LOCALES) expect(catalogues[locale]).toBeDefined();
  });

  it("French has exactly the same keys as English", () => {
    const enKeys = Object.keys(catalogues["en-CA"]).sort();
    const frKeys = Object.keys(catalogues["fr-CA"]).sort();
    expect(frKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !frKeys.includes(k))).toEqual([]);
  });

  it("placeholders match between languages", () => {
    const mismatches = Object.keys(catalogues["en-CA"]).filter(
      (k) => argumentNames(catalogues["en-CA"][k]).join() !== argumentNames(catalogues["fr-CA"][k] ?? "").join(),
    );
    expect(mismatches).toEqual([]);
  });

  it("every message is valid ICU syntax and non-empty", () => {
    for (const [locale, messages] of Object.entries(catalogues)) {
      for (const [key, message] of Object.entries(messages)) {
        expect(message.trim(), `${locale}:${key}`).not.toBe("");
        expect(() => new IntlMessageFormat(message, locale), `${locale}:${key}`).not.toThrow();
      }
    }
  });

  it("French is actually translated (not a copy of English)", () => {
    const keys = Object.keys(catalogues["en-CA"]);
    const identical = keys.filter((k) => catalogues["en-CA"][k] === catalogues["fr-CA"][k]);
    // Brand names, units and pure placeholders are legitimately identical.
    expect(identical.length / keys.length).toBeLessThan(0.06);
  });

  it("only complete translations are enabled", () => {
    for (const def of LOCALE_REGISTRY) {
      const enabled = (ENABLED_LOCALES as readonly string[]).includes(def.code);
      expect(enabled, def.code).toBe(def.status === "complete");
    }
  });

  it("right-to-left languages are registered as RTL", () => {
    expect(LOCALE_REGISTRY.find((l) => l.code === "ar")?.dir).toBe("rtl");
    expect(LOCALE_REGISTRY.find((l) => l.code === "ur")?.dir).toBe("rtl");
  });

  it("never promises a '100% safe' route outside a negation", () => {
    for (const messages of Object.values(catalogues)) {
      for (const [key, message] of Object.entries(messages)) {
        if (/100\s?%\s?(safe|sûr)/i.test(message)) expect(/never|no |n’|jamais|aucun/i.test(message), key).toBe(true);
      }
    }
  });
});
