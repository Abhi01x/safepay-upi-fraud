import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise = null;

export async function getDeviceFingerprint() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}

export function getScreenResolution() {
  return `${window.screen.width}x${window.screen.height}`;
}

export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Unknown';
  }
}

let cachedIpData = null;

export async function getIpInfo() {
  if (cachedIpData) return cachedIpData;
  const fallback = { ip_address: '127.0.0.1', ip_country: 'IN', ip_city: 'Local', is_vpn: false };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    cachedIpData = {
      ip_address: data.ip || '',
      ip_country: data.country_code || 'IN',
      ip_city: data.city || 'Unknown',
      is_vpn: false,
    };
    return cachedIpData;
  } catch {
    cachedIpData = fallback;
    return fallback;
  }
}

export function getDeviceSignals() {
  return {
    screen_resolution: getScreenResolution(),
    timezone: getTimezone(),
  };
}
