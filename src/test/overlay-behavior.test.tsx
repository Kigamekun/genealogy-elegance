import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MemberDetailModal } from "@/components/MemberDetailModal";
import { MemberForm } from "@/components/MemberForm";
import { ZoomableCanvas } from "@/components/ZoomableCanvas";
import type { FamilyMember } from "@/lib/family-data";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderNode(node: ReactNode) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(node);
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      document.body.innerHTML = "";
    },
  };
}

const member: FamilyMember = {
  id: "ahmad",
  name: "Ahmad Safari",
  birthDate: "1940-03-15",
  gender: "male",
  relation: "Anggota",
  description: "Kepala keluarga awal",
  generation: 1,
  spouseIds: ["saribanon"],
};

describe("overlay behavior", () => {
  it("renders the member form in a portal attached to document.body", () => {
    const view = renderNode(
      <MemberForm
        title="Tambah Anggota"
        submitLabel="Simpan"
        onSave={() => undefined}
        onCancel={() => undefined}
      />,
    );

    try {
      expect(view.container.textContent).not.toContain("Tambah Anggota");
      expect(document.body.textContent).toContain("Tambah Anggota");
      expect(document.body.querySelector(".fixed.inset-0")).not.toBeNull();
    } finally {
      view.cleanup();
    }
  });

  it("renders the member detail modal in a portal attached to document.body", () => {
    const view = renderNode(
      <MemberDetailModal
        member={member}
        onClose={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    try {
      expect(view.container.textContent).not.toContain("Ahmad Safari");
      expect(document.body.textContent).toContain("Ahmad Safari");
      expect(document.body.querySelector(".fixed.inset-0")).not.toBeNull();
    } finally {
      view.cleanup();
    }
  });

  it("moves the zoomable canvas into an app fullscreen portal when toggled", () => {
    const view = renderNode(
      <ZoomableCanvas>
        <div className="h-[200px] w-[320px]">Canvas Isi</div>
      </ZoomableCanvas>,
    );

    try {
      const fullscreenButton = view.container.querySelector('button[title="Masuk fullscreen"]');
      if (!(fullscreenButton instanceof HTMLButtonElement)) {
        throw new Error("Fullscreen button not found");
      }

      act(() => {
        fullscreenButton.click();
      });

      expect(view.container.querySelector('button[title="Keluar fullscreen"]')).toBeNull();
      expect(document.body.querySelector('button[title="Keluar fullscreen"]')).not.toBeNull();
      expect(document.body.textContent).toContain("Canvas Isi");
    } finally {
      view.cleanup();
    }
  });
});
