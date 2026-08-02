#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sourceRoot = path.join(repositoryRoot, "src");
const catalogRoot = path.join(sourceRoot, "i18n/messages");
const reviewRoot = path.join(repositoryRoot, "scripts/i18n/review-candidate");
const hasHan = /[\u3400-\u9fff]/u;
const checkOnly = process.argv.includes("--check");
const generateReviewCandidate = process.argv.includes("--generate-review-candidate");

const manualTranslations = new Map([
  ["面试时间管理系统", "Interview scheduling"],
  ["面试时间协调系统", "Interview scheduling"],
  ["隐私隔离型中文版面试时间协调工具", "Privacy-first interview scheduling"],
  ["提交可用时间", "Submit availability"],
  ["管理员登录", "Administrator sign in"],
  ["管理员后台", "Administration"],
  ["面试组", "Interview groups"],
  ["面试组管理", "Interview groups"],
  ["招聘项目", "Recruitment projects"],
  ["修改审核", "Change reviews"],
  ["面试安排", "Interviews"],
  ["邮件模板", "Email templates"],
  ["邮件发送", "Send email"],
  ["审计日志", "Audit log"],
  ["候选人", "Candidates"],
  ["开放时间", "Available slots"],
  ["设置", "Settings"],
  ["保存", "Save"],
  ["取消", "Cancel"],
  ["删除", "Delete"],
  ["关闭", "Close"],
  ["返回入口", "Back to entry"],
  ["正在加载", "Loading"],
  ["重试", "Try again"],
  ["页面不存在", "Page not found"],
  ["页面加载失败", "Page failed to load"],
  ["隐私提示", "Privacy notice"],
  ["仅管理员可见", "Administrators only"],
  ["中国时间 / 上海", "China time / Shanghai"],
  ["法国时间 / 巴黎", "France time / Paris"],
  ["日本时间 / 东京", "Japan time / Tokyo"],
  ["新加坡时间", "Singapore time"],
  ["美国东部 / 纽约", "US Eastern / New York"],
  ["美国西部 / 洛杉矶", "US Pacific / Los Angeles"],
  ["英国时间 / 伦敦", "UK time / London"],
  ["面试官", "Interviewers"],
  ["面试轮次", "Interview rounds"],
  ["轮次", "Round"],
  ["项目", "Project"],
  ["状态", "Status"],
  ["操作", "Actions"],
  ["时间", "Time"],
  ["时区", "Time zone"],
  ["邮箱", "Email"],
  ["密码", "Password"],
  ["姓名", "Name"],
  ["备注", "Notes"],
  ["已安排", "Scheduled"],
  ["已取消", "Cancelled"],
  ["已完成", "Completed"],
  ["未到场", "No-show"],
  ["待审核", "Pending review"],
  ["已通过", "Approved"],
  ["已拒绝", "Rejected"],
  ["首次提交", "Initial submission"],
  ["修改申请", "Change request"],
  ["草稿", "Draft"],
  ["开放", "Open"],
  ["归档", "Archived"]
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (absolute.startsWith(catalogRoot)) continue;
      files.push(...(await sourceFiles(absolute)));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function normalizeMessage(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function templateMessage(node) {
  let value = node.head.text;
  node.templateSpans.forEach((span, index) => {
    value += `{value${index}}${span.literal.text}`;
  });
  return value;
}

function collectMessages(fileName, source) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const values = [];
  function add(value) {
    const normalized = normalizeMessage(value);
    if (normalized && hasHan.test(normalized)) values.push(normalized);
  }
  function visit(node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      add(templateMessage(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return values;
}

function protectPlaceholders(value) {
  const placeholders = [];
  const protectedValue = value.replace(/\{[A-Za-z_][A-Za-z0-9_.-]*\}/g, (match) => {
    const token = `ZXPH${placeholders.length}ZX`;
    placeholders.push(match);
    return token;
  });
  return { protectedValue, placeholders };
}

function restorePlaceholders(value, placeholders) {
  let restored = value;
  placeholders.forEach((placeholder, index) => {
    restored = restored.replace(new RegExp(`ZXPH\\s*${index}\\s*ZX`, "gi"), placeholder);
  });
  return restored;
}

async function googleTranslate(value) {
  const manual = manualTranslations.get(value);
  if (manual) return manual;
  const { protectedValue, placeholders } = protectPlaceholders(value);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({
    client: "gtx",
    sl: "zh-CN",
    tl: "en",
    dt: "t",
    q: protectedValue
  }).toString();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (response.ok) {
      const payload = await response.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((part) => part?.[0] ?? "").join("")
        : "";
      if (translated) return restorePlaceholders(translated, placeholders);
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error(`Unable to translate: ${value}`);
}

function semanticKey(translation, source) {
  const slug =
    translation
      .toLowerCase()
      .replace(/\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g, "_$1_")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72) || "message";
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 8);
  return `legacy.${slug}.${hash}`;
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(values[index], index);
      if ((index + 1) % 50 === 0)
        process.stdout.write(`translated ${index + 1}/${values.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return output;
}

const files = await sourceFiles(sourceRoot);
const messages = new Set();
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const message of collectMessages(file, source)) messages.add(message);
}
const sources = [...messages].sort((left, right) => left.localeCompare(right, "zh-CN"));
if (checkOnly) {
  const existingCatalog = JSON.parse(
    await readFile(path.join(catalogRoot, "zh-CN/legacy.json"), "utf8")
  );
  const catalogMessages = new Set(Object.values(existingCatalog));
  const missing = sources.filter((source) => !catalogMessages.has(source));
  if (missing.length > 0) {
    process.stderr.write(
      `${missing.map((value) => `missing catalog message: ${value}`).join("\n")}\n`
    );
    process.stderr.write(`catalog coverage failed with ${missing.length} missing message(s)\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`catalog coverage passed: ${sources.length} source message(s)\n`);
  }
  process.exit();
}

if (!generateReviewCandidate) {
  process.stderr.write(
    "Refusing to generate unreviewed machine translations into release catalogs.\n" +
      "Use --check for release verification, or --generate-review-candidate to create separate review files.\n"
  );
  process.exit(1);
}

const existingZhCatalog = JSON.parse(
  await readFile(path.join(catalogRoot, "zh-CN/legacy.json"), "utf8")
);
const existingSources = new Set(Object.values(existingZhCatalog));
const missingSources = sources.filter((source) => !existingSources.has(source));
const translations = await mapWithConcurrency(missingSources, 8, googleTranslate);
const zhCatalog = {};
const enCatalog = {};
for (let index = 0; index < missingSources.length; index += 1) {
  const source = missingSources[index];
  const translation = translations[index];
  const key = semanticKey(translation, source);
  zhCatalog[key] = source;
  enCatalog[key] = translation;
}
await mkdir(reviewRoot, { recursive: true });
await writeFile(path.join(reviewRoot, "zh-CN.json"), `${JSON.stringify(zhCatalog, null, 2)}\n`);
await writeFile(path.join(reviewRoot, "en.json"), `${JSON.stringify(enCatalog, null, 2)}\n`);
process.stdout.write(
  `generated ${missingSources.length} review candidate message(s); release catalogs were not modified\n`
);
