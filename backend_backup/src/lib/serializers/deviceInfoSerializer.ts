/**
 * Device Info Serializer
 * Normalizes device information from userAgent strings or deviceInfo JSONB
 * Provides consistent structure: { platform, os, browser, deviceType }
 */

export interface NormalizedDeviceInfo {
  platform?: string;
  os?: string;
  browser?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  raw?: string; // Original userAgent if parsed from string
}

/**
 * Normalize device info from userAgent string or existing deviceInfo JSONB
 * If deviceInfo exists, use it; otherwise parse userAgent
 */
export function normalizeDeviceInfo(
  deviceInfo: Record<string, unknown> | null | undefined,
  userAgent: string | null | undefined
): NormalizedDeviceInfo {
  // If deviceInfo already exists and has structure, use it
  if (deviceInfo && typeof deviceInfo === 'object') {
    const normalized: NormalizedDeviceInfo = {};
    
    if (deviceInfo.platform && typeof deviceInfo.platform === 'string') {
      normalized.platform = deviceInfo.platform;
    }
    if (deviceInfo.os && typeof deviceInfo.os === 'string') {
      normalized.os = deviceInfo.os;
    }
    if (deviceInfo.browser && typeof deviceInfo.browser === 'string') {
      normalized.browser = deviceInfo.browser;
    }
    if (deviceInfo.deviceType && typeof deviceInfo.deviceType === 'string') {
      normalized.deviceType = deviceInfo.deviceType as NormalizedDeviceInfo['deviceType'];
    }
    
    // If we got meaningful data, return it
    if (Object.keys(normalized).length > 0) {
      return normalized;
    }
  }
  
  // Fallback to parsing userAgent
  if (userAgent) {
    return parseUserAgent(userAgent);
  }
  
  return {};
}

/**
 * Parse userAgent string into normalized device info
 */
function parseUserAgent(userAgent: string): NormalizedDeviceInfo {
  const info: NormalizedDeviceInfo = {
    raw: userAgent
  };
  
  // Device type detection
  if (/mobile|android|iphone|ipad/i.test(userAgent)) {
    info.deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    info.deviceType = 'tablet';
  } else {
    info.deviceType = 'desktop';
  }
  
  // Browser detection
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
    info.browser = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    info.browser = 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    info.browser = 'Safari';
  } else if (/edge/i.test(userAgent)) {
    info.browser = 'Edge';
  } else if (/opera|opr/i.test(userAgent)) {
    info.browser = 'Opera';
  }
  
  // OS detection
  if (/windows/i.test(userAgent)) {
    info.os = 'Windows';
    // Try to detect Windows version
    const winVersion = userAgent.match(/Windows NT (\d+\.\d+)/);
    if (winVersion) {
      const version = parseFloat(winVersion[1]);
      if (version >= 10) info.os = 'Windows 10+';
      else if (version >= 6.3) info.os = 'Windows 8.1';
      else if (version >= 6.2) info.os = 'Windows 8';
      else if (version >= 6.1) info.os = 'Windows 7';
    }
  } else if (/mac/i.test(userAgent)) {
    info.os = 'macOS';
    const macVersion = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (macVersion) {
      info.os = `macOS ${macVersion[1].replace('_', '.')}`;
    }
  } else if (/linux/i.test(userAgent)) {
    info.os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    info.os = 'Android';
    const androidVersion = userAgent.match(/Android (\d+\.\d+)/);
    if (androidVersion) {
      info.os = `Android ${androidVersion[1]}`;
    }
  } else if (/ios|iphone|ipad/i.test(userAgent)) {
    info.os = 'iOS';
    const iosVersion = userAgent.match(/OS (\d+[._]\d+)/);
    if (iosVersion) {
      info.os = `iOS ${iosVersion[1].replace('_', '.')}`;
    }
  }
  
  // Platform detection (general category)
  if (/mobile|android|iphone/i.test(userAgent)) {
    info.platform = 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    info.platform = 'Tablet';
  } else {
    info.platform = 'Desktop';
  }
  
  return info;
}

