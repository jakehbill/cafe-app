const fs = require('fs');
const path = require('path');

/**
 * Expo's dotenv merge does not overwrite keys that already exist on `process.env`
 * (even if empty). That can hide `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from `.env`.
 * Read the project `.env` file directly when the process env value is missing.
 */
function resolveGooglePlacesApiKeyForExtra() {
  const fromProcess = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }

  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    const prefix = 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=';
    const line = content.split(/\r?\n/).find((l) => l.startsWith(prefix));
    if (!line) return '';
    let val = line.slice(prefix.length).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    return val.trim();
  } catch {
    return '';
  }
}

/**
 * Puts the key in `extra` so the client can read it via `expo-constants` when Metro
 * does not inline `process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`. `config` already includes merged `app.json`.
 */
module.exports = ({ config }) => {
  const googlePlaces = resolveGooglePlacesApiKeyForExtra();
  return {
    ...config,
    extra: {
      ...(typeof config.extra === 'object' && config.extra ? config.extra : {}),
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: googlePlaces,
    },
  };
};
