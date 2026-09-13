import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ITEMS } from '../src/shared/items';

// Seeds the local emulator by default. For a real project:
//   gcloud auth application-default login
//   SEED_PROJECT_ID=<project-id> npm run seed
const projectId = process.env.SEED_PROJECT_ID ?? 'demo-game';
if (!process.env.SEED_PROJECT_ID) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  // Skip the Google Cloud credentials probe; the emulator doesn't need it.
  process.env.METADATA_SERVER_DETECTION ??= 'none';
}

const db = getFirestore(initializeApp({ projectId }));
const batch = db.batch();
for (const { id, ...item } of ITEMS) {
  batch.set(db.collection('items').doc(id), item);
}
await batch.commit();

const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator (${projectId})` : projectId;
console.log(`Seeded ${ITEMS.length} items into ${target}.`);
