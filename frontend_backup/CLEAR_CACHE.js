// Run this in browser DevTools Console to clear all caches and storage

console.log('🧹 Clearing all caches and storage...');

// 1. Clear localStorage
try {
  localStorage.clear();
  console.log('✅ LocalStorage cleared');
} catch (e) {
  console.error('❌ Failed to clear localStorage:', e);
}

// 2. Clear sessionStorage
try {
  sessionStorage.clear();
  console.log('✅ SessionStorage cleared');
} catch (e) {
  console.error('❌ Failed to clear sessionStorage:', e);
}

// 3. Clear all cookies for this domain
try {
  document.cookie.split(";").forEach((c) => {
    const eqPos = c.indexOf("=");
    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
  });
  console.log('✅ Cookies cleared');
} catch (e) {
  console.error('❌ Failed to clear cookies:', e);
}

// 4. Clear IndexedDB
async function clearIndexedDB() {
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
        console.log(`✅ Deleted IndexedDB: ${db.name}`);
      }
    }
  } catch (e) {
    console.error('❌ Failed to clear IndexedDB:', e);
  }
}
clearIndexedDB();

// 5. Unregister all service workers
async function unregisterServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('✅ Service Worker unregistered');
      }
      if (registrations.length === 0) {
        console.log('ℹ️ No service workers found');
      }
    }
  } catch (e) {
    console.error('❌ Failed to unregister service workers:', e);
  }
}
unregisterServiceWorkers();

// 6. Clear cache storage
async function clearCacheStorage() {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        console.log(`✅ Cache deleted: ${name}`);
      }
      if (cacheNames.length === 0) {
        console.log('ℹ️ No caches found');
      }
    }
  } catch (e) {
    console.error('❌ Failed to clear cache storage:', e);
  }
}
clearCacheStorage();

console.log('✨ Cache clearing complete! Please hard refresh (Ctrl+Shift+R)');

