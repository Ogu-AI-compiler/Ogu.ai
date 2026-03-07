/**
 * specialty-loader.mjs — Slice 381
 * Loads specialty addendum files from tools/ogu/playbooks/specialties/.
 * Specialties are shorter (50-100 line) markdown files that augment base playbooks
 * with framework/technology-specific knowledge.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractSkills } from "./playbook-loader.mjs";

/**
 * Catalog of specialty slugs → display names.
 */
export const SPECIALTY_CATALOG = {
  "react":          "React",
  "node":           "Node.js",
  "kubernetes":     "Kubernetes",
  "typescript":     "TypeScript",
  "python":         "Python",
  "go":             "Go",
  "rust":           "Rust",
  "aws":            "AWS",
  "gcp":            "Google Cloud",
  "azure":          "Azure",
  "postgresql":     "PostgreSQL",
  "mongodb":        "MongoDB",
  "redis":          "Redis",
  "graphql":        "GraphQL",
  "grpc":           "gRPC",
  "docker":         "Docker",
  "terraform":      "Terraform",
  "nextjs":         "Next.js",
  "vue":            "Vue.js",
  "svelte":         "Svelte",
  "tailwind":       "Tailwind CSS",
  "prisma":         "Prisma",
  "kafka":          "Kafka",
  "elasticsearch":  "Elasticsearch",
};

/**
 * loadSpecialty(specialtiesDir, slug) → { body, skills, slug } | null
 */
export function loadSpecialty(specialtiesDir, slug) {
  if (!slug || typeof slug !== "string") return null;
  const filePath = join(specialtiesDir, `${slug}.md`);
  if (!existsSync(filePath)) return null;

  const content = readFileSync(filePath, "utf-8");
  const skills = extractSkills(content);

  return {
    slug,
    body: content,
    skills,
  };
}

/**
 * listSpecialties(dir) → [{ slug, displayName, path }]
 */
export function listSpecialties(dir) {
  if (!existsSync(dir)) return [];

  try {
    const files = readdirSync(dir).filter(f => f.endsWith(".md"));
    return files.map(f => {
      const slug = f.replace(".md", "");
      return {
        slug,
        displayName: SPECIALTY_CATALOG[slug] || slug,
        path: join(dir, f),
      };
    });
  } catch {
    return [];
  }
}
