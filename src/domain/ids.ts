/** Supplies new UUIDs; the app passes `() => crypto.randomUUID()`, tests pass a counter. */
export type IdSource = () => string;
