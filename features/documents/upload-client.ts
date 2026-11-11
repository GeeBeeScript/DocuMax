/** Browser-only helpers for direct-to-storage uploads. */

/** Hex sha256 of a file via Web Crypto, or undefined where it's unavailable (insecure contexts). */
export async function sha256Hex(file: Blob): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** PUT a file to a signed Storage URL, reporting progress (0–100). XHR because fetch has no upload progress. */
export function putWithProgress(
  url: string,
  file: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}
