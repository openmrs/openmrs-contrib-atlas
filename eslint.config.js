import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "openspec/",
      ".claude/",
      "web/test-results/",
      "web/playwright-report/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Apps Script: one global scope, globals provided by Google.
    files: ["apps-script/src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        SpreadsheetApp: "readonly",
        ScriptApp: "readonly",
        PropertiesService: "readonly",
        LockService: "readonly",
        UrlFetchApp: "readonly",
        Utilities: "readonly",
      },
    },
    rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off", "no-var": "off" },
  },
  {
    files: ["web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
