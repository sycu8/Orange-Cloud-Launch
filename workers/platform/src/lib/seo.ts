/** Public hostname that should appear in search. Staging and preview hosts stay out of the index. */
export const PRODUCTION_HOST = "launch.orangecloud.vn";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;

export function isIndexableHost(hostname: string): boolean {
  return hostname === PRODUCTION_HOST;
}

function agentCatalogUrl(hostname: string): string {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://${hostname}/.well-known/ai-catalog.json`;
  }
  if (isIndexableHost(hostname)) {
    return `${PRODUCTION_ORIGIN}/.well-known/ai-catalog.json`;
  }
  return `https://${hostname}/.well-known/ai-catalog.json`;
}

export function robotsTxt(hostname: string): string {
  const agentmap = `Agentmap: ${agentCatalogUrl(hostname)}`;
  if (!isIndexableHost(hostname)) {
    return [
      "User-agent: *",
      "Disallow: /",
      "Content-Signal: ai-train=no, search=no, ai-input=no",
      "",
      agentmap,
      "",
    ].join("\n");
  }
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /signin",
    "Disallow: /review/",
    "Content-Signal: ai-train=no, search=yes, ai-input=no",
    "",
    `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
    agentmap,
    "",
  ].join("\n");
}

export function sitemapXml(): string {
  const pages = [
    { loc: `${PRODUCTION_ORIGIN}/`, priority: "1.0" },
    { loc: `${PRODUCTION_ORIGIN}/?lang=vi`, priority: "0.9" },
    { loc: `${PRODUCTION_ORIGIN}/discover`, priority: "0.6" },
  ];
  const urls = pages
    .map(
      (page) => `  <url>
    <loc>${page.loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${PRODUCTION_ORIGIN}/" />
    <xhtml:link rel="alternate" hreflang="vi" href="${PRODUCTION_ORIGIN}/?lang=vi" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${PRODUCTION_ORIGIN}/" />
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}
