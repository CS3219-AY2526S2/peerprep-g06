const BINARY_CHUNK_SIZE = 0x8000;

function toBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = [];

  for (let index = 0; index < bytes.length; index += BINARY_CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + BINARY_CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }

  return chunks.join('');
}

export function encodeYjsUpdateBase64(update: Uint8Array): string {
  return window.btoa(toBinaryString(update));
}

export function decodeYjsUpdateBase64(encodedUpdate: string): Uint8Array {
  const binary = window.atob(encodedUpdate);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
