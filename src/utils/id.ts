export function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  let id: string;

  if (cryptoApi?.randomUUID) {
    id = cryptoApi.randomUUID();
  } else if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } else {
    id = `${Date.now()}-${performance.now().toString(36)}`;
  }

  return `${prefix}-${id}`;
}
