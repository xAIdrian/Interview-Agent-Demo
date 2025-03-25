/**
 * Setup file for Tabulator dependencies
 * This provides Luxon to Tabulator for date formatting and sorting
 */

// Check if Luxon is already defined
if (typeof luxon === 'undefined') {
  // Create a simple stub for Luxon DateTime that provides basic functionality
  // This is used when the full Luxon library is not available
  window.luxon = {
    DateTime: {
      fromFormat: function(str, format) {
        // Simple date parsing for common formats
        let date = new Date(str);
        return {
          toJSDate: function() {
            return date;
          },
          toFormat: function(format) {
            // Very basic formatter that just returns the date string
            return date.toLocaleString();
          }
        };
      },
      fromJSDate: function(date) {
        return {
          toFormat: function(format) {
            return date.toLocaleString();
          }
        };
      }
    }
  };

  console.log("Created Luxon stub for Tabulator");
} 