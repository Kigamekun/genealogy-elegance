import initialMembersData from "@/data/family-tree.initial.json";

export interface FamilyMember {
  id: string;
  name: string;
  birthDate: string;
  deathDate?: string;
  gender: "male" | "female";
  relation: string;
  description: string;
  avatarUrl?: string;
  parentId?: string;
  spouseId?: string;
  parentIds?: string[];
  spouseIds?: string[];
  isFamilyHead?: boolean;
  generation: number;
}

function uniqueIds(ids: Array<string | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceMember(raw: unknown): FamilyMember | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === "string" ? raw.id : undefined;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const birthDate = typeof raw.birthDate === "string" ? raw.birthDate : "";
  const gender = raw.gender === "female" ? "female" : raw.gender === "male" ? "male" : undefined;
  const generation = Number(raw.generation);

  if (!id || !name || !birthDate || !gender || !Number.isFinite(generation)) {
    return null;
  }

  return normalizeMemberRelations({
    id,
    name,
    birthDate,
    deathDate: typeof raw.deathDate === "string" ? raw.deathDate : undefined,
    gender,
    relation: typeof raw.relation === "string" && raw.relation.trim() ? raw.relation : "Anggota Keluarga",
    description: typeof raw.description === "string" ? raw.description : "",
    avatarUrl: typeof raw.avatarUrl === "string" && raw.avatarUrl.trim() ? raw.avatarUrl : undefined,
    parentId: typeof raw.parentId === "string" ? raw.parentId : undefined,
    spouseId: typeof raw.spouseId === "string" ? raw.spouseId : undefined,
    parentIds: Array.isArray(raw.parentIds)
      ? raw.parentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined,
    spouseIds: Array.isArray(raw.spouseIds)
      ? raw.spouseIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined,
    isFamilyHead: Boolean(raw.isFamilyHead),
    generation: Math.max(1, Math.round(generation)),
  });
}

export function hydrateMembers(rawMembers: unknown): FamilyMember[] {
  if (!Array.isArray(rawMembers)) return [];

  const members = rawMembers
    .map((rawMember) => coerceMember(rawMember))
    .filter((member): member is FamilyMember => Boolean(member));

  return syncMemberRelations(members);
}

export function getParentIds(member: FamilyMember): string[] {
  return uniqueIds([...(member.parentIds ?? []), member.parentId]);
}

export function getSpouseIds(member: FamilyMember): string[] {
  return uniqueIds([...(member.spouseIds ?? []), member.spouseId]).filter((id) => id !== member.id);
}

export function normalizeMemberRelations(member: FamilyMember): FamilyMember {
  const parentIds = getParentIds(member);
  const spouseIds = getSpouseIds(member);

  return {
    ...member,
    relation: member.relation?.trim() || "Anggota Keluarga",
    description: member.description ?? "",
    parentIds: parentIds.length > 0 ? parentIds : undefined,
    parentId: parentIds[0],
    spouseIds: spouseIds.length > 0 ? spouseIds : undefined,
    spouseId: spouseIds[0],
  };
}

export function syncMemberRelations(members: FamilyMember[]): FamilyMember[] {
  const normalized = new Map(
    members.map((member) => [member.id, normalizeMemberRelations(member)]),
  );

  for (const member of normalized.values()) {
    const parentIds = getParentIds(member).filter((parentId) => parentId !== member.id && normalized.has(parentId));
    const spouseIds = getSpouseIds(member).filter((spouseId) => spouseId !== member.id && normalized.has(spouseId));

    member.parentIds = parentIds.length > 0 ? parentIds : undefined;
    member.parentId = parentIds[0];
    member.spouseIds = spouseIds.length > 0 ? spouseIds : undefined;
    member.spouseId = spouseIds[0];
  }

  for (const member of normalized.values()) {
    for (const spouseId of getSpouseIds(member)) {
      const spouse = normalized.get(spouseId);
      if (!spouse) continue;

      const reciprocalSpouseIds = new Set(getSpouseIds(spouse));
      reciprocalSpouseIds.add(member.id);
      const spouseIds = Array.from(reciprocalSpouseIds);

      spouse.spouseIds = spouseIds.length > 0 ? spouseIds : undefined;
      spouse.spouseId = spouseIds[0];
    }
  }

  return members.map((member) => normalizeMemberRelations(normalized.get(member.id)!));
}

export function getInitialMembers(): FamilyMember[] {
  return hydrateMembers(initialMembersData);
}

export function getChildren(members: FamilyMember[], parentId: string): FamilyMember[] {
  return members
    .filter((member) => getParentIds(member).includes(parentId))
    .sort((a, b) => a.birthDate.localeCompare(b.birthDate));
}

export function getSpouses(members: FamilyMember[], memberId: string): FamilyMember[] {
  const member = members.find((m) => m.id === memberId);
  if (!member) return [];

  const spouseIds = new Set(getSpouseIds(member));
  for (const candidate of members) {
    if (candidate.id === memberId) continue;
    if (getSpouseIds(candidate).includes(memberId)) spouseIds.add(candidate.id);
  }

  return Array.from(spouseIds)
    .map((spouseId) => members.find((candidate) => candidate.id === spouseId))
    .filter((candidate): candidate is FamilyMember => Boolean(candidate))
    .sort((a, b) => a.birthDate.localeCompare(b.birthDate));
}

export function getFamilyChildren(members: FamilyMember[], memberId: string): FamilyMember[] {
  const spouseIds = getSpouses(members, memberId).map((spouse) => spouse.id);
  const relatedParentIds = new Set([memberId, ...spouseIds]);

  return members
    .filter((member) => getParentIds(member).some((parentId) => relatedParentIds.has(parentId)))
    .sort((a, b) => a.birthDate.localeCompare(b.birthDate));
}

export function isStepChildForMember(members: FamilyMember[], child: FamilyMember, memberId: string): boolean {
  const parentIds = getParentIds(child);
  if (parentIds.includes(memberId)) return false;

  const spouseIds = new Set(getSpouses(members, memberId).map((spouse) => spouse.id));
  return parentIds.some((parentId) => spouseIds.has(parentId));
}

export function getRootMembers(members: FamilyMember[]): FamilyMember[] {
  const rootMap = new Map<string, FamilyMember>();
  const noParentMembers = members.filter((member) => getParentIds(member).length === 0);
  const noParentMap = new Map(noParentMembers.map((member) => [member.id, member]));

  for (const familyHead of noParentMembers.filter((member) => member.isFamilyHead)) {
    rootMap.set(familyHead.id, familyHead);
  }

  const visited = new Set<string>();
  for (const candidate of noParentMembers) {
    if (visited.has(candidate.id)) continue;

    const componentIds: string[] = [];
    const queue = [candidate.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      componentIds.push(currentId);

      for (const spouseId of getSpouseIds(noParentMap.get(currentId)!)) {
        if (noParentMap.has(spouseId) && !visited.has(spouseId)) {
          queue.push(spouseId);
        }
      }
    }

    const componentHasFamilyHead = componentIds.some((memberId) => rootMap.has(memberId));
    if (componentHasFamilyHead) continue;

    const representative = componentIds
      .map((memberId) => noParentMap.get(memberId)!)
      .sort((a, b) => a.birthDate.localeCompare(b.birthDate) || a.id.localeCompare(b.id))[0];

    if (representative) rootMap.set(representative.id, representative);
  }

  return Array.from(rootMap.values()).sort((a, b) => a.birthDate.localeCompare(b.birthDate));
}
