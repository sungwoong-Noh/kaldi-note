#!/usr/bin/env node
// docs/contracts/*.json (OpenAPI 조각)을 읽어 frontend/src/types/generated/*.ts에
// TypeScript interface를 만든다. 새 의존성 없음 — Node 내장 fs/path만 쓴다.
//
// 지원하는 스키마: object/properties/required, string(enum 포함), integer, number,
// boolean, array/items, $ref, nullable. oneOf/allOf/anyOf는 아직 없다(YAGN).
//
// 사용법: node scripts/generate-contract-types.mjs
// 규칙:   docs/contracts/README.md

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACTS_DIR = join(ROOT, "docs/contracts");
const OUT_DIR = join(ROOT, "frontend/src/types/generated");

function refName(ref) {
  return ref.split("/").pop();
}

function tsType(schema) {
  if (!schema) return "unknown";
  if (schema.$ref) return refName(schema.$ref);

  let base;
  switch (schema.type) {
    case "string":
      base = schema.enum ? schema.enum.map((v) => JSON.stringify(v)).join(" | ") : "string";
      break;
    case "integer":
    case "number":
      base = "number";
      break;
    case "boolean":
      base = "boolean";
      break;
    case "array":
      base = `${tsType(schema.items)}[]`;
      break;
    case "object":
      base = "Record<string, unknown>"; // 인라인 object는 최소 구성 범위 밖 — 필요해지면 재귀로 확장
      break;
    default:
      base = "unknown";
  }
  return schema.nullable ? `${base} | null` : base;
}

function generateInterface(name, schema) {
  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {})
    .map(([key, propSchema]) => {
      const optional = required.has(key) ? "" : "?";
      return `  ${key}${optional}: ${tsType(propSchema)};`;
    })
    .join("\n");
  return `export interface ${name} {\n${props}\n}`;
}

function generateFile(contractPath) {
  const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
  const schemas = contract.components?.schemas ?? {};
  const interfaces = Object.entries(schemas)
    .map(([name, schema]) => generateInterface(name, schema))
    .join("\n\n");

  const header = [
    "// GENERATED — 손으로 고치지 마세요.",
    `// 원본: docs/contracts/${basename(contractPath)}`,
    "// 다시 만들기: node scripts/generate-contract-types.mjs",
    "// 규칙: docs/contracts/README.md",
    "",
  ].join("\n");

  return `${header}${interfaces}\n`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("계약 파일이 없습니다:", CONTRACTS_DIR);
    return;
  }

  for (const file of files) {
    const outName = file.replace(/\.json$/, ".ts");
    const outPath = join(OUT_DIR, outName);
    writeFileSync(outPath, generateFile(join(CONTRACTS_DIR, file)));
    console.log(`생성: frontend/src/types/generated/${outName}`);
  }
}

main();
