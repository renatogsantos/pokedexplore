import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) specifier = new URL(`../src/${specifier.slice(2)}`, import.meta.url).href;
  if (specifier.startsWith("file:") || specifier.startsWith(".")) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ["", ".js", "/index.js"]) {
      try { await access(fileURLToPath(new URL(url.href + suffix))); return await nextResolve(url.href + suffix, context); } catch {}
    }
  }
  return nextResolve(specifier, context);
}
