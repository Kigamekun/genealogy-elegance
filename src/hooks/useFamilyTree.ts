import { useState, useCallback, useMemo, useEffect } from "react";
import {
  FamilyMember,
  getInitialMembers,
  hydrateMembers,
  getParentIds,
  getSpouseIds,
  normalizeMemberRelations,
  syncMemberRelations,
} from "@/lib/family-data";

export type AddRelationHint = "child" | "spouse" | "head" | "member";

export interface AddMemberIntent {
  parentIds?: string[];
  spouseIds?: string[];
  asFamilyHead?: boolean;
  relationHint?: AddRelationHint;
  genderHint?: FamilyMember["gender"];
}

function toTime(dateString: string): number {
  const value = Date.parse(dateString);
  return Number.isNaN(value) ? 0 : value;
}

const STORAGE_KEY = "genealogy-elegance.members.v2";

function loadMembersFromStorage(): FamilyMember[] {
  if (typeof window === "undefined") return getInitialMembers();

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
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

function applyFamilyRules(members: FamilyMember[]): FamilyMember[] {
  const normalized = members.map((member) => normalizeMemberRelations(member));
  const normalizedById = new Map(normalized.map((member) => [member.id, member]));

  const candidatesByWife = new Map<string, Set<string>>();
  const registerPair = (husbandId: string, wifeId: string) => {
    if (!candidatesByWife.has(wifeId)) candidatesByWife.set(wifeId, new Set());
    candidatesByWife.get(wifeId)!.add(husbandId);
  };

  for (const member of normalized) {
    for (const spouseId of getSpouseIds(member)) {
      const spouse = normalizedById.get(spouseId);
      if (!spouse) continue;

      if (member.gender === "male" && spouse.gender === "female") {
        registerPair(member.id, spouse.id);
      } else if (member.gender === "female" && spouse.gender === "male") {
        registerPair(spouse.id, member.id);
      }
    }
  }

  const wivesByHusband = new Map<string, Set<string>>();
  for (const [wifeId, husbandCandidates] of candidatesByWife.entries()) {
    const selectedHusbandId = Array.from(husbandCandidates).sort((leftId, rightId) => {
      const left = normalizedById.get(leftId);
      const right = normalizedById.get(rightId);
      if (!left || !right) return leftId.localeCompare(rightId);
      return toTime(left.birthDate) - toTime(right.birthDate) || left.id.localeCompare(right.id);
    })[0];

    if (!selectedHusbandId) continue;
    if (!wivesByHusband.has(selectedHusbandId)) wivesByHusband.set(selectedHusbandId, new Set());
    wivesByHusband.get(selectedHusbandId)!.add(wifeId);
  }

  const reconciledMap = new Map(
    normalized.map((member) => [
      member.id,
      normalizeMemberRelations({
        ...member,
        spouseIds: undefined,
        spouseId: undefined,
      }),
    ]),
  );

  for (const [husbandId, wifeIdsSet] of wivesByHusband.entries()) {
    const husband = reconciledMap.get(husbandId);
    if (!husband || husband.gender !== "male") continue;

    const wifeIds = Array.from(wifeIdsSet).sort((leftId, rightId) => {
      const left = reconciledMap.get(leftId);
      const right = reconciledMap.get(rightId);
      if (!left || !right) return leftId.localeCompare(rightId);
      return toTime(left.birthDate) - toTime(right.birthDate) || left.id.localeCompare(right.id);
    });

    husband.spouseIds = wifeIds;
    husband.spouseId = wifeIds[0];

    for (const wifeId of wifeIds) {
      const wife = reconciledMap.get(wifeId);
      if (!wife || wife.gender !== "female") continue;
      wife.spouseIds = [husbandId];
      wife.spouseId = husbandId;
    }
  }

  return syncMemberRelations(Array.from(reconciledMap.values()));
}

export function useFamilyTree() {
  const [members, setMembers] = useState<FamilyMember[]>(loadMembersFromStorage);
  const [searchQuery, setSearchQuery] = useState("");
  const [generationFilter, setGenerationFilter] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(
    getInitialMembers()
      .filter((member) => member.isFamilyHead || getParentIds(member).length === 0)
      .map((member) => member.id),
  ));
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addIntent, setAddIntent] = useState<AddMemberIntent | null>(null);

  useEffect(() => {
    persistMembers(members);
  }, [members]);

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

    setMembers((prev) => applyFamilyRules([...prev, nextMember]));
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
          spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
        });
      });

      return applyFamilyRules(nextMembers);
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
            spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
          });
        });

      return applyFamilyRules(nextMembers);
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

      return applyFamilyRules(nextMembers);
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
            spouseIds: Array.from(new Set([...getSpouseIds(member), wifeId])),
          });
        }

        if (member.id === wifeId) {
          return normalizeMemberRelations({
            ...member,
            spouseIds: [husbandId],
          });
        }

        if (member.gender === "male" && getSpouseIds(member).includes(wifeId)) {
          return normalizeMemberRelations({
            ...member,
            spouseIds: getSpouseIds(member).filter((id) => id !== wifeId),
          });
        }

        return member;
      });

      return applyFamilyRules(nextMembers);
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

      return applyFamilyRules(nextMembers);
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
    const reconciledMembers = applyFamilyRules(syncMemberRelations(nextMembers));
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
  }, []);

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
  };
}
