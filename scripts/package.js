const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  listPackageFiles,
  root
} = require("./project-files");

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const distDir = path.join(root, "dist");
const packageName = `youtube-question-gate-${manifest.version}.zip`;
const packagePath = path.join(distDir, packageName);

fs.mkdirSync(distDir, { recursive: true });
fs.readdirSync(distDir)
  .filter((file) => file.endsWith(".zip") || file.endsWith(".xpi"))
  .forEach((file) => fs.unlinkSync(path.join(distDir, file)));

execFileSync("zip", ["-q", "-r", packagePath, ...listPackageFiles()], { cwd: root });
console.log(`Created ${path.relative(root, packagePath)}`);
