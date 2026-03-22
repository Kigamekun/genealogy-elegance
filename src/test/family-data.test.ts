import { describe, expect, it } from "vitest";
import {
  type FamilyMember,
  getFamilyChildren,
  getRootMembers,
  getSpouses,
  isStepChildForMember,
  syncMemberRelations,
} from "@/lib/family-data";

function member(overrides: Partial<FamilyMember> & Pick<FamilyMember, "id" | "name">): FamilyMember {
  return {
    id: overrides.id,
    name: overrides.name,
    birthDate: overrides.birthDate ?? "1980-01-01",
    gender: overrides.gender ?? "male",
    relation: overrides.relation ?? "Anggota",
    description: overrides.description ?? "",
    generation: overrides.generation ?? 1,
    parentIds: overrides.parentIds,
    spouseIds: overrides.spouseIds,
    isFamilyHead: overrides.isFamilyHead,
  };
}

describe("family-data relationships", () => {
  it("supports multiple spouses and keeps links reciprocal", () => {
    const members = syncMemberRelations([
      member({ id: "head", name: "Kepala", spouseIds: ["wife-1", "wife-2"], isFamilyHead: true }),
      member({ id: "wife-1", name: "Istri 1", gender: "female" }),
      member({ id: "wife-2", name: "Istri 2", gender: "female" }),
    ]);

    expect(getSpouses(members, "head").map((spouse) => spouse.id)).toEqual(["wife-1", "wife-2"]);
    expect(getSpouses(members, "wife-2").map((spouse) => spouse.id)).toEqual(["head"]);
  });

  it("can identify stepchildren from spouse-side parent links", () => {
    const members = syncMemberRelations([
      member({ id: "father", name: "Ayah", spouseIds: ["mother"], isFamilyHead: true }),
      member({ id: "mother", name: "Ibu", gender: "female" }),
      member({ id: "child-bio", name: "Anak Kandung", parentIds: ["father", "mother"], generation: 2 }),
      member({ id: "child-step", name: "Anak Sambung", parentIds: ["mother"], generation: 2 }),
    ]);

    const fatherChildren = getFamilyChildren(members, "father").map((child) => child.id);
    const stepChild = members.find((familyMember) => familyMember.id === "child-step")!;
    const bioChild = members.find((familyMember) => familyMember.id === "child-bio")!;

    expect(fatherChildren).toEqual(["child-bio", "child-step"]);
    expect(isStepChildForMember(members, stepChild, "father")).toBe(true);
    expect(isStepChildForMember(members, bioChild, "father")).toBe(false);
  });

  it("returns family heads and independent roots", () => {
    const members = syncMemberRelations([
      member({ id: "head-a", name: "Kepala A", isFamilyHead: true }),
      member({ id: "head-b", name: "Kepala B" }),
      member({ id: "spouse-b", name: "Pasangan B", gender: "female", spouseIds: ["head-b"] }),
      member({ id: "child", name: "Anak B", parentIds: ["head-b", "spouse-b"], generation: 2 }),
    ]);

    expect(getRootMembers(members).map((root) => root.id)).toEqual(["head-a", "head-b"]);
  });
});
