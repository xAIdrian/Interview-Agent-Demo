import React from 'react';
import { parseVersion, formatVersion } from '../utils/version';

interface VersionDisplayProps {
  version: string;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ version }) => {
  const parsedVersion = parseVersion(version);
  const formattedVersion = formatVersion(parsedVersion);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        fontSize: '12px',
        color: '#666',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '2px 6px',
        borderRadius: '4px',
        zIndex: 1000,
      }}
    >
      {formattedVersion}
    </div>
  );
};

export default VersionDisplay; 
