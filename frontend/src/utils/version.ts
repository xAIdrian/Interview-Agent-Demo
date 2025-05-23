interface Version {
  major: number;
  minor: number;
  patch: number;
  build: number;
}

export const parseVersion = (versionString: string): Version => {
  const [version, build] = versionString.split('+');
  const [major, minor, patch] = version.replace('v', '').split('.').map(Number);
  return {
    major,
    minor,
    patch,
    build: build ? parseInt(build) : 0
  };
};

export const formatVersion = (version: Version): string => {
  return `v${version.major}.${version.minor}.${version.patch}+${version.build}`;
};

export const incrementBuild = (version: Version): Version => {
  return {
    ...version,
    build: version.build + 1
  };
};

export const incrementPatch = (version: Version): Version => {
  return {
    ...version,
    patch: version.patch + 1,
    build: 0
  };
};

export const incrementMinor = (version: Version): Version => {
  return {
    ...version,
    minor: version.minor + 1,
    patch: 0,
    build: 0
  };
};

export const incrementMajor = (version: Version): Version => {
  return {
    ...version,
    major: version.major + 1,
    minor: 0,
    patch: 0,
    build: 0
  };
}; 
