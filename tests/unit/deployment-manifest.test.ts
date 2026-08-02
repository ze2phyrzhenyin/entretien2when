import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("zhaoali deployment manifest", () => {
  it("keeps the production base path on the established shared HTTPS domain", () => {
    const manifest = readFileSync(new URL("../../ops/zhaoali.toml", import.meta.url), "utf8");

    expect(manifest).toContain('public_host = "h5.cnniceshop.com"');
    expect(manifest).toContain('public_origin = "https://h5.cnniceshop.com/when2entretien"');
    expect(manifest).toContain('nginx_layout = "current"');
    expect(manifest).toContain('nginx_vhost = "/etc/nginx/conf.d/h5.com.conf"');
    expect(manifest).toContain('nginx_main = "/etc/nginx/nginx.conf"');
    expect(manifest).toContain('nginx_prefix = "/etc/nginx/"');
    expect(manifest).not.toMatch(/nip\.io|certificate_renewal_timer/);
  });

  it("passes the detected nginx prefix through the remote deployment verifier", () => {
    const deployScript = readFileSync(
      new URL("../../scripts/deploy-aliyun.sh", import.meta.url),
      "utf8"
    );

    expect(deployScript).toContain('NGINX_PREFIX="${NGINX_PREFIX:-}"');
    expect(deployScript).toContain('REQUESTED_NGINX_PREFIX="${21}"');
    expect(deployScript).toContain('BACKUP_COPY_DIR="${22:-}"');
    expect(deployScript).toContain('"$NGINX_BIN" -t -p "$NGINX_PREFIX" -c "$NGINX_MAIN"');
  });
});
