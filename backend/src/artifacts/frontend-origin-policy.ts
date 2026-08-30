const DEFAULT_EXACT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://maizena-nextwave-frontend.onrender.com',
  'https://maizena-nextwave.onrender.com',
  'https://maizena-nextwave.vercel.app',
  'https://maizena-nextwave-git-main-joshuapzzs-projects.vercel.app',
] as const;
const VERCEL_PREVIEW_ORIGIN =
  /^https:\/\/maizena-nextwave-[A-Za-z0-9-]+\.vercel\.app$/;

export interface FrontendOriginPolicy {
  readonly frameAncestors: readonly string[];
  isApiOriginAllowed(origin?: string): boolean;
}

function exactOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function createFrontendOriginPolicy(options: {
  frontendOrigins?: string;
  frontendUrl?: string;
} = {}): FrontendOriginPolicy {
  const configured = [
    ...(options.frontendOrigins ?? process.env.FRONTEND_ORIGINS ?? '').split(','),
    options.frontendUrl ?? process.env.FRONTEND_URL ?? '',
  ];
  const frameAncestors = [...new Set([
    ...DEFAULT_EXACT_ORIGINS,
    ...configured.map(exactOrigin).filter((origin): origin is string => Boolean(origin)),
  ])];
  const exactOrigins = new Set(frameAncestors);

  return {
    frameAncestors,
    isApiOriginAllowed(origin) {
      if (!origin) return true;
      const normalized = exactOrigin(origin);
      return Boolean(
        normalized &&
        (exactOrigins.has(normalized) || VERCEL_PREVIEW_ORIGIN.test(normalized)),
      );
    },
  };
}
