#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const hasHan = /[\u3400-\u9fff]/u;
const translatableAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "checkboxLabel",
  "confirmMessage",
  "description",
  "itemLabel",
  "label",
  "pendingText",
  "placeholder",
  "title"
]);
const clientFiles = new Set(
  [
    "src/app/admin/error.tsx",
    "src/app/admin/groups/[id]/settings/group-settings-form.tsx",
    "src/app/admin/groups/new/new-group-form.tsx",
    "src/app/admin/login/login-form.tsx",
    "src/app/candidate/[groupCode]/availability-form.tsx",
    "src/app/candidate/[groupCode]/error.tsx",
    "src/app/candidate/auth/confirm/candidate-auth-confirmation.tsx",
    "src/app/error.tsx",
    "src/app/join/join-form.tsx",
    "src/components/admin/appointment-preview.tsx",
    "src/components/admin/appointment-slot-picker.tsx",
    "src/components/admin/candidate-admin-note-editor.tsx",
    "src/components/admin/candidate-email-composer.tsx",
    "src/components/design-system/admin-only-notice.tsx",
    "src/components/design-system/review-notice.tsx",
    "src/components/design-system/status-badge.tsx",
    "src/components/scheduling/candidate-time-grid.tsx",
    "src/components/scheduling/selected-slots-summary.tsx",
    "src/components/scheduling/slot-legend.tsx",
    "src/components/scheduling/time-cell.tsx",
    "src/components/scheduling/time-range-preview.tsx",
    "src/components/timezone/timezone-switcher.tsx",
    "src/components/ui/copy-button.tsx",
    "src/components/ui/error-state.tsx",
    "src/components/ui/submit-button.tsx"
  ].map((file) => path.resolve(root, file))
);

function normalize(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.name?.text ?? "";
  }
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return node.parent.name.text;
  }
  return "";
}

function outerFunction(node) {
  let current = node.parent;
  let outer;
  while (current) {
    if (ts.isFunctionLike(current)) outer = current;
    current = current.parent;
  }
  return outer;
}

function isComponentFunction(node) {
  const name = functionName(node);
  return /^[A-Z]/u.test(name) || /^use[A-Z]/u.test(name);
}

function isFunctionParameterInitializer(node, owner) {
  let current = node.parent;
  while (current && current !== owner) {
    if (ts.isParameter(current)) return true;
    current = current.parent;
  }
  return false;
}

function isUnsafeLiteralPosition(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken
    ].includes(parent.operatorToken.kind)
  ) {
    return true;
  }
  if (ts.isCaseClause(parent) && parent.expression === node) return true;
  if (ts.isJsxAttribute(parent)) {
    return !translatableAttributes.has(parent.name.text);
  }
  return false;
}

function shouldTranslateLiteral(node) {
  const owner = outerFunction(node);
  return Boolean(
    owner &&
    isComponentFunction(owner) &&
    !isFunctionParameterInitializer(node, owner) &&
    !isUnsafeLiteralPosition(node)
  );
}

function templateSource(node) {
  let value = node.head.text;
  node.templateSpans.forEach((span, index) => {
    value += `{value${index}}${span.literal.text}`;
  });
  return normalize(value);
}

function importWithNamedSpecifier(sourceFile, moduleName, importName) {
  const existing = sourceFile.statements.find(
    (statement) =>
      ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === moduleName
  );
  if (!existing) {
    return {
      statements: [
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier(importName)
              )
            ])
          ),
          ts.factory.createStringLiteral(moduleName)
        ),
        ...sourceFile.statements
      ],
      updatedExisting: undefined
    };
  }
  if (
    existing.importClause?.namedBindings &&
    ts.isNamedImports(existing.importClause.namedBindings) &&
    !existing.importClause.namedBindings.elements.some(
      (element) => (element.propertyName ?? element.name).text === importName
    )
  ) {
    const namedBindings = ts.factory.updateNamedImports(existing.importClause.namedBindings, [
      ...existing.importClause.namedBindings.elements,
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(importName))
    ]);
    return { statements: sourceFile.statements, updatedExisting: { existing, namedBindings } };
  }
  return { statements: sourceFile.statements, updatedExisting: undefined };
}

const [zhCore, zhLegacy] = await Promise.all([
  readFile(path.join(root, "src/i18n/messages/zh-CN/core.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "src/i18n/messages/zh-CN/legacy.json"), "utf8").then(JSON.parse)
]);
const sourceToKey = new Map();
for (const [key, source] of Object.entries(zhLegacy)) sourceToKey.set(normalize(source), key);
for (const [key, source] of Object.entries(zhCore)) sourceToKey.set(normalize(source), key);

const files = process.argv.slice(2).map((file) => path.resolve(root, file));
if (files.length === 0) throw new Error("Pass one or more repository-relative TSX paths.");

for (const file of files) {
  const sourceText = await readFile(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const functionsNeedingTranslator = new Set();
  const missing = new Set();

  function register(node, source) {
    const normalized = normalize(source);
    if (!hasHan.test(normalized)) return;
    const key = sourceToKey.get(normalized);
    if (!key) {
      missing.add(normalized);
      return;
    }
    const owner = outerFunction(node);
    if (owner && isComponentFunction(owner)) functionsNeedingTranslator.add(owner);
  }

  function scan(node) {
    if (ts.isJsxText(node)) register(node, node.text);
    else if (
      ts.isJsxAttribute(node) &&
      translatableAttributes.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      register(node.initializer, node.initializer.text);
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      shouldTranslateLiteral(node)
    ) {
      register(node, node.text);
    } else if (ts.isTemplateExpression(node) && shouldTranslateLiteral(node)) {
      register(node, templateSource(node));
    }
    ts.forEachChild(node, scan);
  }
  scan(sourceFile);
  if (missing.size > 0) {
    throw new Error(`${path.relative(root, file)} missing keys:\n${[...missing].join("\n")}`);
  }
  if (functionsNeedingTranslator.size === 0) continue;

  const isClient = clientFiles.has(file);
  const translatorModule = isClient ? "@/i18n/locale-provider" : "@/i18n/server";
  const translatorImport = isClient ? "useLocale" : "getServerTranslator";
  const importChange = importWithNamedSpecifier(sourceFile, translatorModule, translatorImport);

  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isJsxText(node) && functionsNeedingTranslator.has(outerFunction(node))) {
        const value = normalize(node.text);
        if (hasHan.test(value)) {
          return ts.factory.createJsxExpression(
            undefined,
            ts.factory.createCallExpression(ts.factory.createIdentifier("t"), undefined, [
              ts.factory.createStringLiteral(sourceToKey.get(value))
            ])
          );
        }
      }
      if (
        ts.isJsxAttribute(node) &&
        translatableAttributes.has(node.name.text) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        functionsNeedingTranslator.has(outerFunction(node.initializer)) &&
        hasHan.test(normalize(node.initializer.text))
      ) {
        return ts.factory.updateJsxAttribute(
          node,
          node.name,
          ts.factory.createJsxExpression(
            undefined,
            ts.factory.createCallExpression(ts.factory.createIdentifier("t"), undefined, [
              ts.factory.createStringLiteral(sourceToKey.get(normalize(node.initializer.text)))
            ])
          )
        );
      }
      if (
        ts.isTemplateExpression(node) &&
        shouldTranslateLiteral(node) &&
        functionsNeedingTranslator.has(outerFunction(node)) &&
        hasHan.test(templateSource(node))
      ) {
        const values = node.templateSpans.map((span, index) =>
          ts.factory.createPropertyAssignment(`value${index}`, span.expression)
        );
        return ts.factory.createCallExpression(ts.factory.createIdentifier("t"), undefined, [
          ts.factory.createStringLiteral(sourceToKey.get(templateSource(node))),
          ts.factory.createObjectLiteralExpression(values, false)
        ]);
      }
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        shouldTranslateLiteral(node) &&
        functionsNeedingTranslator.has(outerFunction(node)) &&
        hasHan.test(normalize(node.text))
      ) {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("t"), undefined, [
          ts.factory.createStringLiteral(sourceToKey.get(normalize(node.text)))
        ]);
      }

      const visited = ts.visitEachChild(node, visit, context);
      if (!functionsNeedingTranslator.has(node)) return visited;
      if (
        !ts.isFunctionDeclaration(visited) &&
        !ts.isFunctionExpression(visited) &&
        !ts.isArrowFunction(visited)
      ) {
        return visited;
      }
      const alreadyHasT =
        visited.body &&
        /\bconst\s+\{[^}]*\bt\b[^}]*\}\s*=\s*(?:useLocale|await\s+getServerTranslator)\s*\(/u.test(
          visited.body.getText?.(sourceFile) ?? ""
        );
      const translatorStatement = alreadyHasT
        ? undefined
        : ts.factory.createVariableStatement(
            undefined,
            ts.factory.createVariableDeclarationList(
              [
                ts.factory.createVariableDeclaration(
                  ts.factory.createObjectBindingPattern([
                    ts.factory.createBindingElement(undefined, undefined, "t", undefined)
                  ]),
                  undefined,
                  undefined,
                  isClient
                    ? ts.factory.createCallExpression(
                        ts.factory.createIdentifier("useLocale"),
                        undefined,
                        []
                      )
                    : ts.factory.createAwaitExpression(
                        ts.factory.createCallExpression(
                          ts.factory.createIdentifier("getServerTranslator"),
                          undefined,
                          []
                        )
                      )
                )
              ],
              ts.NodeFlags.Const
            )
          );
      const existingBody = visited.body;
      const body = ts.isBlock(existingBody)
        ? ts.factory.updateBlock(
            existingBody,
            translatorStatement
              ? [translatorStatement, ...existingBody.statements]
              : existingBody.statements
          )
        : ts.factory.createBlock(
            [
              ...(translatorStatement ? [translatorStatement] : []),
              ts.factory.createReturnStatement(existingBody)
            ],
            true
          );
      const asyncModifier = isClient
        ? visited.modifiers
        : [
            ...(visited.modifiers ?? []).filter(
              (modifier) => modifier.kind !== ts.SyntaxKind.AsyncKeyword
            ),
            ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)
          ];
      if (ts.isFunctionDeclaration(visited)) {
        return ts.factory.updateFunctionDeclaration(
          visited,
          asyncModifier,
          visited.asteriskToken,
          visited.name,
          visited.typeParameters,
          visited.parameters,
          visited.type,
          body
        );
      }
      if (ts.isFunctionExpression(visited)) {
        return ts.factory.updateFunctionExpression(
          visited,
          asyncModifier,
          visited.asteriskToken,
          visited.name,
          visited.typeParameters,
          visited.parameters,
          visited.type,
          body
        );
      }
      return ts.factory.updateArrowFunction(
        visited,
        asyncModifier,
        visited.typeParameters,
        visited.parameters,
        visited.type,
        visited.equalsGreaterThanToken,
        body
      );
    };
    return (rootNode) => ts.visitNode(rootNode, visit);
  };

  const transformed = ts.transform(sourceFile, [transformer]).transformed[0];
  let statements = [...transformed.statements];
  if (importChange.updatedExisting) {
    statements = statements.map((statement) =>
      statement === importChange.updatedExisting.existing
        ? ts.factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            ts.factory.updateImportClause(
              statement.importClause,
              statement.importClause.isTypeOnly,
              statement.importClause.name,
              importChange.updatedExisting.namedBindings
            ),
            statement.moduleSpecifier,
            statement.attributes
          )
        : statement
    );
  } else if (importChange.statements.length > sourceFile.statements.length) {
    const directiveCount = statements.findIndex(
      (statement) =>
        !ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)
    );
    const insertionIndex = directiveCount < 0 ? statements.length : directiveCount;
    statements = [
      ...statements.slice(0, insertionIndex),
      importChange.statements[0],
      ...statements.slice(insertionIndex)
    ];
  }
  const updated = ts.factory.updateSourceFile(transformed, statements);
  const output = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(updated);
  await writeFile(file, output);
  process.stdout.write(`${path.relative(root, file)}\n`);
}
