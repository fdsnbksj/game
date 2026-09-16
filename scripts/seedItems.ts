import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ITEMS } from '../src/shared/items';

// Seeds the local emulator by default. For a real project:
//   gcloud auth application-default login
//   SEED_PROJECT_ID=<project-id> npm run seed
const seedProjectId = process.env.SEED_PROJECT_ID;
if (seedProjectId === '') {
  // An empty value would silently fall back to the emulator and keep retrying 127.0.0.1:8080.
  throw new Error('SEED_PROJECT_ID is set but empty');
}
const projectId = seedProjectId ?? 'demo-game';
if (!seedProjectId) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  // Skip the Google Cloud credentials probe; the emulator doesn't need it.
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}

const db = getFirestore(initializeApp({ projectId }));
const items = db.collection('items');
const batch = db.batch();

for (const { id, ...item } of ITEMS) {
  batch.set(items.doc(id), item);
}

// Drop items that are no longer in the catalog, so retired cosmetics can't be equipped.
const keep = new Set(ITEMS.map((item) => item.id));
const existing = await items.listDocuments();
const stale = existing.filter((doc) => !keep.has(doc.id));
for (const doc of stale) batch.delete(doc);

await batch.commit();
await db.terminate();

const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator (${projectId})` : projectId;
console.log(`Seeded ${ITEMS.length} items into ${target}${stale.length > 0 ? `, removed ${stale.length} stale` : ''}.`);
