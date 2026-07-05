const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  listPackageFiles,
  root
} = require("./project-files");

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const distDir = path.join(root, "dist");
const baseName = `youtube-question-gate-${manifest.version}`;
const zipPath = path.join(distDir, `${baseName}.zip`);
const xpiPath = path.join(distDir, `${baseName}.xpi`);
const files = listPackageFiles();

fs.mkdirSync(distDir, { recursive: true });
fs.readdirSync(distDir)
  .filter((file) => file.endsWith(".zip") || file.endsWith(".xpi"))
  .forEach((file) => fs.unlinkSync(path.join(distDir, file)));

execFileSync("zip", ["-q", "-r", zipPath, ...files], { cwd: root });
execFileSync("zip", ["-q", "-r", xpiPath, ...files], { cwd: root });

console.log(`Created ${path.relative(root, zipPath)}`);
console.log(`Created ${path.relative(root, xpiPath)}`);
