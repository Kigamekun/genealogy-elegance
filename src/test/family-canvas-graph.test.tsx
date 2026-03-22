import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
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
    stepParentIds: overrides.stepParentIds,
    spouseId: overrides.spouseId,
    spouseIds: overrides.spouseIds,
    spouseRelations: overrides.spouseRelations,
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

function getCardTopY(name: string): number {
  const label = getTextNode(name);
  const card = label.closest("div.absolute.group") as HTMLElement | null;
  if (!card) throw new Error(`Card wrapper not found for ${name}`);
  return parseFloat(card.style.top) - 24;
}

function getCardRects() {
  return Array.from(document.querySelectorAll("div.absolute.group")).map((card, index) => {
    const element = card as HTMLElement;
    const left = parseFloat(element.style.left);
    const top = parseFloat(element.style.top);

    return {
      index,
      left,
      top,
      right: left + 260,
      bottom: top + 136,
      text: element.textContent ?? `card-${index}`,
    };
  });
}

function hasConnectorEndpoint(x: number, y: number): boolean {
  const connectorSvg = document.querySelector("svg.absolute.inset-0");
  if (!(connectorSvg instanceof SVGElement)) {
    throw new Error("Connector SVG not found");
  }

  return Array.from(connectorSvg.querySelectorAll("path")).some((path) => {
    const d = path.getAttribute("d");
    if (!d) return false;
    const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length < 2) return false;

    const endX = numbers[numbers.length - 2];
    const endY = numbers[numbers.length - 1];
    return Math.abs(endX - x) < 1 && Math.abs(endY - y) < 1;
  });
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
      expect(Math.abs(getCardCenterX("Rizky Wijaya") - getCardCenterX("Ratna Suryadi"))).toBeLessThan(1);
      expect(Math.abs(getCardCenterX("GOB") - getCardCenterX("Fe"))).toBeLessThan(1);
    });
  });

  it("keeps each wife branch centered when one husband has children with multiple wives", () => {
    withGraph([
      member({ id: "budi", name: "Budi", gender: "male", birthDate: "1968-01-10", generation: 2, spouseIds: ["dewi", "tesa"] }),
      member({ id: "dewi", name: "Dewi", gender: "female", birthDate: "1970-11-05", generation: 2, spouseIds: ["budi"] }),
      member({ id: "tesa", name: "Tesa", gender: "female", birthDate: "1976-02-14", generation: 2, spouseIds: ["budi"] }),
      member({ id: "fajar", name: "Fajar", gender: "male", birthDate: "1995-04-12", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "anisa", name: "Anisa", gender: "female", birthDate: "1998-12-25", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "sds", name: "sds", gender: "male", birthDate: "2026-01-15", generation: 3, parentIds: ["budi", "tesa"] }),
    ], () => {
      const dewiChildrenCenter = (getCardCenterX("Fajar") + getCardCenterX("Anisa")) / 2;

      expect(Math.abs(dewiChildrenCenter - getCardCenterX("Dewi"))).toBeLessThan(1);
      expect(Math.abs(getCardCenterX("sds") - getCardCenterX("Tesa"))).toBeLessThan(1);
    });
  });

  it("shifts the second wife branch so each sibling row stays centered under its own mother", () => {
    withGraph([
      member({ id: "budi", name: "Budi", gender: "male", birthDate: "1968-01-10", generation: 2, spouseIds: ["dewi", "tesa"] }),
      member({ id: "dewi", name: "Dewi", gender: "female", birthDate: "1970-11-05", generation: 2, spouseIds: ["budi"] }),
      member({ id: "tesa", name: "Tesa", gender: "female", birthDate: "1976-02-14", generation: 2, spouseIds: ["budi"] }),
      member({ id: "fajar", name: "Fajar", gender: "male", birthDate: "1995-04-12", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "anisa", name: "Anisa", gender: "female", birthDate: "1998-12-25", generation: 3, parentIds: ["budi", "dewi"] }),
      member({ id: "ds", name: "ds", gender: "male", birthDate: "2024-01-01", generation: 3, parentIds: ["budi", "tesa"] }),
      member({ id: "test", name: "test", gender: "male", birthDate: "2025-01-01", generation: 3, parentIds: ["budi", "tesa"] }),
      member({ id: "fs", name: "fs", gender: "male", birthDate: "2026-01-01", generation: 3, parentIds: ["budi", "tesa"] }),
    ], () => {
      const dewiChildrenCenter = (getCardCenterX("Fajar") + getCardCenterX("Anisa")) / 2;
      const tesaChildrenCenter = (getCardCenterX("ds") + getCardCenterX("test") + getCardCenterX("fs")) / 3;

      expect(Math.abs(dewiChildrenCenter - getCardCenterX("Dewi"))).toBeLessThan(1);
      expect(Math.abs(tesaChildrenCenter - getCardCenterX("Tesa"))).toBeLessThan(1);
      expect(getCardCenterX("Tesa")).toBeGreaterThan(getCardCenterX("Dewi"));
    });
  });

  it("hides relative role labels and shows gender badges instead", () => {
    withGraph([
      member({ id: "ayah", name: "Ahmad Suryadi", gender: "male", relation: "Kakek", birthDate: "1940-03-15", generation: 1 }),
      member({ id: "ibu", name: "Siti Rahayu", gender: "female", relation: "Nenek", birthDate: "1945-07-22", generation: 1 }),
    ], () => {
      expect(document.body.textContent).not.toContain("Kakek");
      expect(document.body.textContent).not.toContain("Nenek");
      expect(document.querySelector('[aria-label="Laki-laki"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Perempuan"]')).not.toBeNull();
    });
  });

  it("connects parent lines to the actual child card instead of the spouse gap", () => {
    withGraph([
      member({ id: "ahmad", name: "Ahmad Suryadi", gender: "male", birthDate: "1940-03-15", generation: 1, spouseIds: ["siti"] }),
      member({ id: "siti", name: "Siti Rahayu", gender: "female", birthDate: "1945-07-22", generation: 1, spouseIds: ["ahmad"] }),
      member({ id: "budi", name: "Budi Suryadi", gender: "male", birthDate: "1968-01-10", generation: 2, spouseIds: ["dewi"], parentIds: ["ahmad", "siti"] }),
      member({ id: "dewi", name: "Dewi Lestari", gender: "female", birthDate: "1970-11-05", generation: 2, spouseIds: ["budi"] }),
      member({ id: "ratna", name: "Ratna Suryadi", gender: "female", birthDate: "1972-06-18", generation: 2, spouseIds: ["hendra"], parentIds: ["ahmad", "siti"] }),
      member({ id: "hendra", name: "Hendra Wijaya", gender: "male", birthDate: "1971-09-30", generation: 2, spouseIds: ["ratna"] }),
    ], () => {
      expect(hasConnectorEndpoint(getCardCenterX("Budi Suryadi"), getCardTopY("Budi Suryadi"))).toBe(true);
      expect(hasConnectorEndpoint(getCardCenterX("Ratna Suryadi"), getCardTopY("Ratna Suryadi"))).toBe(true);
    });
  });

  it("shows age for deceased members and colors divorced spouse lines red", () => {
    withGraph([
      member({
        id: "ayah",
        name: "Ayah",
        gender: "male",
        birthDate: "1970-01-01",
        deathDate: "2020-01-01",
        generation: 1,
        spouseRelations: [{ spouseId: "ibu", status: "divorced" }],
      }),
      member({
        id: "ibu",
        name: "Ibu",
        gender: "female",
        birthDate: "1975-01-01",
        generation: 1,
        spouseRelations: [{ spouseId: "ayah", status: "divorced" }],
      }),
    ], () => {
      expect(document.body.textContent).toContain("Umur 50 tahun");

      const divorcedLine = Array.from(document.querySelectorAll("line")).find(
        (line) => line.getAttribute("stroke") === "hsl(var(--destructive) / 0.82)",
      );
      expect(divorcedLine).not.toBeUndefined();
    });
  });

  it("draws a red step-parent connector for stepchildren", () => {
    withGraph([
      member({ id: "ayah", name: "Ayah", gender: "male", birthDate: "1970-01-01", generation: 1, spouseIds: ["ibu"] }),
      member({ id: "ibu", name: "Ibu", gender: "female", birthDate: "1975-01-01", generation: 1, spouseIds: ["ayah"] }),
      member({
        id: "anak",
        name: "Anak Sambung",
        gender: "male",
        birthDate: "2008-01-01",
        generation: 2,
        parentIds: ["ayah", "ibu"],
        stepParentIds: ["ayah"],
      }),
    ], () => {
      const stepConnector = Array.from(document.querySelectorAll("path")).find(
        (path) => path.getAttribute("stroke") === "hsl(28 92% 54% / 0.96)",
      );
      expect(stepConnector).not.toBeUndefined();
    });
  });

  it("keeps production-like family branches from overlapping cards when wide subtrees are separated", () => {
    withGraph([
      member({ id: "root-a", name: "Ahmad Safari", gender: "male", birthDate: "1928-01-01", generation: 1, spouseIds: ["root-b"] }),
      member({ id: "root-b", name: "Saribanon", gender: "female", birthDate: "1933-01-01", generation: 1, spouseIds: ["root-a"] }),

      member({ id: "sjafrudin", name: "Sjafrudin", gender: "male", birthDate: "1952-06-02", generation: 2, parentIds: ["root-a", "root-b"], spouseIds: ["aminah"] }),
      member({ id: "aminah", name: "Siti Aminah", gender: "female", birthDate: "1964-03-22", generation: 2, spouseIds: ["sjafrudin"] }),
      member({ id: "rifai", name: "D Ahmad Rifai", gender: "male", birthDate: "1947-06-26", generation: 2, parentIds: ["root-a", "root-b"], spouseIds: ["yatti"] }),
      member({ id: "yatti", name: "R Yatti Rochayati", gender: "female", birthDate: "1955-06-28", generation: 2, spouseIds: ["rifai"] }),
      member({ id: "obay", name: "Obay Sobari", gender: "male", birthDate: "1952-11-01", generation: 2, parentIds: ["root-a", "root-b"], spouseIds: ["yeti", "hasanah"] }),
      member({ id: "yeti", name: "Yeti", gender: "female", birthDate: "1959-01-01", generation: 2, spouseIds: ["obay"] }),
      member({ id: "hasanah", name: "Hasanah", gender: "female", birthDate: "1957-01-01", generation: 2, spouseIds: ["obay"] }),

      member({ id: "syahrullah", name: "Syahrullah Harits", gender: "male", birthDate: "1979-06-22", generation: 3, parentIds: ["sjafrudin", "aminah"], spouseIds: ["awit"] }),
      member({ id: "awit", name: "awit r.u", gender: "female", birthDate: "1983-03-22", generation: 3, spouseIds: ["syahrullah"] }),
      member({ id: "harun", name: "Harun Arrasyid", gender: "male", birthDate: "1980-11-19", generation: 3, parentIds: ["sjafrudin", "aminah"], spouseIds: ["novi", "pipit", "rahmadania"] }),
      member({ id: "novi", name: "Novi Indrianti", gender: "female", birthDate: "1982-01-01", generation: 3, spouseIds: ["harun"] }),
      member({ id: "pipit", name: "Pipit yulianti", gender: "female", birthDate: "1985-03-22", generation: 3, spouseIds: ["harun"] }),
      member({ id: "rahmadania", name: "Siti Rahmadaniawati", gender: "female", birthDate: "1989-03-22", generation: 3, spouseIds: ["harun"] }),
      member({ id: "rifki", name: "Rifki Aditya", gender: "male", birthDate: "1990-01-01", generation: 3, parentIds: ["sjafrudin", "aminah"] }),
      member({ id: "afifah", name: "Afifah Levita", gender: "female", birthDate: "1992-01-01", generation: 3, parentIds: ["sjafrudin", "aminah"] }),
      member({ id: "salam", name: "Salam Aulia", gender: "male", birthDate: "1994-01-01", generation: 3, parentIds: ["sjafrudin", "aminah"], spouseIds: ["suci"] }),
      member({ id: "suci", name: "Suci", gender: "female", birthDate: "1995-01-01", generation: 3, spouseIds: ["salam"] }),
      member({ id: "irania", name: "Irania Israni", gender: "female", birthDate: "1996-01-01", generation: 3, parentIds: ["sjafrudin", "aminah"], spouseIds: ["dino"] }),
      member({ id: "dino", name: "Dino Covic", gender: "male", birthDate: "1990-01-01", generation: 3, spouseIds: ["irania"] }),

      member({ id: "restiadi", name: "D Restiadi", gender: "male", birthDate: "1975-08-05", generation: 3, parentIds: ["rifai", "yatti"], spouseIds: ["vira"] }),
      member({ id: "vira", name: "Vira", gender: "female", birthDate: "1975-09-22", generation: 3, spouseIds: ["restiadi"] }),
      member({ id: "desy", name: "Desy Restiani", gender: "female", birthDate: "1977-01-01", generation: 3, parentIds: ["rifai", "yatti"], spouseIds: ["danan"] }),
      member({ id: "danan", name: "Danan Wuryanto", gender: "male", birthDate: "1973-01-01", generation: 3, spouseIds: ["desy"] }),
      member({ id: "restianti", name: "D Restianti", gender: "female", birthDate: "1979-01-01", generation: 3, parentIds: ["rifai", "yatti"], spouseIds: ["rio"] }),
      member({ id: "rio", name: "Rio Historiawan", gender: "male", birthDate: "1975-01-01", generation: 3, spouseIds: ["restianti"] }),
      member({ id: "dekie", name: "Dekie Restiandi", gender: "male", birthDate: "1981-11-23", generation: 3, parentIds: ["rifai", "yatti"], spouseIds: ["disty"] }),
      member({ id: "disty", name: "Disty Natarriny", gender: "female", birthDate: "1980-06-27", generation: 3, spouseIds: ["dekie"] }),

      member({ id: "ade", name: "ADE Ridwan", gender: "male", birthDate: "1979-01-01", generation: 3, parentIds: ["obay", "hasanah"], spouseIds: ["yati-f", "pipin-b"] }),
      member({ id: "yati-f", name: "Yati fatmayati", gender: "female", birthDate: "1971-03-22", generation: 3, spouseIds: ["ade"] }),
      member({ id: "pipin-b", name: "Pipin burangrang", gender: "female", birthDate: "1973-03-22", generation: 3, spouseIds: ["ade"] }),
      member({ id: "yuliaswati", name: "YULIASWATI", gender: "female", birthDate: "1984-01-01", generation: 3, parentIds: ["obay", "hasanah"] }),
      member({ id: "dani", name: "DANI RAMDANI", gender: "male", birthDate: "1984-01-01", generation: 3, parentIds: ["obay", "yeti"] }),
      member({ id: "wahyu", name: "WAHYUNINGSIH", gender: "female", birthDate: "1985-01-01", generation: 3, parentIds: ["obay", "yeti"] }),
      member({ id: "rarah", name: "RARAH", gender: "female", birthDate: "1986-01-01", generation: 3, parentIds: ["obay", "yeti"] }),
      member({ id: "safei", name: "MOH SAFEI", gender: "male", birthDate: "1987-01-01", generation: 3, parentIds: ["obay", "yeti"] }),

      member({ id: "reksa", name: "Reksa Prayoga S", gender: "male", birthDate: "2004-12-10", generation: 4, parentIds: ["syahrullah", "awit"] }),
      member({ id: "callysta", name: "callysta p.u", gender: "female", birthDate: "2011-03-22", generation: 4, parentIds: ["syahrullah", "awit"] }),
      member({ id: "cheryl", name: "Cheryl a.u", gender: "female", birthDate: "2015-03-22", generation: 4, parentIds: ["syahrullah", "awit"] }),
      member({ id: "fakhri", name: "Muhammad Fakhri", gender: "male", birthDate: "2013-10-04", generation: 4, parentIds: ["dekie", "disty"] }),
      member({ id: "muh", name: "Muh refaldi", gender: "male", birthDate: "2000-12-10", generation: 4, parentIds: ["ade", "yati-f"] }),
      member({ id: "riyad", name: "Riyad mahdi", gender: "male", birthDate: "2002-12-29", generation: 4, parentIds: ["ade", "yati-f"] }),
      member({ id: "nugy", name: "Nugy wahyu", gender: "male", birthDate: "2004-12-25", generation: 4, parentIds: ["ade", "yati-f"] }),
      member({ id: "zilbran", name: "Zilbran alfarizi", gender: "male", birthDate: "2011-05-01", generation: 4, parentIds: ["ade", "yati-f"] }),
      member({ id: "agung", name: "Agung anugrah", gender: "male", birthDate: "2015-03-22", generation: 4, parentIds: ["ade", "pipin-b"] }),
      member({ id: "ainun", name: "Ainun Nur azizah", gender: "female", birthDate: "2015-03-22", generation: 4, parentIds: ["ade", "pipin-b"] }),
      member({ id: "aini", name: "Aini aflansa", gender: "female", birthDate: "2015-03-22", generation: 4, parentIds: ["ade", "pipin-b"] }),
      member({ id: "arras", name: "Arras Ardian", gender: "male", birthDate: "2008-01-01", generation: 4, parentIds: ["harun", "pipit"] }),
      member({ id: "shevonny", name: "Shevonny Raiqa", gender: "female", birthDate: "2009-01-01", generation: 4, parentIds: ["harun", "pipit"] }),
      member({ id: "alisya", name: "Alisya Livi", gender: "female", birthDate: "2016-03-22", generation: 4, parentIds: ["harun", "rahmadania"] }),
      member({ id: "reysheva", name: "Reysheva Alfarizky", gender: "female", birthDate: "2010-01-01", generation: 4, parentIds: ["harun", "novi"] }),
      member({ id: "azam", name: "Khoerul Azam", gender: "male", birthDate: "2012-01-01", generation: 4, parentIds: ["harun", "novi"] }),
    ], () => {
      const rects = getCardRects();

      rects.forEach((leftRect, leftIndex) => {
        rects.slice(leftIndex + 1).forEach((rightRect) => {
          const intersects = leftRect.left < rightRect.right
            && leftRect.right > rightRect.left
            && leftRect.top < rightRect.bottom
            && leftRect.bottom > rightRect.top;

          expect(intersects, `${leftRect.text} overlaps ${rightRect.text}`).toBe(false);
        });
      });
    });
  });

  it("falls back to a safe layout instead of blanking the canvas when the main layout crashes", () => {
    const parseSpy = vi.spyOn(Date, "parse").mockImplementation(() => {
      throw new Error("forced layout failure");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      withGraph([
        member({ id: "ayah", name: "Ayah", gender: "male", birthDate: "1970-01-01", generation: 1 }),
        member({ id: "anak", name: "Anak", gender: "male", birthDate: "2000-01-01", generation: 2, parentIds: ["ayah"] }),
      ], () => {
        expect(document.body.textContent).toContain("Tampilan sementara disederhanakan");
        expect(document.body.textContent).toContain("Ayah");
        expect(document.body.textContent).toContain("Anak");
      });
    } finally {
      parseSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
