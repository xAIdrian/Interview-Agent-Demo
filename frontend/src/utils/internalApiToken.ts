// Internal API token for backend communication
export const INTERNAL_API_TOKEN = process.env.NEXT_PUBLIC_INTERNAL_API_TOKEN || '';

// Validate that the token exists
if (!INTERNAL_API_TOKEN) {
  console.warn('Warning: NEXT_PUBLIC_INTERNAL_API_TOKEN is not set. API calls may fail.');
} 