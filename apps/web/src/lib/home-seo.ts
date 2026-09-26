import { useEffect } from "react";
import type { Lang } from "./i18n";

const PRODUCTION_ORIGIN = "https://launch.orangecloud.vn";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Keep the homepage title, description, canonical, and robots aligned with the visible language. */
export function useHomeDocument(lang: Lang, t: (key: string) => string) {
  useEffect(() => {
    const previousTitle = document.title;
    const indexable = window.location.hostname === "launch.orangecloud.vn";
    const canonicalPath = lang === "vi" ? "/?lang=vi" : "/";
    const canonical = `${PRODUCTION_ORIGIN}${canonicalPath}`;

    document.title = t("home.seo.title");
    document.documentElement.lang = lang === "vi" ? "vi" : "en";
    upsertMeta("name", "description", t("home.seo.description"));
    upsertMeta("name", "keywords", t("home.seo.keywords"));
    upsertMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow");
    upsertMeta("name", "geo.region", "VN");
    upsertMeta("name", "geo.placename", "Vietnam");
    upsertMeta("property", "og:title", t("home.seo.title"));
    upsertMeta("property", "og:description", t("home.seo.description"));
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:locale", lang === "vi" ? "vi_VN" : "en_US");
    upsertMeta("property", "og:locale:alternate", lang === "vi" ? "en_US" : "vi_VN");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "OCLaunch");
    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", t("home.seo.title"));
    upsertMeta("name", "twitter:description", t("home.seo.description"));
    upsertLink("canonical", canonical);
    upsertLink("alternate", `${PRODUCTION_ORIGIN}/`, "en");
    upsertLink("alternate", `${PRODUCTION_ORIGIN}/?lang=vi`, "vi");
    upsertLink("alternate", `${PRODUCTION_ORIGIN}/`, "x-default");
    writeStructuredData(lang, t);

    return () => {
      document.title = previousTitle;
    };
  }, [lang, t]);
}

function writeStructuredData(lang: Lang, t: (key: string) => string) {
  const origin = PRODUCTION_ORIGIN;
  const pageUrl = lang === "vi" ? `${origin}/?lang=vi` : `${origin}/`;
  const faqs = ["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => ({
    "@type": "Question",
    name: t(`home.faq.${n}.q`),
    acceptedAnswer: {
      "@type": "Answer",
      text: t(`home.faq.${n}.a`),
    },
  }));
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://orangecloud.vn/#organization",
        name: "Orangecloud",
        url: "https://orangecloud.vn/",
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin + "/",
        name: "OCLaunch",
        description: t("home.seo.description"),
        inLanguage: ["en", "vi"],
        publisher: { "@id": "https://orangecloud.vn/#organization" },
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: t("home.seo.title"),
        description: t("home.seo.description"),
        inLanguage: lang === "vi" ? "vi" : "en",
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#app` },
        primaryImageOfPage: `${origin}/favicon.svg`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#app`,
        name: "OCLaunch",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: origin + "/",
        description: t("home.project.lead"),
        inLanguage: ["en", "vi"],
        availableLanguage: ["English", "Vietnamese"],
        areaServed: [
          { "@type": "Country", name: "Vietnam" },
          { "@type": "Place", name: "Worldwide" },
        ],
        provider: { "@id": "https://orangecloud.vn/#organization" },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        url: pageUrl,
        inLanguage: lang === "vi" ? "vi" : "en",
        mainEntity: faqs,
      },
    ],
  };

  let el = document.getElementById("oclaunch-ld");
  if (!el) {
    el = document.createElement("script");
    el.id = "oclaunch-ld";
    el.setAttribute("type", "application/ld+json");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(graph);
}
