"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const appFiles = [
  "index.html",
  "styles.css",
  "game.js",
  "renderer3d.js",
  "three.min.js",
  "manifest.webmanifest",
  "service-worker.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

async function build() {
  await fs.mkdir(output, { recursive: true });
  await Promise.all(appFiles.map(file =>
    fs.copyFile(path.join(root, file), path.join(output, file))
  ));
  console.log(`Copied ${appFiles.length} app files to dist/.`);
}

build().catch(error => {
  console.error("Could not build the mobile web assets.", error);
  process.exitCode = 1;
});
