import type { Config, Handler } from "@netlify/functions";
import { connectLambda, getStore } from "@netlify/blobs";

const STORE_NAME = "genealogy-elegance";
const ENTRY_KEY = "family-tree";

interface StoredFamilyTree {
  members: unknown[];
  updatedAt: string;
}

function jsonResponse(body: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  connectLambda(event);

  const store = getStore({
    name: STORE_NAME,
    consistency: "strong",
  });

  if (event.httpMethod === "GET") {
    const payload = await store.get(ENTRY_KEY, { type: "json", consistency: "strong" }) as StoredFamilyTree | null;

    return jsonResponse({
      members: Array.isArray(payload?.members) ? payload.members : null,
      updatedAt: payload?.updatedAt ?? null,
    });
  }

  if (event.httpMethod === "PUT") {
    if (!event.body) {
      return jsonResponse({ message: "Payload kosong." }, 400);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return jsonResponse({ message: "Payload JSON tidak valid." }, 400);
    }

    const members = parsed && typeof parsed === "object" && Array.isArray((parsed as { members?: unknown[] }).members)
      ? (parsed as { members: unknown[] }).members
      : null;

    if (!members) {
      return jsonResponse({ message: "Data anggota tidak valid." }, 400);
    }

    const updatedAt = new Date().toISOString();
    await store.setJSON(ENTRY_KEY, { members, updatedAt });

    return jsonResponse({ ok: true, updatedAt });
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        Allow: "GET, PUT, OPTIONS",
      },
    };
  }

  return jsonResponse({ message: "Method tidak didukung." }, 405);
};

export const config: Config = {
  path: "/api/family-tree",
  method: ["GET", "PUT", "OPTIONS"],
};
