/**
 * Audio serialization utilities for persisting audio URLs.
 * Converts blob: URLs to data: URLs (base64) for persistence, and back on load.
 */

export async function blobUrlToDataUrl(url: string): Promise<string | null> {
  if (!url.startsWith("blob:")) return url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function dataUrlToBlobUrl(url: string): string {
  if (!url.startsWith("data:")) return url;

  try {
    const [header, data] = url.split(",");
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : "audio/mpeg";

    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([array], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}
