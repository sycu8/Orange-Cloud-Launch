import { buildPlainFixNote, isConnectedRevision, type BrandProfile } from "@oclaunch/shared";

type EnvLike = { DB: D1Database; ARTIFACTS: R2Bucket };

export async function buildAgentExport(
  env: EnvLike,
  projectId: string,
  changeSetId: string,
) {
  const changeSet = await env.DB.prepare(
    `SELECT * FROM change_sets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, changeSetId)
    .first<Record<string, unknown>>();
  if (!changeSet) throw new Error("change_set_not_found");

  const project = await env.DB.prepare(`SELECT * FROM projects WHERE id = ?`)
    .bind(projectId)
    .first<Record<string, unknown>>();

  const links = await env.DB.prepare(
    `SELECT finding_id FROM change_set_findings WHERE project_id = ? AND change_set_id = ?`,
  )
    .bind(projectId, changeSetId)
    .all<{ finding_id: string }>();

  const findings = [];
  for (const link of links.results ?? []) {
    const f = await env.DB.prepare(
      `SELECT id, title, body, category, severity, confidence, provenance, acceptance_criterion, state
       FROM findings WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, link.finding_id)
      .first();
    if (f) findings.push(f);
  }

  let brandProfile: BrandProfile | null = null;
  if (changeSet.brand_version_id) {
    const brand = await env.DB.prepare(
      `SELECT profile_json FROM brand_versions WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, changeSet.brand_version_id)
      .first<{ profile_json: string }>();
    if (brand) brandProfile = JSON.parse(brand.profile_json) as BrandProfile;
  }

  const exportedFindings = findings.map((f) => ({
    id: (f as { id: string }).id,
    title: (f as { title: string }).title,
    body: (f as { body: string }).body,
    category: (f as { category: string }).category,
    severity: (f as { severity: string }).severity,
    confidence: (f as { confidence: string }).confidence,
    provenance: (f as { provenance: string }).provenance,
    acceptanceCriterion: (f as { acceptance_criterion: string | null }).acceptance_criterion,
    state: (f as { state: string }).state,
  }));
  const baseSha = String(changeSet.base_sha ?? "");
  const plainPrompt = buildPlainFixNote({
    projectName: typeof project?.name === "string" ? project.name : null,
    purpose: typeof project?.purpose === "string" ? project.purpose : null,
    audience: typeof project?.audience === "string" ? project.audience : null,
    liveUrl: typeof project?.live_url === "string" ? project.live_url : null,
    baseSha,
    findings: exportedFindings,
  });

  return {
    format: "oclaunch.agent-export.v1",
    generatedAt: new Date().toISOString(),
    plainPrompt,
    instructions: [
      "Inspect the existing repository before editing. Do not invent filenames from a URL-only scan.",
      "Preserve working behavior outside the accepted findings.",
      "Do not change auth, permissions, billing, schema, workflow files, or backend behavior unless a finding explicitly requires it and the owner approved that scope.",
      "Do not delete, skip, or rewrite tests so they pass. If a test fails, leave it failing and list it under untested scope with the reason.",
      "Return before/after notes and list untested scope.",
    ],
    project: {
      id: projectId,
      name: project?.name,
      slug: project?.slug,
      purpose: project?.purpose,
      audience: project?.audience,
      liveUrl: project?.live_url,
    },
    changeSet: {
      id: changeSetId,
      baseSha,
      connected: isConnectedRevision(baseSha),
      brandVersionId: changeSet.brand_version_id,
    },
    brandProfile,
    brandTokensJson: brandProfile,
    findings: exportedFindings,
    constraints: {
      supportedAutoPrProfile: "React/Vite + Tailwind",
      unsupportedFallback: "Use this export with the founder’s own coding agent.",
    },
  };
}
