/** Public hostname that should appear in search. Staging and preview hosts stay out of the index. */
export const PRODUCTION_HOST = "launch.orangecloud.vn";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;

export function isIndexableHost(hostname: string): boolean {
  return hostname === PRODUCTION_HOST;
}

export function robotsTxt(hostname: string): string {
  if (!isIndexableHost(hostname)) {
    return "User-agent: *\nDisallow: /\n";
  }
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /app/",
    "Disallow: /signin",
    "Disallow: /review/",
    "",
    `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`,
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
