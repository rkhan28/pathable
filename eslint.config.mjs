import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Stricter accessibility linting than eslint-config-next's defaults.
    rules: {
      ...Object.fromEntries(Object.keys(jsxA11y.flatConfigs.recommended.rules).map((r) => [r, "error"])),
      // Labels are associated via htmlFor/id helpers (Field) the rule can't follow.
      "jsx-a11y/label-has-associated-control": "off",
      // Deprecated in favour of label-has-associated-control; both are verified at runtime by axe-core in e2e.
      "jsx-a11y/label-has-for": "off",
      "jsx-a11y/control-has-associated-label": "off",
      // autoFocus is used once, deliberately, when the person arrives from the landing search.
      "jsx-a11y/no-autofocus": "off",
      // Radix/our own components forward roles correctly; the rule can't see through them.
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
      // Next's <img> rule: photo previews are local blob: URLs, which next/image can't optimise.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/vendor/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
