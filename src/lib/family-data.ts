import initialMembersData from "@/data/family-tree.initial.json";

export type SpouseRelationStatus = "married" | "divorced";
export const MAX_INLINE_AVATAR_URL_LENGTH = 300_000;

export interface SpouseRelation {
  spouseId: string;
  status?: SpouseRelationStatus;
}

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
  stepParentIds?: string[];
  spouseIds?: string[];
  spouseRelations?: SpouseRelation[];
  isFamilyHead?: boolean;
  generation: number;
}

function uniqueIds(ids: Array<string | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function normalizeSpouseRelationStatus(status?: string): SpouseRelationStatus {
  return status === "divorced" ? "divorced" : "married";
}

function mergeSpouseRelationStatus(
  left?: SpouseRelationStatus,
  right?: SpouseRelationStatus,
): SpouseRelationStatus {
  return left === "divorced" || right === "divorced" ? "divorced" : "married";
}

function uniqueSpouseRelations(relations: Array<SpouseRelation | undefined>): SpouseRelation[] {
  const relationMap = new Map<string, SpouseRelationStatus>();

  relations.forEach((relation) => {
    const spouseId = typeof relation?.spouseId === "string" ? relation.spouseId.trim() : "";
    if (!spouseId) return;

    const nextStatus = normalizeSpouseRelationStatus(relation.status);
    const currentStatus = relationMap.get(spouseId);
    relationMap.set(spouseId, mergeSpouseRelationStatus(currentStatus, nextStatus));
  });

  return Array.from(relationMap.entries()).map(([spouseId, status]) => ({ spouseId, status }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeAvatarUrl(value?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;
  if (!trimmedValue.startsWith("data:")) return trimmedValue;

  return trimmedValue.length <= MAX_INLINE_AVATAR_URL_LENGTH ? trimmedValue : undefined;
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
    avatarUrl: sanitizeAvatarUrl(raw.avatarUrl),
    parentId: typeof raw.parentId === "string" ? raw.parentId : undefined,
    spouseId: typeof raw.spouseId === "string" ? raw.spouseId : undefined,
    parentIds: Array.isArray(raw.parentIds)
      ? raw.parentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined,
    stepParentIds: Array.isArray(raw.stepParentIds)
      ? raw.stepParentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined,
    spouseIds: Array.isArray(raw.spouseIds)
      ? raw.spouseIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : undefined,
    spouseRelations: Array.isArray(raw.spouseRelations)
      ? raw.spouseRelations
        .filter((value): value is Record<string, unknown> => isRecord(value))
        .map((relation) => ({
          spouseId: typeof relation.spouseId === "string" ? relation.spouseId.trim() : "",
          status: normalizeSpouseRelationStatus(
            typeof relation.status === "string" ? relation.status : undefined,
          ),
        }))
        .filter((relation) => relation.spouseId.length > 0)
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

export function getExplicitStepParentIds(member: FamilyMember): string[] {
  return uniqueIds(member.stepParentIds ?? []).filter((id) => id !== member.id);
}

export function getSpouseRelations(member: FamilyMember): SpouseRelation[] {
  const explicitRelations = Array.isArray(member.spouseRelations)
    ? member.spouseRelations
      .filter((relation): relation is SpouseRelation => typeof relation?.spouseId === "string")
      .map((relation) => ({
        spouseId: relation.spouseId.trim(),
        status: normalizeSpouseRelationStatus(relation.status),
      }))
      .filter((relation) => relation.spouseId.length > 0)
    : [];
  const legacyRelations = uniqueIds([...(member.spouseIds ?? []), member.spouseId]).map((spouseId) => ({
    spouseId,
    status: "married" as const,
  }));

  return uniqueSpouseRelations([...explicitRelations, ...legacyRelations])
    .filter((relation) => relation.spouseId !== member.id);
}

export function getSpouseIds(member: FamilyMember): string[] {
  return getSpouseRelations(member).map((relation) => relation.spouseId);
}

export function getSpouseRelationStatus(
  member: FamilyMember,
  spouseId: string,
): SpouseRelationStatus {
  return getSpouseRelations(member).find((relation) => relation.spouseId === spouseId)?.status ?? "married";
}

export function normalizeMemberRelations(member: FamilyMember): FamilyMember {
  const parentIds = getParentIds(member);
  const spouseRelations = getSpouseRelations(member);
  const spouseIds = spouseRelations.map((relation) => relation.spouseId);
  const stepParentIds = getExplicitStepParentIds(member).filter((parentId) => parentIds.includes(parentId));

  return {
    ...member,
    relation: member.relation?.trim() || "Anggota Keluarga",
    description: member.description ?? "",
    parentIds: parentIds.length > 0 ? parentIds : undefined,
    parentId: parentIds[0],
    stepParentIds: stepParentIds.length > 0 ? stepParentIds : undefined,
    spouseRelations: spouseRelations.length > 0 ? spouseRelations : undefined,
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
    const stepParentIds = getExplicitStepParentIds(member)
      .filter((parentId) => parentIds.includes(parentId) && normalized.has(parentId));
    const spouseRelations = getSpouseRelations(member)
      .filter((relation) => relation.spouseId !== member.id && normalized.has(relation.spouseId));
    const spouseIds = spouseRelations.map((relation) => relation.spouseId);

    member.parentIds = parentIds.length > 0 ? parentIds : undefined;
    member.parentId = parentIds[0];
    member.stepParentIds = stepParentIds.length > 0 ? stepParentIds : undefined;
    member.spouseRelations = spouseRelations.length > 0 ? spouseRelations : undefined;
    member.spouseIds = spouseIds.length > 0 ? spouseIds : undefined;
    member.spouseId = spouseIds[0];
  }

  for (const member of normalized.values()) {
    for (const relation of getSpouseRelations(member)) {
      const spouse = normalized.get(relation.spouseId);
      if (!spouse) continue;

      const reciprocalStatus = mergeSpouseRelationStatus(
        relation.status,
        getSpouseRelationStatus(spouse, member.id),
      );
      const spouseRelations = uniqueSpouseRelations([
        ...getSpouseRelations(spouse),
        { spouseId: member.id, status: reciprocalStatus },
      ]);

      spouse.spouseRelations = spouseRelations.length > 0 ? spouseRelations : undefined;
      spouse.spouseIds = spouseRelations.length > 0
        ? spouseRelations.map((entry) => entry.spouseId)
        : undefined;
      spouse.spouseId = spouse.spouseIds?.[0];
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

export function getStepParentIds(members: FamilyMember[], child: FamilyMember): string[] {
  const explicitStepParentIds = getExplicitStepParentIds(child);
  if (explicitStepParentIds.length > 0) return explicitStepParentIds;

  const parentIds = getParentIds(child);
  if (parentIds.length === 0) return [];

  const stepParentIds = new Set<string>();
  parentIds.forEach((parentId) => {
    getSpouses(members, parentId)
      .map((spouse) => spouse.id)
      .filter((spouseId) => !parentIds.includes(spouseId))
      .forEach((spouseId) => stepParentIds.add(spouseId));
  });

  return Array.from(stepParentIds);
}

export function isStepChildForMember(members: FamilyMember[], child: FamilyMember, memberId: string): boolean {
  return getStepParentIds(members, child).includes(memberId);
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
