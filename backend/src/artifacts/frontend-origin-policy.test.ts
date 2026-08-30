import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrontendOriginPolicy } from './frontend-origin-policy.js';

test('one policy preserves configured exact origins and Vercel preview API origins', () => {
  const policy = createFrontendOriginPolicy({
    frontendOrigins: 'https://custom.example, https://preview.example/',
    frontendUrl: 'http://localhost:4100',
  });

  assert.equal(policy.isApiOriginAllowed('https://custom.example'), true);
  assert.equal(policy.isApiOriginAllowed('https://preview.example'), true);
  assert.equal(policy.isApiOriginAllowed('http://localhost:4100'), true);
  assert.equal(
    policy.isApiOriginAllowed(
      'https://maizena-nextwave-pr-42-joshuapzzs-projects.vercel.app',
    ),
    true,
  );
  assert.equal(policy.isApiOriginAllowed('https://evil.vercel.app'), false);
  assert.equal(policy.isApiOriginAllowed('https://user:pass@custom.example'), false);
  assert.equal(policy.isApiOriginAllowed(undefined), true);
  assert.deepEqual(policy.frameAncestors, [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://maizena-nextwave-frontend.onrender.com',
    'https://maizena-nextwave.onrender.com',
    'https://maizena-nextwave.vercel.app',
    'https://maizena-nextwave-git-main-joshuapzzs-projects.vercel.app',
    'https://custom.example',
    'https://preview.example',
    'http://localhost:4100',
  ]);
});
