#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sourceRoot = path.join(repositoryRoot, "src");
const failures = [];
const userFacingAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(absolute)));
    else if (entry.name.endsWith(".tsx")) files.push(absolute);
  }
  return files;
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isTranslatorCall(node) {
  if (!node) return false;
  const expression = unwrap(node);
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "t"
  );
}

function isAllowedConditionalExpression(node) {
  const expression = unwrap(node);
  return (
    ts.isConditionalExpression(expression) ||
    (ts.isBinaryExpression(expression) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken
      ].includes(expression.operatorToken.kind)) ||
    ts.isJsxElement(expression) ||
    ts.isJsxSelfClosingElement(expression) ||
    ts.isJsxFragment(expression)
  );
}

function isSignificantRawExpression(node) {
  if (!node || isAllowedConditionalExpression(node)) return false;
  const expression = unwrap(node);
  if (
    expression.kind === ts.SyntaxKind.NullKeyword ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return false;
  }
  if (ts.isStringLiteralLike(expression)) return expression.text.trim().length > 0;
  return true;
}

function location(sourceFile, node) {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${path.relative(repositoryRoot, sourceFile.fileName)}:${point.line + 1}:${
    point.character + 1
  }`;
}

function checkJsxChildren(sourceFile, owner, children) {
  const translated = [];
  const raw = [];
  for (const child of children) {
    if (ts.isJsxText(child)) {
      if (child.text.trim()) raw.push(child);
      continue;
    }
    if (!ts.isJsxExpression(child) || !child.expression) continue;
    if (isTranslatorCall(child.expression)) translated.push(child);
    else if (isSignificantRawExpression(child.expression)) raw.push(child);
  }

  if (translated.length > 1) {
    failures.push(
      `${location(sourceFile, owner)}: multiple direct t(...) fragments must be one semantic message`
    );
  }
  if (translated.length > 0 && raw.length > 0) {
    failures.push(
      `${location(sourceFile, owner)}: direct t(...) plus raw text/data must be one semantic message`
    );
  }
}

function checkNestedTranslator(sourceFile, node) {
  if (!isTranslatorCall(node)) return;
  const call = unwrap(node);
  for (const argument of call.arguments.slice(1)) {
    let nested;
    function visit(child) {
      if (child !== node && isTranslatorCall(child)) nested ??= child;
      if (!nested) ts.forEachChild(child, visit);
    }
    visit(argument);
    if (nested) {
      failures.push(
        `${location(sourceFile, nested)}: do not pass t(...) output as a placeholder to another t(...)`
      );
    }
  }
}

function checkTranslatorComposition(sourceFile, node) {
  if (!isTranslatorCall(node)) return;
  let parent = node.parent;
  while (
    parent &&
    (ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isSatisfiesExpression(parent))
  ) {
    parent = parent.parent;
  }
  if (
    parent &&
    ((ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
      ts.isTemplateSpan(parent))
  ) {
    failures.push(
      `${location(sourceFile, node)}: do not concatenate t(...) with binary or template-expression fragments`
    );
  }
}

function naturalLanguageAttributeLiteral(attribute) {
  const initializer = attribute.initializer;
  let value;
  if (initializer && ts.isStringLiteral(initializer)) value = initializer.text;
  if (
    initializer &&
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    ts.isStringLiteralLike(unwrap(initializer.expression))
  ) {
    value = unwrap(initializer.expression).text;
  }
  if (!value || value.includes("@") || /^https?:/iu.test(value)) return undefined;
  if (/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/u.test(value)) return undefined;
  return /[A-Za-z]{2,}[^A-Za-z0-9]+[A-Za-z]{2,}/u.test(value) ? value : undefined;
}

function checkUserFacingAttribute(sourceFile, node) {
  if (!ts.isIdentifier(node.name) || !userFacingAttributes.has(node.name.text)) return;
  const value = naturalLanguageAttributeLiteral(node);
  if (value) {
    failures.push(
      `${location(sourceFile, node)}: user-facing ${node.name.text} literal must use a MessageKey (${JSON.stringify(value)})`
    );
  }
}

for (const file of await sourceFiles(sourceRoot)) {
  const source = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  function visit(node) {
    if (ts.isJsxElement(node)) checkJsxChildren(sourceFile, node, node.children);
    if (ts.isJsxFragment(node)) checkJsxChildren(sourceFile, node, node.children);
    if (ts.isCallExpression(node)) {
      checkNestedTranslator(sourceFile, node);
      checkTranslatorComposition(sourceFile, node);
    }
    if (ts.isJsxAttribute(node)) checkUserFacingAttribute(sourceFile, node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  "fragmented JSX i18n boundary passed: semantic messages and user-facing attributes are explicit\n"
);
