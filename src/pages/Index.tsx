import { useMemo, useState } from "react";
import { useFamilyTree } from "@/hooks/useFamilyTree";
import { MemberDetailModal } from "@/components/MemberDetailModal";
import { MemberForm, type MemberFormValues } from "@/components/MemberForm";
import { SearchBar } from "@/components/SearchBar";
import { ZoomableCanvas } from "@/components/ZoomableCanvas";
import { FamilyCanvasGraph } from "@/components/FamilyCanvasGraph";
import { FamilyMember, getSpouseIds } from "@/lib/family-data";
import { TreePine, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

function inferRelation(gender: FamilyMember["gender"], hint?: "child" | "spouse" | "head" | "member"): string {
  if (hint === "child") return "Anak";
  if (hint === "spouse") return gender === "female" ? "Istri" : "Suami";
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
    addMember, updateMember, deleteMember, connectParent, setFamilyHead,
  } = useFamilyTree();

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

    const today = new Date().toISOString().slice(0, 10);

    addMember({
      name: values.name,
      gender: normalizedGender,
      description: values.description,
      birthDate: today,
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
      description: values.description,
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-card border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <TreePine className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg text-foreground leading-none">Silsilah Keluarga</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => startAddMember({ asFamilyHead: true, relationHint: "head" })} className="gap-1.5">
              <TreePine className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kepala Baru</span>
            </Button>
            <Button size="sm" onClick={() => startAddMember({ relationHint: "member" })} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Anggota</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="container px-4 sm:px-6 pt-10 pb-6 text-center animate-reveal-up">
        <h2 className="font-display text-3xl sm:text-4xl text-foreground leading-tight mb-3 mx-auto" style={{ lineHeight: "1.15" }}>
          Jelajahi Akar Keluarga Anda
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          Aksi utama dipindahkan ke kanvas: tambah pasangan, sambung relasi, dan atur kepala keluarga langsung dari kartu.
        </p>
      </section>

      <section className="container px-4 sm:px-6 pb-6 animate-reveal-up flex flex-col items-center gap-4" style={{ animationDelay: "100ms" }}>
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
        </div>
      </section>

      <section className="container px-4 sm:px-6 pb-16">
        {isSearching ? (
          <div className="animate-reveal-up">
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
                      <p className="text-xs text-muted-foreground">{member.relation} · Gen {member.generation}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-reveal-up" style={{ animationDelay: "200ms" }}>
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
          onDelete={() => deleteMember(selectedMember.id)}
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
