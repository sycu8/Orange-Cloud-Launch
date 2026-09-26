/** Sandbox / draft-PR adapter. */
export async function requestPatchPreview(
  env: { ENABLE_PATCH_PR: string },
  projectId: string,
  changeSetId: string,
): Promise<Record<string, unknown>> {
  if (env.ENABLE_PATCH_PR !== "true") {
    return {
      status: "integration_not_configured",
      message:
        "Preview + draft PR requires GitHub App credentials, Sandbox/build controller provisioning, and ENABLE_PATCH_PR=true. Use agent export meanwhile.",
      projectId,
      changeSetId,
      supportedProfile: "React/Vite + Tailwind",
    };
  }
  return {
    status: "integration_not_configured",
    message:
      "ENABLE_PATCH_PR is true but GitHub broker / Sandbox bindings are not provisioned.",
    projectId,
    changeSetId,
  };
}
