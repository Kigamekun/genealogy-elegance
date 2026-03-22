import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FamilyMember,
  getInitialMembers,
  hydrateMembers,
  getParentIds,
  getSpouseIds,
  getSpouseRelations,
  getSpouseRelationStatus,
  normalizeMemberRelations,
  syncMemberRelations,
} from "@/lib/family-data";
import {
  type FamilyTreeSyncStatus,
  loadCloudMembers,
  saveCloudMembers,
} from "@/lib/family-tree-cloud";

export type AddRelationHint = "child" | "spouse" | "head" | "member";

export interface AddMemberIntent {
  parentIds?: string[];
  spouseIds?: string[];
  selectedParentId?: string;
  asFamilyHead?: boolean;
  relationHint?: AddRelationHint;
  genderHint?: FamilyMember["gender"];
}

function toTime(dateString: string): number {
  const value = Date.parse(dateString);
  return Number.isNaN(value) ? 0 : value;
}

const STORAGE_KEY = "safari-family.members.v1";
const LEGACY_STORAGE_KEYS = ["genealogy-elegance.members.v4", "genealogy-elegance.members.v3"];
const CLOUD_POLL_INTERVAL_MS = 12000;

function loadMembersFromStorage(): FamilyMember[] {
  if (typeof window === "undefined") return getInitialMembers();

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
      ?? LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean)
      ?? null;
    if (!stored) return getInitialMembers();

    const hydrated = hydrateMembers(JSON.parse(stored));
    return hydrated.length > 0 ? hydrated : getInitialMembers();
  } catch {
    return getInitialMembers();
  }
}

function persistMembers(members: FamilyMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

function buildExpandedNodes(members: FamilyMember[]): Set<string> {
  const next = new Set<string>();
  members.forEach((member) => {
    if (member.isFamilyHead || getParentIds(member).length === 0) next.add(member.id);
    getParentIds(member).forEach((parentId) => next.add(parentId));
  });
  return next;
}

function applyFamilyRules(members: FamilyMember[]): FamilyMember[] {
  const normalized = members.map((member) => normalizeMemberRelations(member));
  const normalizedById = new Map(normalized.map((member) => [member.id, member]));

  const candidatesByWife = new Map<string, Map<string, "married" | "divorced">>();
  const registerPair = (husbandId: string, wifeId: string, status: "married" | "divorced") => {
    if (!candidatesByWife.has(wifeId)) candidatesByWife.set(wifeId, new Map());
    const husbandMap = candidatesByWife.get(wifeId)!;
    const currentStatus = husbandMap.get(husbandId);
    husbandMap.set(husbandId, currentStatus === "divorced" || status === "divorced" ? "divorced" : "married");
  };

  for (const member of normalized) {
    for (const relation of getSpouseRelations(member)) {
      const spouse = normalizedById.get(relation.spouseId);
      if (!spouse) continue;
      const relationStatus = relation.status === "divorced" || getSpouseRelationStatus(spouse, member.id) === "divorced"
        ? "divorced"
        : "married";

      if (member.gender === "male" && spouse.gender === "female") {
        registerPair(member.id, spouse.id, relationStatus);
      } else if (member.gender === "female" && spouse.gender === "male") {
        registerPair(spouse.id, member.id, relationStatus);
      }
    }
  }

  const wivesByHusband = new Map<string, Array<{ wifeId: string; status: "married" | "divorced" }>>();
  for (const [wifeId, husbandCandidates] of candidatesByWife.entries()) {
    const selectedHusbandId = Array.from(husbandCandidates.keys()).sort((leftId, rightId) => {
      const left = normalizedById.get(leftId);
      const right = normalizedById.get(rightId);
      if (!left || !right) return leftId.localeCompare(rightId);
      return toTime(left.birthDate) - toTime(right.birthDate) || left.id.localeCompare(right.id);
    })[0];

    if (!selectedHusbandId) continue;
    if (!wivesByHusband.has(selectedHusbandId)) wivesByHusband.set(selectedHusbandId, []);
    wivesByHusband.get(selectedHusbandId)!.push({
      wifeId,
      status: husbandCandidates.get(selectedHusbandId) === "divorced" ? "divorced" : "married",
    });
  }

  const reconciledMap = new Map(
    normalized.map((member) => [
      member.id,
      normalizeMemberRelations({
        ...member,
        spouseRelations: undefined,
        spouseIds: undefined,
        spouseId: undefined,
      }),
    ]),
  );

  for (const [husbandId, wifeEntries] of wivesByHusband.entries()) {
    const husband = reconciledMap.get(husbandId);
    if (!husband || husband.gender !== "male") continue;

    const sortedWifeEntries = [...wifeEntries].sort((leftEntry, rightEntry) => {
      const left = reconciledMap.get(leftEntry.wifeId);
      const right = reconciledMap.get(rightEntry.wifeId);
      if (!left || !right) return leftEntry.wifeId.localeCompare(rightEntry.wifeId);
      return toTime(left.birthDate) - toTime(right.birthDate) || left.id.localeCompare(right.id);
    });
    const wifeIds = sortedWifeEntries.map((entry) => entry.wifeId);

    husband.spouseRelations = sortedWifeEntries.map((entry) => ({
      spouseId: entry.wifeId,
      status: entry.status,
    }));
    husband.spouseIds = wifeIds;
    husband.spouseId = wifeIds[0];

    for (const entry of sortedWifeEntries) {
      const wife = reconciledMap.get(entry.wifeId);
      if (!wife || wife.gender !== "female") continue;
      wife.spouseRelations = [{
        spouseId: husbandId,
        status: entry.status,
      }];
      wife.spouseIds = [husbandId];
      wife.spouseId = husbandId;
    }
  }

  return syncMemberRelations(Array.from(reconciledMap.values()));
}

function reconcileMembersSafely(nextMembers: FamilyMember[], fallbackMembers: FamilyMember[]): FamilyMember[] {
  try {
    return applyFamilyRules(syncMemberRelations(nextMembers));
  } catch (error) {
    console.error("Safari Family failed to reconcile members and kept the last stable snapshot.", error);
    return fallbackMembers;
  }
}

export function useFamilyTree() {
  const [members, setMembers] = useState<FamilyMember[]>(loadMembersFromStorage);
  const [searchQuery, setSearchQuery] = useState("");
  const [generationFilter, setGenerationFilter] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => buildExpandedNodes(getInitialMembers()));
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addIntent, setAddIntent] = useState<AddMemberIntent | null>(null);
  const [syncStatus, setSyncStatus] = useState<FamilyTreeSyncStatus>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const cloudAvailableRef = useRef(false);
  const hydratedCloudRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const savingRef = useRef(false);
  const lastRemoteUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    persistMembers(members);
  }, [members]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCloud = async () => {
      const result = await loadCloudMembers();
      if (cancelled) return;

      cloudAvailableRef.current = result.available;
      hydratedCloudRef.current = true;

      if (!result.available) {
        setSyncStatus("local");
        return;
      }

      if (result.members) {
        applyingRemoteRef.current = true;
        setMembers(result.members);
        setExpandedNodes(buildExpandedNodes(result.members));
      }

      lastRemoteUpdateRef.current = result.updatedAt;
      setLastSyncedAt(result.updatedAt);
      setSyncStatus("synced");
    };

    void hydrateFromCloud();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedCloudRef.current) return;
    if (!cloudAvailableRef.current) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    setSyncStatus("saving");
    savingRef.current = true;

    const timer = window.setTimeout(async () => {
      const result = await saveCloudMembers(members);
      savingRef.current = false;

      if (!result.available) {
        cloudAvailableRef.current = false;
        setSyncStatus("local");
        return;
      }

      lastRemoteUpdateRef.current = result.updatedAt;
      setLastSyncedAt(result.updatedAt);
      setSyncStatus("synced");
    }, 450);

    return () => {
      window.clearTimeout(timer);
      savingRef.current = false;
    };
  }, [members]);

  useEffect(() => {
    if (!cloudAvailableRef.current) return undefined;

    let cancelled = false;

    const syncFromCloud = async () => {
      if (cancelled || savingRef.current) return;

      const result = await loadCloudMembers();
      if (cancelled || !result.available || !result.members || !result.updatedAt) return;
      if (result.updatedAt === lastRemoteUpdateRef.current) return;

      applyingRemoteRef.current = true;
      lastRemoteUpdateRef.current = result.updatedAt;
      setLastSyncedAt(result.updatedAt);
      setSyncStatus("synced");
      setMembers(result.members);
      setExpandedNodes(buildExpandedNodes(result.members));
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncFromCloud();
      }
    }, CLOUD_POLL_INTERVAL_MS);

    window.addEventListener("focus", syncFromCloud);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncFromCloud);
    };
  }, [syncStatus]);

  useEffect(() => {
    setSelectedMember((prev) => prev ? members.find((member) => member.id === prev.id) ?? null : null);
    setEditingMember((prev) => prev ? members.find((member) => member.id === prev.id) ?? null : null);
  }, [members]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const cancelAddMember = useCallback(() => {
    setIsAddingMember(false);
    setAddIntent(null);
  }, []);

  const addMember = useCallback((member: Omit<FamilyMember, "id">) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Date.now().toString();
    const nextMember = normalizeMemberRelations({ ...member, id });

    setMembers((prev) => reconcileMembersSafely([...prev, nextMember], prev));
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      for (const parentId of getParentIds(nextMember)) next.add(parentId);
      if (nextMember.isFamilyHead) next.add(nextMember.id);
      return next;
    });
    cancelAddMember();
  }, [cancelAddMember]);

  const updateMember = useCallback((updated: FamilyMember) => {
    setMembers((prev) => {
      const currentMember = prev.find((member) => member.id === updated.id);
      if (!currentMember) return prev;

      const previousSpouseIds = new Set(getSpouseIds(currentMember));
      const nextSpouseIds = new Set(getSpouseIds(updated));
      const removedSpouseIds = new Set(
        Array.from(previousSpouseIds).filter((spouseId) => !nextSpouseIds.has(spouseId)),
      );

      const nextMembers = prev.map((member) => {
        if (member.id === updated.id) {
          return normalizeMemberRelations(updated);
        }

        if (!removedSpouseIds.has(member.id)) return member;

        const spouseIds = getSpouseIds(member).filter((spouseId) => spouseId !== updated.id);
        return normalizeMemberRelations({
          ...member,
          spouseRelations: getSpouseRelations(member).filter((relation) => relation.spouseId !== updated.id),
          spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
        });
      });

      return reconcileMembersSafely(nextMembers, prev);
    });
    setEditingMember(null);
  }, []);

  const deleteMember = useCallback((id: string) => {
    setMembers((prev) => {
      const nextMembers = prev
        .filter((member) => member.id !== id)
        .map((member) => {
          const parentIds = getParentIds(member).filter((parentId) => parentId !== id);
          const spouseIds = getSpouseIds(member).filter((spouseId) => spouseId !== id);

          return normalizeMemberRelations({
            ...member,
            parentIds: parentIds.length > 0 ? parentIds : undefined,
            spouseRelations: getSpouseRelations(member).filter((relation) => relation.spouseId !== id),
            spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
          });
        });

      return reconcileMembersSafely(nextMembers, prev);
    });
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedMember((prev) => (prev?.id === id ? null : prev));
    setEditingMember((prev) => (prev?.id === id ? null : prev));
  }, []);

  const connectParent = useCallback((childId: string, parentId: string) => {
    if (childId === parentId) return;

    setMembers((prev) => {
      const parent = prev.find((member) => member.id === parentId);
      if (!parent) return prev;

      const nextMembers = prev.map((member) => {
        if (member.id !== childId) return member;

        const parentIds = Array.from(new Set([...getParentIds(member), parentId]));
        return normalizeMemberRelations({
          ...member,
          parentIds,
          generation: Math.max(member.generation, parent.generation + 1),
          isFamilyHead: false,
        });
      });

      return reconcileMembersSafely(nextMembers, prev);
    });

    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.add(parentId);
      return next;
    });
  }, []);

  const connectSpouse = useCallback((memberId: string, spouseId: string) => {
    if (memberId === spouseId) return;

    setMembers((prev) => {
      const source = prev.find((member) => member.id === memberId);
      const target = prev.find((member) => member.id === spouseId);
      if (!source || !target || source.gender === target.gender) return prev;

      const husbandId = source.gender === "male" ? source.id : target.id;
      const wifeId = source.gender === "female" ? source.id : target.id;

      const nextMembers = prev.map((member) => {
        if (member.id === husbandId) {
          return normalizeMemberRelations({
            ...member,
            spouseRelations: [
              ...getSpouseRelations(member),
              { spouseId: wifeId, status: "married" },
            ],
            spouseIds: Array.from(new Set([...getSpouseIds(member), wifeId])),
          });
        }

        if (member.id === wifeId) {
          return normalizeMemberRelations({
            ...member,
            spouseRelations: [{ spouseId: husbandId, status: "married" }],
            spouseIds: [husbandId],
          });
        }

        if (member.gender === "male" && getSpouseIds(member).includes(wifeId)) {
          return normalizeMemberRelations({
            ...member,
            spouseRelations: getSpouseRelations(member).filter((relation) => relation.spouseId !== wifeId),
            spouseIds: getSpouseIds(member).filter((id) => id !== wifeId),
          });
        }

        return member;
      });

      return reconcileMembersSafely(nextMembers, prev);
    });
  }, []);

  const setFamilyHead = useCallback((memberId: string, isFamilyHead = true) => {
    setMembers((prev) => {
      const nextMembers = prev.map((member) => {
        if (member.id !== memberId) return member;
        return normalizeMemberRelations({
          ...member,
          isFamilyHead,
          parentIds: isFamilyHead ? undefined : member.parentIds,
        });
      });

      return reconcileMembersSafely(nextMembers, prev);
    });
  }, []);

  const generations = useMemo(() => {
    const gens = new Set(members.map((m) => m.generation));
    return Array.from(gens).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (generationFilter !== null) {
      result = result.filter((m) => m.generation === generationFilter);
    }
    return result;
  }, [members, searchQuery, generationFilter]);

  const startAddMember = useCallback((intent?: AddMemberIntent) => {
    setIsAddingMember(true);
    setAddIntent(intent ?? null);

    const expandNodeIds = [...(intent?.parentIds ?? []), ...(intent?.spouseIds ?? [])];
    if (expandNodeIds.length > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        for (const id of expandNodeIds) next.add(id);
        return next;
      });
    }
  }, []);

  const replaceMembers = useCallback((nextMembers: FamilyMember[]) => {
    const reconciledMembers = reconcileMembersSafely(nextMembers, members);
    setMembers(reconciledMembers);
    setSelectedMember(null);
    setEditingMember(null);
    setIsAddingMember(false);
    setAddIntent(null);
    setExpandedNodes(() => {
      const next = new Set<string>();
      reconciledMembers.forEach((member) => {
        if (member.isFamilyHead) next.add(member.id);
        getParentIds(member).forEach((parentId) => next.add(parentId));
      });
      return next;
    });
  }, [members]);

  return {
    members,
    filteredMembers,
    searchQuery,
    setSearchQuery,
    generationFilter,
    setGenerationFilter,
    generations,
    expandedNodes,
    toggleNode,
    selectedMember,
    setSelectedMember,
    editingMember,
    setEditingMember,
    isAddingMember,
    setIsAddingMember,
    addIntent,
    startAddMember,
    cancelAddMember,
    addMember,
    updateMember,
    deleteMember,
    replaceMembers,
    connectParent,
    connectSpouse,
    setFamilyHead,
    syncStatus,
    lastSyncedAt,
  };
}
