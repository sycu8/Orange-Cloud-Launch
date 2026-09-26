import { z } from "zod";
import {
  FINDING_CATEGORIES,
  FINDING_STATES,
  RELEASE_ENVIRONMENTS,
  RESERVED_SLUGS,
} from "./constants.js";

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** https with no userinfo, or http loopback. Anything else is invalid. */
export function projectUrlKind(value: string): "https" | "loopback-http" | "invalid" {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  if (url.username || url.password) return "invalid";
  if (url.protocol === "https:") return "https";
  if (url.protocol === "http:" && isLoopbackHostname(url.hostname)) return "loopback-http";
  return "invalid";
}

function projectUrlSchema(allowLoopbackHttp: boolean) {
  return z.string().refine(
    (value) => {
      const kind = projectUrlKind(value);
      if (kind === "https") return true;
      return allowLoopbackHttp && kind === "loopback-http";
    },
    { message: "URL must be https" },
  );
}

export const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case")
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), {
    message: "Slug is reserved",
  });

export function buildCreateProjectSchema(opts?: { allowLoopbackHttp?: boolean }) {
  const url = projectUrlSchema(Boolean(opts?.allowLoopbackHttp));
  return z.object({
    name: z.string().min(1).max(80),
    slug: slugSchema,
    description: z.string().max(500).default(""),
    purpose: z.string().min(1).max(280),
    audience: z.string().min(1).max(280),
    primaryTask: z.string().max(280).default(""),
    liveUrl: z.union([z.literal(""), url]).optional(),
    category: z.string().min(1).max(64).default("productivity"),
    visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  });
}

export const createProjectSchema = buildCreateProjectSchema();

export function buildUpdateProjectSchema(opts?: { allowLoopbackHttp?: boolean }) {
  return buildCreateProjectSchema(opts).partial();
}

export const updateProjectSchema = buildUpdateProjectSchema();

export function buildCreateReleaseSchema(opts?: { allowLoopbackHttp?: boolean }) {
  const url = projectUrlSchema(Boolean(opts?.allowLoopbackHttp));
  return z.object({
    label: z.string().min(1).max(80),
    sourceUrl: url,
    commitSha: z.string().max(64).optional(),
    deploymentId: z.string().max(128).optional(),
    environment: z.enum(RELEASE_ENVIRONMENTS).default("preview"),
    reviewedUrl: z.union([z.literal(""), url]).optional(),
  });
}

export const createReleaseSchema = buildCreateReleaseSchema();

export const createMissionSchema = z.object({
  title: z.string().min(1).max(120),
  instructions: z.string().min(1).max(2000),
  topicTags: z.array(z.string().max(40)).max(12).default([]),
  language: z.string().min(2).max(8).default("en"),
  state: z.enum(["draft", "open", "closed"]).default("open"),
});

export const submitReviewSchema = z.object({
  audienceFit: z.enum(["target_user", "peer", "unknown"]),
  outcome: z.enum(["completed", "with_help", "could_not_complete", "not_attempted"]),
  tried: z.string().min(1).max(4000),
  expected: z.string().min(1).max(4000),
  stuck: z.string().max(4000).default(""),
  observations: z.string().min(1).max(4000),
  pins: z
    .array(
      z.object({
        artifactId: z.string().min(1),
        xNorm: z.number().min(0).max(1),
        yNorm: z.number().min(0).max(1),
        note: z.string().max(500).default(""),
        viewportWidth: z.number().int().positive(),
        viewportHeight: z.number().int().positive(),
      }),
    )
    .max(20)
    .default([]),
});

export const triageFindingSchema = z.object({
  state: z.enum(FINDING_STATES),
  expectedVersion: z.number().int().positive(),
  dismissRationale: z.string().max(1000).optional(),
  acceptanceCriterion: z.string().max(1000).optional(),
});

/** Owner-logged observation so a solo founder can finish the loop without a second reviewer. */
export const createOwnerFindingSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  category: z.enum(FINDING_CATEGORIES).default("First-use experience"),
  severity: z.enum(["blocker", "high", "medium", "low"]).default("medium"),
  acceptanceCriterion: z.string().max(1000).optional(),
});

export const createBrandSchema = z.object({
  purpose: z.string().min(1).max(280),
  audience: z.string().min(1).max(280),
  tone: z.array(z.string().max(40)).min(1).max(8),
  colors: z.object({
    ink: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    canvas: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    surface: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    action: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    muted: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  direction: z.enum(["warm-practical", "crisp-utility"]).default("warm-practical"),
});

export const createChangeSetSchema = z.object({
  findingIds: z.array(z.string().min(1)).min(1).max(40),
  baseSha: z.string().min(7).max(64),
  brandVersionId: z.string().optional(),
});

export const createDomainSchema = z.object({
  hostname: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.orangecloud\.vn$/, "Must be <slug>.orangecloud.vn"),
  upstreamUrl: projectUrlSchema(false),
});

export const createVerificationSchema = z.object({
  findingId: z.string().min(1),
  checkedSha: z.string().max(64).optional(),
  criterion: z.string().min(1).max(1000),
  result: z.enum(["pass", "fail", "inconclusive"]),
  notes: z.string().max(2000).default(""),
});

export const moderationReportSchema = z.object({
  targetType: z.enum(["review", "finding", "user", "project"]),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const findingCategorySchema = z.enum(FINDING_CATEGORIES);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type TriageFindingInput = z.infer<typeof triageFindingSchema>;
export type CreateOwnerFindingInput = z.infer<typeof createOwnerFindingSchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type CreateChangeSetInput = z.infer<typeof createChangeSetSchema>;
