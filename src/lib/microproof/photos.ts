import { sha256Hex } from "./crypto";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("microproof", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("photos")) database.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open photo storage."));
  });
}

export async function savePhoto(hash: string, blob: Blob): Promise<void> {
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("photos", "readwrite");
    tx.objectStore("photos").put(blob, hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not store the photo."));
  });
  database.close();
}

export async function loadPhoto(hash: string): Promise<Blob | null> {
  const database = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = database.transaction("photos", "readonly");
    const request = tx.objectStore("photos").get(hash);
    request.onsuccess = () => {
      const result = request.result as Blob | undefined;
      resolve(result ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not read the photo."));
  });
  database.close();
  return blob;
}

export async function compressPhoto(file: File): Promise<{ blob: Blob; hash: string }> {
  const bitmap = await createImageBitmap(file);
  const max = 960;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not compress that image."))), "image/jpeg", 0.72);
  });
  const hash = await sha256Hex(new Uint8Array(await blob.arrayBuffer()));
  return { blob, hash };
}
