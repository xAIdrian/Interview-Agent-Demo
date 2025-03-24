import { DateTime } from 'luxon';

// Make Luxon available globally for Tabulator
if (typeof window !== 'undefined') {
  (window as any).luxon = { DateTime };
}

/**
 * Configure Tabulator with required dependencies
 * This file should be imported before any Tabulator usage
 */
export const configureTabulatorDependencies = () => {
  // Already configured by the import above
  return true;
};

export default configureTabulatorDependencies; 