import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directory = path.join(process.cwd(), "public", "backgrounds");
    const entries = await readdir(directory, { withFileTypes: true });
    const backgrounds = entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => `/backgrounds/${encodeURIComponent(entry.name)}`)
      .sort((left, right) => left.localeCompare(right));

    return NextResponse.json({ backgrounds }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ backgrounds: [] });
  }
}
