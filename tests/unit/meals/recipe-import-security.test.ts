import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  redactUrlForLog,
  redactUrlsInText,
  safeHostnameForLog,
} from "@/lib/meals/import";
import {
  IMPORT_FAILURE_CATEGORIES,
  ImportFailure,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  buildRobotsPolicy,
  isBlockedHostname,
  isImportFailure,
  isPathAllowed,
  isPublicIpAddress,
  parseRequestUrl,
} from "@/lib/meals/import/server";

describe("parseRequestUrl", () => {
  it("accepts http and https", () => {
    expect(parseRequestUrl("https://example.com/recipe").protocol).toBe("https:");
    expect(parseRequestUrl("http://example.com/recipe").protocol).toBe("http:");
  });

  it("rejects unsupported protocols", () => {
    for (const raw of [
      "ftp://example.com/file",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,hi",
    ]) {
      try {
        parseRequestUrl(raw);
        expect.unreachable(`expected failure for ${raw}`);
      } catch (err) {
        expect(isImportFailure(err)).toBe(true);
        expect((err as ImportFailure).category).toBe("invalid_url");
      }
    }
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      parseRequestUrl("https://user:pass@example.com/recipe"),
    ).toThrow(ImportFailure);
    try {
      parseRequestUrl("https://token@example.com/r");
    } catch (err) {
      expect((err as ImportFailure).category).toBe("invalid_url");
      expect((err as ImportFailure).message).toMatch(/credentials/i);
    }
  });

  it("rejects unparseable or hostless URLs", () => {
    expect(() => parseRequestUrl("not a url")).toThrow(ImportFailure);
    expect(() => parseRequestUrl("https://")).toThrow(ImportFailure);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost and internal suffixes", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("app.localhost")).toBe(true);
    expect(isBlockedHostname("nas.local")).toBe(true);
    expect(isBlockedHostname("svc.internal")).toBe(true);
    expect(isBlockedHostname("db.intranet")).toBe(true);
    expect(isBlockedHostname("printer.lan")).toBe(true);
    expect(isBlockedHostname("router.home")).toBe(true);
    expect(isBlockedHostname("mail.corp")).toBe(true);
    expect(isBlockedHostname("host.localdomain")).toBe(true);
    expect(isBlockedHostname("ip6-localhost")).toBe(true);
  });

  it("blocks single-label hostnames", () => {
    expect(isBlockedHostname("metadata")).toBe(true);
    expect(isBlockedHostname("redis")).toBe(true);
  });

  it("allows public multi-label hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("recipes.nytimes.com")).toBe(false);
  });
});

describe("isPublicIpAddress", () => {
  it("rejects private and reserved IPv4", () => {
    const privateOrReserved = [
      "0.0.0.0",
      "10.0.0.1",
      "127.0.0.1",
      "127.1.2.3",
      "100.64.0.1",
      "100.127.255.254",
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "192.0.0.1",
      "192.0.2.1",
      "192.88.99.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "255.255.255.255",
    ];
    for (const ip of privateOrReserved) {
      expect(isPublicIpAddress(ip), ip).toBe(false);
    }
  });

  it("accepts public IPv4", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
  });

  it("rejects private and reserved IPv6", () => {
    const blocked = [
      "::",
      "::1",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
      "100::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:192.168.0.1",
      "64:ff9b::10.0.0.1",
      "2002:0a00:0001::1",
    ];
    for (const ip of blocked) {
      expect(isPublicIpAddress(ip), ip).toBe(false);
    }
  });

  it("accepts public IPv6", () => {
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects unparseable input", () => {
    expect(isPublicIpAddress("")).toBe(false);
    expect(isPublicIpAddress("not-an-ip")).toBe(false);
    expect(isPublicIpAddress("999.999.999.999")).toBe(false);
  });
});

describe("fetch safety constants (size / timeout / redirects)", () => {
  it("exposes hard caps used by secureFetch", () => {
    expect(MAX_RESPONSE_BYTES).toBe(3 * 1024 * 1024);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(MAX_REDIRECTS).toBe(5);
  });

  it("lists content-type and size related failure categories", () => {
    expect(IMPORT_FAILURE_CATEGORIES).toEqual(
      expect.arrayContaining([
        "fetch_timeout",
        "response_too_large",
        "unsupported_content_type",
        "blocked_destination",
        "invalid_url",
        "robots_disallowed",
      ]),
    );
  });
});

describe("log redaction", () => {
  it("redacts query, fragment, and credentials from URLs", () => {
    expect(
      redactUrlForLog(
        "https://user:secret@example.com/path?token=abc&x=1#section",
      ),
    ).toBe("https://example.com/path?[redacted]#[redacted]");
  });

  it("never throws on unparseable input", () => {
    expect(redactUrlForLog("%%%")).toBe("[unparseable-url]");
    expect(safeHostnameForLog("%%%")).toBe("[unparseable-host]");
  });

  it("redacts URLs embedded in free-form text", () => {
    const text = "failed https://example.com/r?session=xyz mid-message";
    expect(redactUrlsInText(text)).toBe(
      "failed https://example.com/r?[redacted] mid-message",
    );
  });

  it("exposes hostname for rate-limit keys", () => {
    expect(safeHostnameForLog("https://Recipes.Example.COM/a")).toBe(
      "recipes.example.com",
    );
  });
});

describe("robots policy", () => {
  it("allows everything when robots.txt is missing", () => {
    const policy = buildRobotsPolicy(null);
    expect(policy.hasRobots).toBe(false);
    expect(policy.rules).toEqual([]);
    expect(isPathAllowed(policy.rules, "/anything")).toBe(true);
  });

  it("applies * group Disallow / Allow with longest match", () => {
    const policy = buildRobotsPolicy(`
User-agent: *
Disallow: /private
Allow: /private/ok
Disallow: /admin
`);
    expect(policy.hasRobots).toBe(true);
    expect(policy.matchedGroup).toBe("*");
    expect(isPathAllowed(policy.rules, "/recipes/pasta")).toBe(true);
    expect(isPathAllowed(policy.rules, "/private/secret")).toBe(false);
    expect(isPathAllowed(policy.rules, "/private/ok")).toBe(true);
    expect(isPathAllowed(policy.rules, "/admin")).toBe(false);
  });

  it("prefers HouseholdOSRecipeImporter group over *", () => {
    const policy = buildRobotsPolicy(`
User-agent: *
Disallow: /

User-agent: HouseholdOSRecipeImporter
Allow: /recipes
Disallow: /recipes/private
`);
    expect(policy.matchedGroup).toBe("householdosrecipeimporter");
    expect(isPathAllowed(policy.rules, "/recipes/lemon")).toBe(true);
    expect(isPathAllowed(policy.rules, "/recipes/private")).toBe(false);
    expect(isPathAllowed(policy.rules, "/other")).toBe(true);
  });

  it("treats empty Disallow as unrestricted", () => {
    const policy = buildRobotsPolicy(`
User-agent: *
Disallow:
`);
    expect(isPathAllowed(policy.rules, "/any")).toBe(true);
  });
});
