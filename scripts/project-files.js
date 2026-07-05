const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function listJsonFiles() {
  return [
    "manifest.json",
    "package.json",
    "built-in-sheets.json",
    "question-sheet.schema.json",
    "sample-sheet.json",
    ...fs.readdirSync(path.join(root, "sheets"))
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => `sheets/${file}`)
  ];
}

function listJavaScriptFiles() {
  return [
    "shared/question-sheets.js",
    "content.js",
    "popup.js",
    "scripts/project-files.js",
    "scripts/validate.js",
    "scripts/test.js",
    "scripts/package.js"
  ];
}

function listPackageFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const action = manifest.action || manifest.browser_action || {};
  const webAccessibleResources = (manifest.web_accessible_resources || []).flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    return Array.isArray(entry.resources) ? entry.resources : [];
  });
  const contentScriptFiles = (manifest.content_scripts || [])
    .flatMap((script) => [...(script.js || []), ...(script.css || [])]);
  const staticFiles = [
    "LICENSE",
    "README.md",
    "manifest.json",
    action.default_popup,
    ...Object.values(action.default_icon || {}),
    ...Object.values(manifest.icons || {}),
    ...contentScriptFiles,
    ...webAccessibleResources,
    "popup.css",
    "popup.js",
    "question-sheet.schema.json",
    "sample-sheet.json"
  ].filter(Boolean);

  return Array.from(new Set(staticFiles.flatMap((file) => expandPackagePath(file)))).sort();
}

function expandPackagePath(relativePath) {
  if (!relativePath.includes("*")) return [relativePath];

  const directory = path.dirname(relativePath);
  const extension = path.extname(relativePath).replace(".", "");
  const absoluteDirectory = path.join(root, directory);
  return fs.readdirSync(absoluteDirectory)
    .filter((file) => !extension || file.endsWith(`.${extension}`))
    .sort()
    .map((file) => path.join(directory, file).replace(/\\/g, "/"));
}

module.exports = {
  root,
  listJavaScriptFiles,
  listJsonFiles,
  listPackageFiles
};
