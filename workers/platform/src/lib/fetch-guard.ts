export type ResolveHost = (hostname: string) => Promise<string[]>;

export type FetchDecision =
  | { ok: true; url: URL }
  | { ok: false; reason: "credentials" | "scheme" | "host" | "dns" };

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".localdomain"];
const BLOCKED_NAMES = new Set(["localhost", "metadata.google.internal", "metadata.goog"]);

function stripBrackets(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

function parseIpv4(host: string): number | null {
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  if (parts.some((part) => part.length === 0)) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part) && !/^0x[0-9a-f]+$/i.test(part)) return null;
    let value: number;
    if (/^0x/i.test(part)) value = Number.parseInt(part, 16);
    else if (part.length > 1 && part.startsWith("0")) value = Number.parseInt(part, 8);
    else value = Number.parseInt(part, 10);
    if (!Number.isInteger(value) || value < 0) return null;
    nums.push(value);
  }
  let n = 0;
  if (nums.length === 1) {
    n = nums[0]!;
  } else {
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i]! > 255) return null;
      n = n * 256 + nums[i]!;
    }
    const last = nums[nums.length - 1]!;
    const remainingBytes = 4 - (nums.length - 1);
    const maxLast = 256 ** remainingBytes - 1;
    if (last > maxLast) return null;
    n = n * 256 ** remainingBytes + last;
  }
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
  return n;
}

function ipv4Class(n: number): "loopback" | "private" | "public" {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  const c = (n >>> 8) & 255;
  if (a === 127) return "loopback";
  if (a === 10 || a === 0) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "private";
  if (a === 169 && b === 254) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return "private";
  if (a === 198 && (b === 18 || b === 19)) return "private";
  if (a === 198 && b === 51) return "private";
  if (a === 203 && b === 113) return "private";
  if (a >= 224) return "private";
  return "public";
}

function expandIpv6(host: string): string[] | null {
  const raw = stripBrackets(host);
  if (!raw.includes(":")) return null;
  if (raw.includes(".")) {
    const lastColon = raw.lastIndexOf(":");
    const v4 = parseIpv4(raw.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    return expandIpv6(`${raw.slice(0, lastColon)}:${hi}:${lo}`);
  }
  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    return left;
  }
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => group.toLowerCase());
}

function ipv6Class(host: string): "loopback" | "private" | "public" | null {
  const groups = expandIpv6(host);
  if (!groups) return null;
  const nums = groups.map((group) => Number.parseInt(group, 16));
  if (nums.every((n) => n === 0)) return "loopback";
  if (nums.slice(0, 7).every((n) => n === 0) && nums[7] === 1) return "loopback";
  const first = nums[0]!;
  if ((first & 0xfe00) === 0xfc00) return "private";
  if ((first & 0xffc0) === 0xfe80) return "private";
  if ((first & 0xff00) === 0xff00) return "private";
  const mapped =
    nums.slice(0, 5).every((n) => n === 0) && nums[5] === 0xffff;
  if (mapped) {
    const v4 = ((nums[6]! << 16) | nums[7]!) >>> 0;
    const kind = ipv4Class(v4);
    return kind === "public" ? "public" : kind;
  }
  return "public";
}

export function hostClass(
  hostname: string,
): "loopback" | "private" | "metadata" | "public-ip" | "name" {
  const host = stripBrackets(hostname);
  if (BLOCKED_NAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return host === "localhost" || host.endsWith(".localhost") ? "loopback" : "metadata";
  }
  if (host.includes(":")) {
    const v6 = ipv6Class(host);
    if (v6 === "loopback") return "loopback";
    if (v6 === "private") return "private";
    if (v6 === "public") return "public-ip";
    return "private";
  }
  const ipv4Parts = host.split(".");
  const looksIpv4 =
    /^0x[0-9a-f]+$/i.test(host) ||
    /^\d+$/.test(host) ||
    (ipv4Parts.length > 1 &&
      ipv4Parts.length <= 4 &&
      ipv4Parts.every((part) => /^\d+$/.test(part) || /^0x[0-9a-f]+$/i.test(part)));
  if (looksIpv4) {
    const v4 = parseIpv4(host);
    if (v4 === null) return "private";
    const kind = ipv4Class(v4);
    if (kind === "loopback") return "loopback";
    if (kind === "private") return "private";
    return "public-ip";
  }
  return "name";
}

export function isBlockedHost(hostname: string, allowLoopback = false): boolean {
  const kind = hostClass(hostname);
  if (kind === "name" || kind === "public-ip") return false;
  if (allowLoopback && kind === "loopback") return false;
  return true;
}

export async function resolvePublicDns(hostname: string): Promise<string[]> {
  const addresses: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const endpoint = new URL("https://cloudflare-dns.com/dns-query");
    endpoint.searchParams.set("name", hostname);
    endpoint.searchParams.set("type", type);
    const res = await fetch(endpoint, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok || res.status >= 300) throw new Error("dns_failed");
    const body = (await res.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };
    if (body.Status === 3) return [];
    for (const answer of body.Answer ?? []) {
      if ((answer.type === 1 || answer.type === 28) && answer.data) {
        addresses.push(answer.data);
      }
    }
  }
  return addresses;
}

export async function assessOutboundUrl(
  raw: string,
  opts?: { allowLoopback?: boolean; resolve?: ResolveHost },
): Promise<FetchDecision> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "scheme" };
  }
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  const allowLoopback = Boolean(opts?.allowLoopback);
  if (url.protocol === "http:") {
    if (!(allowLoopback && hostClass(url.hostname) === "loopback")) {
      return { ok: false, reason: "scheme" };
    }
  } else if (url.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }
  const kind = hostClass(url.hostname);
  if (kind === "metadata" || kind === "private") return { ok: false, reason: "host" };
  if (kind === "loopback" && !allowLoopback) return { ok: false, reason: "host" };
  if (kind === "name") {
    const resolve = opts?.resolve ?? resolvePublicDns;
    let addresses: string[];
    try {
      addresses = await resolve(url.hostname);
    } catch {
      return { ok: false, reason: "dns" };
    }
    if (addresses.length === 0) return { ok: false, reason: "dns" };
    for (const address of addresses) {
      const addressKind = hostClass(address);
      if (addressKind !== "public-ip" && addressKind !== "name") {
        return { ok: false, reason: "host" };
      }
    }
  }
  return { ok: true, url };
}
