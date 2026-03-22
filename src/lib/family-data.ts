import avatarAhmad from "@/assets/avatar-ahmad.jpg";
import avatarSiti from "@/assets/avatar-siti.jpg";
import avatarBudi from "@/assets/avatar-budi.jpg";
import avatarDewi from "@/assets/avatar-dewi.jpg";
import avatarRatna from "@/assets/avatar-ratna.jpg";
import avatarHendra from "@/assets/avatar-hendra.jpg";
import avatarFajar from "@/assets/avatar-fajar.jpg";
import avatarAnisa from "@/assets/avatar-anisa.jpg";
import avatarRizky from "@/assets/avatar-rizky.jpg";

export interface FamilyMember {
  id: string;
  name: string;
  birthDate: string;
  deathDate?: string;
  gender: "male" | "female";
  relation: string;
  description: string;
  avatarUrl?: string;
  // Legacy fields kept for compatibility with older persisted data.
  parentId?: string;
  spouseId?: string;
  // New relationship fields that allow multiple relations.
  parentIds?: string[];
  spouseIds?: string[];
  isFamilyHead?: boolean;
  generation: number;
}

const initialMembers: FamilyMember[] = [
  {
    id: "1", name: "Ahmad Suryadi", birthDate: "1940-03-15", deathDate: "2015-08-20",
    gender: "male", relation: "Kakek",
    description: "Pendiri keluarga besar Suryadi, seorang guru besar di Universitas Gadjah Mada.",
    avatarUrl: avatarAhmad, generation: 1, isFamilyHead: true, spouseIds: ["2"],
  },
  {
    id: "2", name: "Siti Rahayu", birthDate: "1945-07-22",
    gender: "female", relation: "Nenek",
    description: "Ibu dari tiga anak, dikenal sebagai perajin batik yang berbakat.",
    avatarUrl: avatarSiti, spouseIds: ["1"], generation: 1,
  },
  {
    id: "3", name: "Budi Suryadi", birthDate: "1968-01-10",
    gender: "male", relation: "Ayah",
    description: "Anak sulung, bekerja sebagai dokter spesialis di Jakarta.",
    avatarUrl: avatarBudi, parentIds: ["1", "2"], spouseIds: ["4"], generation: 2,
  },
  {
    id: "4", name: "Dewi Lestari", birthDate: "1970-11-05",
    gender: "female", relation: "Ibu",
    description: "Istri Budi, seorang arsitek yang merancang berbagai bangunan ikonik.",
    avatarUrl: avatarDewi, spouseIds: ["3"], generation: 2,
  },
  {
    id: "5", name: "Ratna Suryadi", birthDate: "1972-06-18",
    gender: "female", relation: "Bibi",
    description: "Anak kedua, seorang pengusaha kuliner sukses di Yogyakarta.",
    avatarUrl: avatarRatna, parentIds: ["1", "2"], spouseIds: ["6"], generation: 2,
  },
  {
    id: "6", name: "Hendra Wijaya", birthDate: "1971-09-30",
    gender: "male", relation: "Paman",
    description: "Suami Ratna, seorang seniman dan fotografer profesional.",
    avatarUrl: avatarHendra, spouseIds: ["5"], generation: 2,
  },
  {
    id: "7", name: "Fajar Suryadi", birthDate: "1995-04-12",
    gender: "male", relation: "Anak",
    description: "Anak pertama Budi, mahasiswa S2 teknik informatika.",
    avatarUrl: avatarFajar, parentIds: ["3", "4"], generation: 3,
  },
  {
    id: "8", name: "Anisa Suryadi", birthDate: "1998-12-25",
    gender: "female", relation: "Anak",
    description: "Anak kedua Budi, seorang desainer grafis berbakat.",
    avatarUrl: avatarAnisa, parentIds: ["3", "4"], generation: 3,
  },
  {
    id: "9", name: "Rizky Wijaya", birthDate: "1997-08-08",
    gender: "male", relation: "Sepupu",
    description: "Anak Ratna dan Hendra, seorang musisi dan komposer.",
    avatarUrl: avatarRizky, parentIds: ["5", "6"], generation: 3,
  },
];

function uniqueIds(ids: Array<string | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
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
  return syncMemberRelations(initialMembers.map((member) => ({ ...member })));
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
