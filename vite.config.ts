import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const DEV_SITE_URL = "http://localhost:8080";
const META_IMAGE_PATH = "logo-safari.png";

const normalizeSiteUrl = (value: string) => {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const toAbsoluteAssetUrl = (siteUrl: string, assetPath: string) => {
  const assetBase = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  return new URL(assetPath.replace(/^\/+/, ""), assetBase).toString();
};

const safariFamilyMetaPlugin = (siteUrl: string): Plugin => {
  const resolvedSiteUrl = siteUrl || DEV_SITE_URL;
  const ogImageUrl = toAbsoluteAssetUrl(resolvedSiteUrl, META_IMAGE_PATH);

  return {
    name: "safari-family-meta",
    transformIndexHtml(html) {
      return html
        .replaceAll("__SAFARI_FAMILY_SITE_URL__", resolvedSiteUrl)
        .replaceAll("__SAFARI_FAMILY_OG_IMAGE_URL__", ogImageUrl);
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = normalizeSiteUrl(
    env.VITE_SITE_URL ?? env.SITE_URL ?? env.URL ?? env.DEPLOY_PRIME_URL ?? env.DEPLOY_URL ?? "",
  );

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), safariFamilyMetaPlugin(siteUrl)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
