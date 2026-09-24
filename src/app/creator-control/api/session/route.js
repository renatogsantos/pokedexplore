import { NextResponse } from "next/server";
import {
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_MAX_AGE,
  createCreatorSessionToken,
  isCreatorPassphraseValid,
  isCreatorProtectionConfigured,
} from "../../_server/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isCreatorProtectionConfigured()) {
    return NextResponse.json({ ok: false, error: "Proteção do Creator Center não configurada." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  if (!isCreatorPassphraseValid(body?.passphrase)) {
    return NextResponse.json({ ok: false, error: "Chave de acesso inválida." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CREATOR_SESSION_COOKIE,
    value: createCreatorSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/creator-control",
    maxAge: CREATOR_SESSION_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CREATOR_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/creator-control",
    maxAge: 0,
  });
  return response;
}
