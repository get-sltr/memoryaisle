// Dynamic Expo configuration
// This file reads environment variables and injects them into the app
// Create a .env file with your values (see .env.example)

module.exports = function expoConfig({ config }) {
  return {
    ...config,
    extra: {
      ...config.extra,
      // Supabase configuration
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      // Picovoice for wake word detection
      picovoiceAccessKey: process.env.PICOVOICE_ACCESS_KEY || '',
    },
  };
};
