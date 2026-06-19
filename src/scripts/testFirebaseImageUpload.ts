/**
 * Smoke test for Firebase image storage.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/testFirebaseImageUpload.ts
 */
import { storeImage } from '@shared/services/imageStorage/firebase.storage';

const run = async () => {
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const url = await storeImage(
    {
      originalname: 'test.png',
      mimetype: 'image/png',
      buffer: pngBuffer,
    },
    {
      keyParts: ['users', 'test-user', 'avatar'],
      namePrefix: 'avatar',
    },
  );

  if (!url.startsWith('https://firebasestorage.googleapis.com/')) {
    throw new Error(`Unexpected URL: ${url}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Public URL not reachable: ${response.status} ${response.statusText}`);
  }

  console.log('Firebase image upload OK:', url);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Firebase image upload test failed:', err);
    process.exit(1);
  });
