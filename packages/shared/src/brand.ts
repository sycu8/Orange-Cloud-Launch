export const OC_BRAND_TOKENS = {
  ink: "#17252B",
  canvas: "#FAF8F5",
  surface: "#FFFFFF",
  action: "#C2410C",
  accent: "#FF8A4C",
  orangeTint: "#FFF0E7",
  positive: "#0F766E",
  positiveTint: "#E8F4F1",
  muted: "#59676D",
  border: "#DFE4E2",
  inputBorder: "#84918F",
  focus: "#2563EB",
} as const;

export type BrandProfile = {
  purpose: string;
  audience: string;
  tone: string[];
  colors: {
    ink: string;
    canvas: string;
    surface: string;
    action: string;
    accent: string;
    muted: string;
  };
  typography: {
    sans: string;
    bodySize: string;
  };
  spacingScale: number[];
  primaryButton: {
    background: string;
    text: string;
    radius: string;
    minHeight: string;
  };
  protectedElements: string[];
};

export function defaultBrandProfile(input: {
  purpose: string;
  audience: string;
}): BrandProfile {
  return {
    purpose: input.purpose,
    audience: input.audience,
    tone: ["practical", "welcoming", "precise"],
    colors: {
      ink: OC_BRAND_TOKENS.ink,
      canvas: OC_BRAND_TOKENS.canvas,
      surface: OC_BRAND_TOKENS.surface,
      action: OC_BRAND_TOKENS.action,
      accent: OC_BRAND_TOKENS.accent,
      muted: OC_BRAND_TOKENS.muted,
    },
    typography: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      bodySize: "16px",
    },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    primaryButton: {
      background: OC_BRAND_TOKENS.action,
      text: "#FFFFFF",
      radius: "10px",
      minHeight: "44px",
    },
    protectedElements: ["logo", "product name casing", "approved color tokens"],
  };
}

export function brandProfileToCss(profile: BrandProfile): string {
  return `:root {
  --brand-ink: ${profile.colors.ink};
  --brand-canvas: ${profile.colors.canvas};
  --brand-surface: ${profile.colors.surface};
  --brand-action: ${profile.colors.action};
  --brand-accent: ${profile.colors.accent};
  --brand-muted: ${profile.colors.muted};
  --brand-font-sans: ${profile.typography.sans};
  --brand-body-size: ${profile.typography.bodySize};
  --brand-button-bg: ${profile.primaryButton.background};
  --brand-button-text: ${profile.primaryButton.text};
  --brand-button-radius: ${profile.primaryButton.radius};
  --brand-button-min-height: ${profile.primaryButton.minHeight};
}
`;
}
