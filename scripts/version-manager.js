const fs = require("fs");
const path = require("path");

const VERSION_FILE = path.join(
  __dirname,
  "../frontend/src/config/version.json"
);

// Read current version
const readVersion = () => {
  try {
    const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8"));
    return versionData;
  } catch (error) {
    // If file doesn't exist, create with initial version
    const initialVersion = {
      version: "v1.0.0+0",
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(VERSION_FILE, JSON.stringify(initialVersion, null, 2));
    return initialVersion;
  }
};

// Parse version string
const parseVersion = (versionString) => {
  const [version, build] = versionString.split("+");
  const [major, minor, patch] = version.replace("v", "").split(".").map(Number);
  return { major, minor, patch, build: parseInt(build) };
};

// Format version object
const formatVersion = (version) => {
  return `v${version.major}.${version.minor}.${version.patch}+${version.build}`;
};

// Increment build number
const incrementBuild = () => {
  const versionData = readVersion();
  const version = parseVersion(versionData.version);
  version.build++;

  const newVersion = formatVersion(version);
  const updatedData = {
    version: newVersion,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(VERSION_FILE, JSON.stringify(updatedData, null, 2));
  return newVersion;
};

// Increment patch version
const incrementPatch = () => {
  const versionData = readVersion();
  const version = parseVersion(versionData.version);
  version.patch++;
  version.build = 0;

  const newVersion = formatVersion(version);
  const updatedData = {
    version: newVersion,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(VERSION_FILE, JSON.stringify(updatedData, null, 2));
  return newVersion;
};

// Increment minor version
const incrementMinor = () => {
  const versionData = readVersion();
  const version = parseVersion(versionData.version);
  version.minor++;
  version.patch = 0;
  version.build = 0;

  const newVersion = formatVersion(version);
  const updatedData = {
    version: newVersion,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(VERSION_FILE, JSON.stringify(updatedData, null, 2));
  return newVersion;
};

// Increment major version
const incrementMajor = () => {
  const versionData = readVersion();
  const version = parseVersion(versionData.version);
  version.major++;
  version.minor = 0;
  version.patch = 0;
  version.build = 0;

  const newVersion = formatVersion(version);
  const updatedData = {
    version: newVersion,
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(VERSION_FILE, JSON.stringify(updatedData, null, 2));
  return newVersion;
};

// Export functions
module.exports = {
  readVersion,
  incrementBuild,
  incrementPatch,
  incrementMinor,
  incrementMajor,
};
