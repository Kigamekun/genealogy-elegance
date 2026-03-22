import { FamilyMember, hydrateMembers } from "@/lib/family-data";

const CLOUD_ENDPOINT = "/api/family-tree";

export type FamilyTreeSyncStatus = "loading" | "local" | "saving" | "synced" | "error";

interface CloudPayload {
  members: unknown;
  updatedAt?: string;
}

interface LoadCloudResult {
  available: boolean;
  members: FamilyMember[] | null;
  updatedAt: string | null;
}

interface SaveCloudResult {
  available: boolean;
  updatedAt: string | null;
}

async function parseCloudPayload(response: Response): Promise<CloudPayload | null> {
  try {
    return await response.json() as CloudPayload;
  } catch {
    return null;
  }
}

export async function loadCloudMembers(): Promise<LoadCloudResult> {
  try {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (response.status === 404 || response.status === 405) {
      return { available: false, members: null, updatedAt: null };
    }

    if (!response.ok) {
      return { available: true, members: null, updatedAt: null };
    }

    const payload = await parseCloudPayload(response);
    const members = hydrateMembers(payload?.members);
    return {
      available: true,
      members: members.length > 0 ? members : null,
      updatedAt: payload?.updatedAt ?? null,
    };
  } catch {
    return { available: false, members: null, updatedAt: null };
  }
}

export async function saveCloudMembers(members: FamilyMember[]): Promise<SaveCloudResult> {
  try {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ members }),
    });

    if (response.status === 404 || response.status === 405) {
      return { available: false, updatedAt: null };
    }

    const payload = await parseCloudPayload(response);
    return {
      available: response.ok,
      updatedAt: payload?.updatedAt ?? null,
    };
  } catch {
    return { available: false, updatedAt: null };
  }
}
