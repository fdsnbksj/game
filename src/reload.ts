/**
 * An installed copy of an older version can fail against the current rules, and the
 * offline cache keeps serving it. Throw the cache away and start over. Progress is in
 * localStorage, which this leaves alone.
 */
export async function reloadFresh() {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Reloading is still worth a try.
  }
  location.reload();
}
