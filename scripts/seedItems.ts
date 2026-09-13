import { initializeApp } from 'firebase-admin/app';
import { initializeFirestore } from 'firebase-admin/firestore';
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

// Production uses REST: gRPC batch commits timed out (DEADLINE_EXCEEDED) on GitHub Actions runners.
// The emulator stays on gRPC because the REST client insists on real credentials.
const db = initializeFirestore(initializeApp({ projectId }), { preferRest: !process.env.FIRESTORE_EMULATOR_HOST });
const batch = db.batch();
for (const { id, ...item } of ITEMS) {
  batch.set(db.collection('items').doc(id), item);
}
await batch.commit();
// Close the gRPC connection, or the process can stay alive after the write.
await db.terminate();

const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator (${projectId})` : projectId;
console.log(`Seeded ${ITEMS.length} items into ${target}.`);
