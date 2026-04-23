//src/utils/fileUrl.ts
export const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;

  // If absolute URL (like 127.0.0.1:8000), normalize to current host
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      return `${window.location.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  // If already relative (/media/...)
  return `${window.location.origin}${url}`;
};