//src/utils/fileUrl.ts
export const resolveFileUrl = (url?: string | null) => {
  if (!url) return undefined;

  const API_BASE = process.env.REACT_APP_API_BASE_URL?.replace("/api", "");

  // absolute URL (normalize host)
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      return `${API_BASE}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  // relative (/media/...)
  return `${API_BASE}${url}`;
};