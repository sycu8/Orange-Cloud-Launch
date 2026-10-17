/**
 * WebMCP tools for the public site. Registers when the browser exposes
 * document.modelContext, and falls back to navigator.modelContext.
 */

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>;
};

type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<unknown>;
};

const SECTIONS = ["project", "how-it-works", "how-to", "value", "where", "faq"] as const;

const emptyObject = {
  type: "object" as const,
  properties: {},
  additionalProperties: false,
};

export const webMcpTools: WebMcpTool[] = [
  {
    name: "describe_oclaunch",
    description:
      "Describe OCLaunch: what it does, who it is for, and how a founder starts a project.",
    inputSchema: emptyObject,
    async execute() {
      return text(
        "OCLaunch by Orangecloud helps solo founders capture a release, collect a focused review of one user task, export a fix note, and record what improved. The public site is https://launch.orangecloud.vn/. New projects are private. Sign in with a passkey at /signin, then add a project at /app/new. Public projects are listed at /discover.",
      );
    },
  },
  {
    name: "jump_to_section",
    description: "Scroll the OCLaunch homepage to a named section.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: [...SECTIONS],
          description: "Homepage section id.",
        },
      },
      required: ["section"],
      additionalProperties: false,
    },
    async execute(input) {
      const section = String(input.section ?? "");
      if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) {
        return text(`Unknown section. Choose one of: ${SECTIONS.join(", ")}.`);
      }
      if (window.location.pathname !== "/") {
        window.location.assign(`/#${section}`);
        return text(`Opening /#${section}.`);
      }
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/#${section}`);
      return text(`Scrolled to ${section}.`);
    },
  },
  {
    name: "open_discover",
    description: "Open the OCLaunch Discover page of public projects.",
    inputSchema: emptyObject,
    async execute() {
      window.location.assign("/discover");
      return text("Opening Discover.");
    },
  },
  {
    name: "start_project",
    description: "Open the passkey sign-in page so a person can add a project.",
    inputSchema: emptyObject,
    async execute() {
      window.location.assign("/signin?next=/app/new");
      return text("Opening passkey sign-in. After sign-in, OCLaunch continues to the new project form.");
    },
  },
  {
    name: "set_language",
    description: "Switch the OCLaunch interface between English and Vietnamese.",
    inputSchema: {
      type: "object",
      properties: {
        lang: {
          type: "string",
          enum: ["en", "vi"],
          description: "en for English, vi for Vietnamese.",
        },
      },
      required: ["lang"],
      additionalProperties: false,
    },
    async execute(input) {
      const lang = input.lang === "vi" ? "vi" : "en";
      try {
        localStorage.setItem("oclaunch.lang", lang);
      } catch {
        /* ignore private-mode storage failures */
      }
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.location.assign(url.toString());
      return text(lang === "vi" ? "Đang chuyển sang tiếng Việt." : "Switching to English.");
    },
  },
];

let registered = false;

export function registerWebMcpTools(): void {
  if (registered || typeof window === "undefined") return;
  const context = modelContext();
  if (!context) {
    window.addEventListener("load", () => registerWebMcpTools(), { once: true });
    return;
  }
  registered = true;
  const controller = new AbortController();
  window.addEventListener("pagehide", () => controller.abort(), { once: true });
  for (const tool of webMcpTools) {
    void context.registerTool(tool, { signal: controller.signal }).catch(() => {
      /* The page still works if a browser rejects a tool definition. */
    });
  }
}

function modelContext(): ModelContext | undefined {
  const doc = document as Document & { modelContext?: ModelContext };
  const nav = navigator as Navigator & { modelContext?: ModelContext };
  return doc.modelContext ?? nav.modelContext;
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}
