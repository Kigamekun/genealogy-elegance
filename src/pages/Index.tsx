import { useMemo, useRef, useState } from "react";
import { useFamilyTree } from "@/hooks/useFamilyTree";
import { MemberDetailModal } from "@/components/MemberDetailModal";
import { MemberForm, type MemberFormValues } from "@/components/MemberForm";
import { SearchBar } from "@/components/SearchBar";
import { ZoomableCanvas } from "@/components/ZoomableCanvas";
import { FamilyCanvasGraph } from "@/components/FamilyCanvasGraph";
import { FamilyMember, getChildren, getSpouseIds, hydrateMembers } from "@/lib/family-data";
import { Cloud, CloudOff, Download, Plus, RefreshCw, TreePine, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

function inferRelation(gender: FamilyMember["gender"], hint?: "child" | "spouse" | "head" | "member"): string {
  if (hint === "head") return "Kepala Keluarga";
  return "Anggota Keluarga";
}

const Index = () => {
  const [activeCanvasMemberId, setActiveCanvasMemberId] = useState<string | null>(null);
  const {
    members, filteredMembers, searchQuery, setSearchQuery,
    generationFilter, setGenerationFilter, generations,
    selectedMember, setSelectedMember,
    editingMember, setEditingMember,
    isAddingMember, addIntent, startAddMember, cancelAddMember,
    addMember, updateMember, deleteMember, replaceMembers, connectParent, setFamilyHead,
    syncStatus, lastSyncedAt,
  } = useFamilyTree();
  const importInputRef = useRef<HTMLInputElement>(null);

  const isSearching = searchQuery || generationFilter !== null;
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const addDialogTitle = useMemo(() => {
    if (!addIntent) return "Tambah Anggota";
    if (addIntent.relationHint === "child" && addIntent.parentIds?.[0]) {
      const parent = membersById.get(addIntent.parentIds[0]);
      return parent ? `Tambah Anak dari ${parent.name}` : "Tambah Anak";
    }
    if (addIntent.relationHint === "spouse" && addIntent.spouseIds?.[0]) {
      const partner = membersById.get(addIntent.spouseIds[0]);
      return partner ? `Tambah Pasangan untuk ${partner.name}` : "Tambah Pasangan";
    }
    if (addIntent.relationHint === "head") return "Tambah Kepala Keluarga";
    return "Tambah Anggota";
  }, [addIntent, membersById]);

  const syncMeta = useMemo(() => {
    if (syncStatus === "saving") {
      return {
        icon: RefreshCw,
        iconClassName: "animate-spin text-primary",
        label: "Menyimpan cloud",
        detail: "Perubahan sedang dikirim",
      };
    }

    if (syncStatus === "synced") {
      return {
        icon: Cloud,
        iconClassName: "text-primary",
        label: "Cloud aktif",
        detail: lastSyncedAt
          ? `Sinkron ${new Date(lastSyncedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "Data lintas device aktif",
      };
    }

    if (syncStatus === "local" || syncStatus === "error") {
      return {
        icon: CloudOff,
        iconClassName: "text-muted-foreground",
        label: "Mode lokal",
        detail: "Perlu deploy Netlify function",
      };
    }

    return {
      icon: RefreshCw,
      iconClassName: "animate-spin text-muted-foreground",
      label: "Mengecek cloud",
      detail: "Menyiapkan sinkronisasi",
    };
  }, [lastSyncedAt, syncStatus]);

  const addMemberFromForm = (values: MemberFormValues) => {
    const parentIds = addIntent?.asFamilyHead ? undefined : addIntent?.parentIds;
    const spouseIds = addIntent?.spouseIds;
    const spouseTarget = spouseIds?.[0] ? membersById.get(spouseIds[0]) : undefined;

    let normalizedGender = values.gender;
    if (spouseTarget?.gender === "male") normalizedGender = "female";
    if (spouseTarget?.gender === "female") normalizedGender = "male";

    const parentGeneration = (parentIds ?? [])
      .map((id) => membersById.get(id)?.generation ?? 0)
      .reduce((max, generation) => Math.max(max, generation), 0);
    const spouseGeneration = (spouseIds ?? [])
      .map((id) => membersById.get(id)?.generation ?? 1)
      .reduce((max, generation) => Math.max(max, generation), 1);

    const generation = addIntent?.asFamilyHead
      ? 1
      : parentIds && parentIds.length > 0
        ? Math.max(1, parentGeneration + 1)
        : spouseIds && spouseIds.length > 0
          ? Math.max(1, spouseGeneration)
          : 1;

    addMember({
      name: values.name,
      gender: normalizedGender,
      birthDate: values.birthDate,
      description: values.description,
      avatarUrl: values.avatarUrl,
      relation: inferRelation(normalizedGender, addIntent?.relationHint),
      generation,
      parentIds: parentIds && parentIds.length > 0 ? parentIds : undefined,
      spouseIds: spouseIds && spouseIds.length > 0 ? spouseIds : undefined,
      isFamilyHead: Boolean(addIntent?.asFamilyHead),
    });
  };

  const editMemberFromForm = (values: MemberFormValues) => {
    if (!editingMember) return;
    updateMember({
      ...editingMember,
      name: values.name,
      gender: values.gender,
      birthDate: values.birthDate,
      description: values.description,
      avatarUrl: values.avatarUrl,
    });
  };

  const startAddChild = (parentId: string) => {
    const parent = membersById.get(parentId);
    const spouseIds = parent ? getSpouseIds(parent) : [];
    const linkedParentIds = spouseIds.length === 1 ? [parentId, spouseIds[0]] : [parentId];

    startAddMember({
      parentIds: linkedParentIds,
      relationHint: "child",
    });
  };

  const startAddSpouse = (memberId: string) => {
    const member = membersById.get(memberId);
    if (!member) return;
    if (member.gender === "female" && getSpouseIds(member).length > 0) return;

    startAddMember({
      spouseIds: [memberId],
      relationHint: "spouse",
      genderHint: member?.gender === "male" ? "female" : "male",
    });
  };

  const handleDeleteMember = (memberId: string) => {
    const member = membersById.get(memberId);
    if (!member) return;

    const childCount = getChildren(members, memberId).length;
    const spouseCount = getSpouseIds(member).length;
    const detailParts = [
      spouseCount > 0 ? `${spouseCount} pasangan` : null,
      childCount > 0 ? `${childCount} anak langsung` : null,
    ].filter(Boolean);
    const detailSuffix = detailParts.length > 0 ? `\nRelasi terkait: ${detailParts.join(", ")}.` : "";

    if (!window.confirm(`Hapus ${member.name}?${detailSuffix}`)) return;

    deleteMember(memberId);
    setActiveCanvasMemberId((currentId) => (currentId === memberId ? null : currentId));
    setSelectedMember((currentMember) => (currentMember?.id === memberId ? null : currentMember));
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(members, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "genealogy-elegance-data.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedMembers = hydrateMembers(JSON.parse(text));
      if (importedMembers.length === 0) {
        window.alert("File JSON tidak berisi data anggota yang valid.");
      } else {
        replaceMembers(importedMembers);
        setActiveCanvasMemberId(null);
      }
    } catch {
      window.alert("File JSON tidak bisa dibaca. Pastikan formatnya valid.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-card border-b border-border/50">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-2">
          <div className="flex items-center gap-2.5">
            <TreePine className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg text-foreground leading-none">Safari Tree</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportJson}
            />
            <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import JSON</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportJson} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => startAddMember({ asFamilyHead: true, relationHint: "head" })} className="gap-1.5">
              <TreePine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kepala Baru</span>
            </Button>
            <Button size="sm" onClick={() => startAddMember({ relationHint: "member" })} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Anggota</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-5 text-center animate-reveal-up sm:px-6 sm:pt-8 sm:pb-6">
        <h2 className="font-display text-3xl sm:text-4xl text-foreground leading-tight mb-3 mx-auto" style={{ lineHeight: "1.15" }}>
          Jelajahi Akar Keluarga Anda
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          Aksi utama dipindahkan ke kanvas: tambah pasangan, sambung relasi, dan atur kepala keluarga langsung dari kartu.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-4 px-4 pb-5 animate-reveal-up sm:px-6 sm:pb-6" style={{ animationDelay: "100ms" }}>
        <SearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          generationFilter={generationFilter}
          onGenerationChange={setGenerationFilter}
          generations={generations}
        />
        <div className="flex gap-3">
          <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span className="text-sm font-semibold text-foreground tabular-nums">{members.length}</span>
            <span className="text-xs text-muted-foreground">Anggota</span>
          </div>
          <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
            <TreePine className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold text-foreground tabular-nums">{generations.length}</span>
            <span className="text-xs text-muted-foreground">Generasi</span>
          </div>
          <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
            <syncMeta.icon className={`h-3.5 w-3.5 ${syncMeta.iconClassName}`} />
            <div className="text-left leading-tight">
              <p className="text-xs font-semibold text-foreground">{syncMeta.label}</p>
              <p className="text-[10px] text-muted-foreground">{syncMeta.detail}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-2 pb-4 sm:px-4 sm:pb-8 lg:px-6">
        {isSearching ? (
          <div className="animate-reveal-up mx-auto max-w-[1200px]">
            <p className="text-sm text-muted-foreground mb-4 text-center">{filteredMembers.length} hasil ditemukan</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="glass-card rounded-lg p-4 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] animate-reveal-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center gap-3">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        member.gender === "male" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
                      }`}>{member.name.split(" ").map((name) => name[0]).join("").slice(0, 2)}</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.gender === "male" ? "Laki-laki" : "Perempuan"} · Gen {member.generation}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-reveal-up w-full" style={{ animationDelay: "200ms" }}>
            <ZoomableCanvas>
              <FamilyCanvasGraph
                members={members}
                selectedMemberId={activeCanvasMemberId ?? undefined}
                onSelectMember={(member) => {
                  setActiveCanvasMemberId((currentId) => currentId === member.id ? null : member.id);
                }}
                onClearSelection={() => setActiveCanvasMemberId(null)}
                onEditMember={(member) => {
                  setEditingMember(member);
                  setActiveCanvasMemberId(null);
                }}
                onAddChild={startAddChild}
                onAddSpouse={startAddSpouse}
                onSetFamilyHead={setFamilyHead}
                onDeleteMember={handleDeleteMember}
                onConnectParent={connectParent}
              />
            </ZoomableCanvas>
          </div>
        )}
      </section>

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onEdit={() => {
            setEditingMember(selectedMember);
            setSelectedMember(null);
          }}
          onDelete={() => handleDeleteMember(selectedMember.id)}
        />
      )}

      {editingMember && (
        <MemberForm
          member={editingMember}
          title={`Edit ${editingMember.name}`}
          submitLabel="Simpan"
          onSave={editMemberFromForm}
          onCancel={() => setEditingMember(null)}
        />
      )}

      {isAddingMember && (
        <MemberForm
          title={addDialogTitle}
          submitLabel="Tambah"
          defaultGender={addIntent?.genderHint}
          onSave={addMemberFromForm}
          onCancel={cancelAddMember}
        />
      )}
    </div>
  );
};

export default Index;
