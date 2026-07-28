import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("zhaoali deployment manifest", () => {
  it("keeps the production base path on the established shared HTTPS domain", () => {
    const manifest = readFileSync(new URL("../../ops/zhaoali.toml", import.meta.url), "utf8");

    expect(manifest).toContain('public_host = "h5.cnniceshop.com"');
    expect(manifest).toContain('public_origin = "https://h5.cnniceshop.com/when2entretien"');
    expect(manifest).toContain('nginx_vhost = "/www/server/panel/vhost/nginx/h5.com.conf"');
    expect(manifest).not.toMatch(/nip\.io|certificate_renewal_timer/);
  });
});
