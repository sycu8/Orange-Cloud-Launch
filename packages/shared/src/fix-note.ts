import { UNCONNECTED_BASE_SHA } from "./constants.js";

export function isConnectedRevision(sha: string | null | undefined): boolean {
  const value = sha?.trim() ?? "";
  return value.length > 0 && value !== UNCONNECTED_BASE_SHA;
}

export type FixNoteFinding = {
  title: string;
  body?: string | null;
  acceptanceCriterion?: string | null;
};

export function buildPlainFixNote(input: {
  projectName?: string | null;
  purpose?: string | null;
  audience?: string | null;
  liveUrl?: string | null;
  baseSha?: string | null;
  findings: FixNoteFinding[];
}): string {
  const name = input.projectName?.trim() || "this project";
  const lines = [
    "OCLaunch fix note. The project owner accepted these problems.",
    "",
    `Fix them in the existing project "${name}".`,
    "Work in the real project files. Do not guess filenames from the website alone.",
  ];

  const purpose = input.purpose?.trim();
  const audience = input.audience?.trim();
  const liveUrl = input.liveUrl?.trim();
  if (purpose) lines.push(`What it is for: ${purpose}`);
  if (audience) lines.push(`Who it is for: ${audience}`);
  if (liveUrl) lines.push(`Live site: ${liveUrl}`);

  if (isConnectedRevision(input.baseSha)) {
    lines.push(`Start from code version: ${input.baseSha?.trim()}`);
  } else {
    lines.push("No code version is connected. Use the project as it is now.");
  }

  lines.push("", "Problems to fix:");
  if (input.findings.length === 0) {
    lines.push("No problems are attached yet.");
  } else {
    input.findings.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.title.trim() || "Untitled problem"}`);
      const body = finding.body?.trim();
      const done = finding.acceptanceCriterion?.trim();
      if (body) lines.push(`   What we saw: ${body}`);
      if (done) lines.push(`   Done when: ${done}`);
    });
  }

  lines.push(
    "",
    "Rules:",
    "- Leave working behavior alone except for these problems.",
    "- Do not change sign-in, permissions, billing, or the database unless a problem above says to.",
    "- Do not delete, skip, or rewrite tests to make them pass. If a test fails, leave it failing and say why.",
    "- When you finish, say what changed and what you could not check.",
  );

  return lines.join("\n");
}
