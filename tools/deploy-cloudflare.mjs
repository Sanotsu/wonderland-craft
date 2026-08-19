import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_DIR = path.join(ROOT, "web");
const CANDIDATES = ["wcraft", "wl-c"];
const DOMAIN_RE = /https:\/\/([a-z0-9-]+\.pages\.dev)/;

function pickWrangler() {
  const probe = spawnSync("wrangler", ["--version"], { shell: true, encoding: "utf8" });
  return probe.status === 0 ? ["wrangler"] : ["npx", "--yes", "wrangler@latest"];
}

const wr = pickWrangler();
const run = (args) =>
  spawnSync(wr[0], [...wr.slice(1), ...args], { shell: true, stdio: "inherit" }).status === 0;
const capture = (args) => {
  const r = spawnSync(wr[0], [...wr.slice(1), ...args], { shell: true, encoding: "utf8" });
  return { out: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
};

function main() {
  console.log(`Using: ${wr.join(" ")}`);

  const who = capture(["whoami"]);
  if (!/logged in|Account Name/.test(who.out)) {
    console.log("Not logged in to Cloudflare - opening browser for login...");
    if (!run(["login"])) {
      console.error("[ERROR] Cloudflare login failed. Run this script again.");
      process.exitCode = 1;
      return;
    }
  }

  // 已有项目表（wrangler 表格带 │ 边框，先清洗再匹配「项目名 + 域名」相邻列）
  const owned = new Map();
  const list = capture(["pages", "project", "list"]);
  for (let line of list.out.split(/\r?\n/)) {
    const clean = line.replace(/[│|]/g, " ").trim();
    const m = clean.match(/^([a-z0-9][a-z0-9-]{0,60})\s+([a-z0-9-]+\.pages\.dev)/);
    if (m && !owned.has(m[1])) owned.set(m[1], m[2]);
  }
  if (owned.size) console.log(`Owned Pages projects: ${[...owned.keys()].join(", ")}`);

  let project = null, domain = null;
  const branch = "main";
  const suffixed = [];

  for (const name of CANDIDATES) {
    if (owned.has(name)) {
      project = name;
      domain = owned.get(name);
      console.log(`Using existing project "${name}" -> https://${domain}`);
      break;
    }
    console.log(`Trying to create Pages project "${name}"...`);
    // 注意：Windows 上 wrangler 偶发「成功后 libuv 断言崩溃」导致退出码非 0，
    // 因此以输出文本判定成败，而非退出码
    const res = capture(["pages", "project", "create", name, "--production-branch", "main"]);
    if (/Successfully created/.test(res.out)) {
      const m = res.out.match(DOMAIN_RE);
      const d = m ? m[1] : `${name}.pages.dev`;
      if (d === `${name}.pages.dev`) {
        project = name; domain = d;
        console.log(`Created "${name}" -> https://${d}`);
        break;
      }
      console.log(`"${name}" only gets a random-suffix domain (${d}) - trying next...`);
      suffixed.push(name);
    } else {
      console.log(`"${name}" cannot be created (taken or API error) - trying next...`);
    }
  }

  if (!project && suffixed.length > 0) {
    project = suffixed[0];
    domain = `${project}.pages.dev`;
    console.log(`No clean short domain available - falling back to "${project}".`);
  }

  for (const name of suffixed) {
    if (name !== project) {
      console.log(`Cleaning up unused project "${name}"...`);
      capture(["pages", "project", "delete", name, "--yes"]);
    }
  }

  if (!project) {
    console.error(`[ERROR] None of these names is available: ${CANDIDATES.join(", ")}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nDeploying web/ to https://${domain} (branch: ${branch}) ...`);
  const ok = run([
    "pages", "deploy", SITE_DIR,
    "--project-name", project,
    "--branch", branch,
    "--commit-dirty=true",
  ]);

  console.log("");
  if (ok) {
    console.log("==================================================");
    console.log("Done. Your public game link:");
    console.log(`    https://${domain}`);
    console.log("(Keep this link; re-run deploy-cloudflare.bat to redeploy)");
    console.log("==================================================");
  } else {
    console.error("[ERROR] Deploy failed - see wrangler output above.");
    process.exitCode = 1;
  }
}

main();
