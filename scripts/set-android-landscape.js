"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const manifestPath = path.resolve(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");

async function setLandscape() {
  let manifest;
  try {
    manifest = await fs.readFile(manifestPath, "utf8");
  } catch (error) {
    throw new Error(`Android project manifest not found at ${manifestPath}. Run "npm run android:add" first.`, { cause: error });
  }
  const activity = /<activity\b(?=[^>]*android:name="[^"]*MainActivity")[^>]*>/s;
  const match = manifest.match(activity);
  if (!match) throw new Error("Could not find the Android MainActivity element to set landscape orientation.");
  const updatedTag = match[0].includes("android:screenOrientation=")
    ? match[0].replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="landscape"')
    : match[0].replace(/>$/, ' android:screenOrientation="landscape">');
  await fs.writeFile(manifestPath, manifest.replace(activity, updatedTag));
  console.log("Set the Android game orientation to landscape.");
}

setLandscape().catch(error => {
  console.error("Could not configure Android landscape orientation.", error);
  process.exitCode = 1;
});
