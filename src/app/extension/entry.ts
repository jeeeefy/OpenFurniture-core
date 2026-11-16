import type { AppExtension } from './types';

/**
 * Core build ships without an extension. The hosted (Pro) build aliases this
 * module to the proprietary client entry (plan §3.4 item 1).
 */
const extension: AppExtension | null = null;

export default extension;
