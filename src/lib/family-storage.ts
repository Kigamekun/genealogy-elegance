export const FAMILY_TREE_STORAGE_KEY = "safari-family.members.v1";
export const LEGACY_FAMILY_TREE_STORAGE_KEYS = [
  "genealogy-elegance.members.v4",
  "genealogy-elegance.members.v3",
] as const;
export const FAMILY_TREE_STORAGE_KEYS = [
  FAMILY_TREE_STORAGE_KEY,
  ...LEGACY_FAMILY_TREE_STORAGE_KEYS,
] as const;

async function clearIndexedDbDatabases() {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  const indexedDbFactory = window.indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof indexedDbFactory.databases !== "function") return;

  try {
    const databases = await indexedDbFactory.databases();
    await Promise.all(
      databases
        .map((database) => database.name)
        .filter((databaseName): databaseName is string => Boolean(databaseName))
        .map((databaseName) => new Promise<void>((resolve) => {
          const request = indexedDbFactory.deleteDatabase(databaseName);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })),
    );
  } catch {
    // Ignore IndexedDB cleanup failures and continue the recovery flow.
  }
}

export async function clearFamilyTreeBrowserCache() {
  if (typeof window === "undefined") return;

  try {
    FAMILY_TREE_STORAGE_KEYS.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Ignore storage cleanup failures and continue the recovery flow.
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore session cleanup failures and continue the recovery flow.
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    } catch {
      // Ignore Cache API cleanup failures and continue the recovery flow.
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // Ignore service worker cleanup failures and continue the recovery flow.
    }
  }

  await clearIndexedDbDatabases();
}
