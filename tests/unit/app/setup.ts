import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans with Vitest globals enabled; this project keeps them off.
afterEach(() => {
  cleanup();
});
