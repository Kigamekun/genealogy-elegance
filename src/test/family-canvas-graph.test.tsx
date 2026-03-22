import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { FamilyCanvasGraph } from "@/components/FamilyCanvasGraph";
import { FamilyMember, syncMemberRelations } from "@/lib/family-data";

function member(overrides: Partial<FamilyMember> & Pick<FamilyMember, "id" | "name">): FamilyMember {
  return {
    id: overrides.id,
    name: overrides.name,
    birthDate: overrides.birthDate ?? "2000-01-01",
    gender: overrides.gender ?? "male",
    relation: overrides.relation ?? "Anggota",
    description: overrides.description ?? "",
    generation: overrides.generation ?? 1,
    deathDate: overrides.deathDate,
    avatarUrl: overrides.avatarUrl,
    parentId: overrides.parentId,
    parentIds: overrides.parentIds,
    spouseId: overrides.spouseId,
    spouseIds: overrides.spouseIds,
    isFamilyHead: overrides.isFamilyHead,
  };
}

const noop = () => undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderGraph(members: FamilyMember[]) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <FamilyCanvasGraph
        members={syncMemberRelations(members)}
        onSelectMember={noop}
        onEditMember={noop}
        onAddChild={noop}
        onAddSpouse={noop}
        onSetFamilyHead={noop}
        onDeleteMember={noop}
        onConnectParent={noop}
      />,
    );
  });

  return {
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function getTextNode(text: string): HTMLElement {
  const match = Array.from(document.querySelectorAll("p, span")).find((node) => node.textContent === text);
  if (!(match instanceof HTMLElement)) {
    throw new Error(`Text node not found: ${text}`);
  }
  return match;
}

function getCardCenterX(name: string): number {
  const label = getTextNode(name);
  const card = label.closest("div.absolute.group") as HTMLElement | null;
  if (!card) throw new Error(`Card wrapper not found for ${name}`);
  return parseFloat(card.style.left) + 130;
}

function withGraph(members: FamilyMember[], run: () => void) {
  const view = renderGraph(members);
  try {
    run();
  } finally {
    view.cleanup();
  }
}

describe("FamilyCanvasGraph layout", () => {
  it("keeps a three-child sibling row centered under the same parents", () => {
    withGraph([
      member({ id: "budi", name: "Budi", gender: "male", relation: "Ayah", birthDate: "1968-01-10", generation: 2, spouseIds: ["dewi"] }),
      member({ id: "dewi", name: "Dewi", gender: "female", relation: "Ibu", birthDate: "1970-11-05", generation: 2, spouseIds: ["budi"] }),
      member({ id: "fajar", name: "Fajar", gender: "male", relation: "Anak", birthDate: "1995-04-12", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "anisa", name: "Anisa", gender: "female", relation: "Anak", birthDate: "1998-12-25", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "test", name: "Test", gender: "male", relation: "Anak", birthDate: "2002-01-15", generation: 3, parentIds: ["budi", "dewi"] }),
    ], () => {
      const pairCenter = (getCardCenterX("Budi") + getCardCenterX("Dewi")) / 2;
      const childrenCenter = (
        getCardCenterX("Fajar")
        + getCardCenterX("Anisa")
        + getCardCenterX("Test")
      ) / 3;

      expect(Math.abs(childrenCenter - pairCenter)).toBeLessThan(1);
    });
  });

  it("anchors each child cluster to the correct wife in a multi-wife family", () => {
    withGraph([
      member({ id: "hendra", name: "Hendra Wijaya", gender: "male", relation: "Paman", birthDate: "1971-09-30", generation: 2, spouseIds: ["ratna", "fe"] }),
      member({ id: "ratna", name: "Ratna Suryadi", gender: "female", relation: "Bibi", birthDate: "1972-06-18", generation: 2, spouseIds: ["hendra"] }),
      member({ id: "fe", name: "Fe", gender: "female", relation: "Istri", birthDate: "1976-01-01", generation: 2, spouseIds: ["hendra"] }),
      member({ id: "rizky", name: "Rizky Wijaya", gender: "male", relation: "Anak", birthDate: "1997-08-08", generation: 3, parentIds: ["hendra", "ratna"] }),
      member({ id: "gob", name: "GOB", gender: "male", relation: "Anak", birthDate: "2005-02-01", generation: 3, parentIds: ["hendra", "fe"] }),
    ], () => {
      const hendraCenter = getCardCenterX("Hendra Wijaya");
      const ratnaPairCenter = (hendraCenter + getCardCenterX("Ratna Suryadi")) / 2;
      const fePairCenter = (hendraCenter + getCardCenterX("Fe")) / 2;

      expect(Math.abs(getCardCenterX("Rizky Wijaya") - ratnaPairCenter)).toBeLessThan(1);
      expect(Math.abs(getCardCenterX("GOB") - fePairCenter)).toBeLessThan(1);
    });
  });

  it("hides relative role labels and shows gender badges instead", () => {
    withGraph([
      member({ id: "ayah", name: "Ahmad Suryadi", gender: "male", relation: "Kakek", birthDate: "1940-03-15", generation: 1 }),
      member({ id: "ibu", name: "Siti Rahayu", gender: "female", relation: "Nenek", birthDate: "1945-07-22", generation: 1 }),
    ], () => {
      expect(document.body.textContent).not.toContain("Kakek");
      expect(document.body.textContent).not.toContain("Nenek");
      expect(document.body.textContent).toContain("♂");
      expect(document.body.textContent).toContain("♀");
    });
  });
});
