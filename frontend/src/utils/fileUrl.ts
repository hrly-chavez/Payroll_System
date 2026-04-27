//src/utils/fileUrl.ts
export const resolveFileUrl = (url?: string | null) => {
  if (!url) return undefined;

  // If already absolute → normalize host
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      return `${window.location.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  // Always force absolute path
  return `${window.location.origin}${url}`;
};