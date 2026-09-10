export const APP_VERSION = "1.1.1";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  publishedAt?: string;
  error?: string;
}

export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim();
  const clean2 = v2.replace(/^v/, "").trim();
  const parts1 = clean1.split(".").map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split(".").map(p => parseInt(p, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export async function checkForUpdates(currentVer = APP_VERSION): Promise<UpdateInfo> {
  try {
    const res = await fetch("https://api.github.com/repos/facundogrilloucc/NumLab/releases/latest", {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { available: false, currentVersion: currentVer, error: "No se encontraron releases publicados aún." };
      }
      return { available: false, currentVersion: currentVer, error: `Error ${res.status} al consultar GitHub.` };
    }

    const data = await res.json();
    const tagName: string = data.tag_name ?? "";
    const isNewer = compareSemver(tagName, currentVer) > 0;

    // Detect user platform
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
    const isMac = ua.includes("mac") || ua.includes("darwin");
    const isWin = ua.includes("win");

    let downloadUrl = data.html_url;
    let fileName: string | undefined;

    if (Array.isArray(data.assets)) {
      if (isMac) {
        const dmgAsset = data.assets.find((a: { name?: string }) => a.name?.endsWith(".dmg"));
        if (dmgAsset) {
          downloadUrl = dmgAsset.browser_download_url;
          fileName = dmgAsset.name;
        }
      } else if (isWin) {
        const exeAsset = data.assets.find((a: { name?: string }) => a.name?.endsWith(".exe"));
        if (exeAsset) {
          downloadUrl = exeAsset.browser_download_url;
          fileName = exeAsset.name;
        }
      }
    }

    return {
      available: isNewer,
      currentVersion: currentVer,
      latestVersion: tagName,
      releaseName: data.name || tagName,
      releaseNotes: data.body || "",
      releaseUrl: data.html_url,
      downloadUrl,
      fileName,
      publishedAt: data.published_at,
    };
  } catch (err: unknown) {
    return {
      available: false,
      currentVersion: currentVer,
      error: err instanceof Error ? err.message : "Error de red al comprobar actualizaciones.",
    };
  }
}

