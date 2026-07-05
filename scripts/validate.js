const fs = require("fs");
const path = require("path");
const {
  listJavaScriptFiles,
  listJsonFiles,
  listPackageFiles,
  root
} = require("./project-files");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

listJsonFiles().forEach(readJson);

listJavaScriptFiles().forEach((relativePath) => {
  new Function(fs.readFileSync(path.join(root, relativePath), "utf8"));
});

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");

if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json ${packageJson.version} does not match manifest.json ${manifest.version}`);
}

if (!changelog.includes(`## ${manifest.version}`)) {
  throw new Error(`CHANGELOG.md is missing an entry for ${manifest.version}`);
}

const action = manifest.action || manifest.browser_action;
const webAccessibleResources = (manifest.web_accessible_resources || []).flatMap((entry) => {
  if (typeof entry === "string") return [entry];
  return Array.isArray(entry.resources) ? entry.resources : [];
});
const referencedFiles = [
  action.default_popup,
  ...Object.values(action.default_icon || {}),
  ...Object.values(manifest.icons || {}),
  ...manifest.content_scripts.flatMap((script) => [...(script.js || []), ...(script.css || [])]),
  ...webAccessibleResources
];

referencedFiles.forEach((relativePath) => {
  if (relativePath.includes("*")) return;
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Manifest references missing file: ${relativePath}`);
  }
});

const builtInSheets = readJson("built-in-sheets.json");
builtInSheets.forEach((relativePath) => {
  if (typeof relativePath !== "string" || !relativePath.startsWith("sheets/") || !relativePath.endsWith(".json")) {
    throw new Error(`Invalid built-in sheet path: ${relativePath}`);
  }
});

const sheetIds = new Set();
builtInSheets.forEach((relativePath) => {
  const sheet = readJson(relativePath);
  if (!sheet.id || !/^[a-zA-Z0-9._-]+$/.test(sheet.id) || !Array.isArray(sheet.questions) || sheet.questions.length === 0) {
    throw new Error(`Invalid built-in sheet: ${relativePath}`);
  }

  if (sheetIds.has(sheet.id)) {
    throw new Error(`Duplicate built-in sheet id: ${sheet.id}`);
  }

  sheetIds.add(sheet.id);
  sheet.questions.forEach((question, index) => {
    if (!question || typeof question !== "object" || !("question" in question) || !("answer" in question)) {
      throw new Error(`Invalid question ${index + 1} in ${relativePath}`);
    }
  });
});

listPackageFiles().forEach((relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Package includes missing file: ${relativePath}`);
  }
});

console.log("Validation passed.");
