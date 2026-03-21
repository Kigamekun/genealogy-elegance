import { useFamilyTree } from "@/hooks/useFamilyTree";
import { getRootMembers } from "@/lib/family-data";
import { TreeNode } from "@/components/TreeNode";
import { MemberDetailModal } from "@/components/MemberDetailModal";
import { MemberForm } from "@/components/MemberForm";
import { SearchBar } from "@/components/SearchBar";
import { ZoomableCanvas } from "@/components/ZoomableCanvas";
import { FamilyMember } from "@/lib/family-data";
import { TreePine, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const {
    members, filteredMembers, searchQuery, setSearchQuery,
    generationFilter, setGenerationFilter, generations,
    expandedNodes, toggleNode, selectedMember, setSelectedMember,
    editingMember, setEditingMember, isAddingMember, setIsAddingMember,
    addParentId, startAddMember, addMember, updateMember, deleteMember,
  } = useFamilyTree();

  const roots = getRootMembers(members);
  const isSearching = searchQuery || generationFilter !== null;
  const parentMember = addParentId ? members.find((m) => m.id === addParentId) : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-card border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <TreePine className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg text-foreground leading-none">Silsilah Keluarga</h1>
          </div>
          <Button size="sm" onClick={() => startAddMember()} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tambah Anggota</span>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container px-4 sm:px-6 pt-10 pb-6 text-center animate-reveal-up">
        <h2 className="font-display text-3xl sm:text-4xl text-foreground leading-tight mb-3 mx-auto" style={{ lineHeight: "1.15" }}>
          Jelajahi Akar Keluarga Anda
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
          Dokumentasikan dan jelajahi silsilah keluarga secara visual dan interaktif.
        </p>
      </section>

      {/* Search & Stats */}
      <section className="container px-4 sm:px-6 pb-6 animate-reveal-up flex flex-col items-center gap-4" style={{ animationDelay: "100ms" }}>
        <SearchBar
          query={searchQuery} onQueryChange={setSearchQuery}
          generationFilter={generationFilter} onGenerationChange={setGenerationFilter}
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

      {/* Tree or Search */}
      <section className="container px-4 sm:px-6 pb-16">
        {isSearching ? (
          <div className="animate-reveal-up">
            <p className="text-sm text-muted-foreground mb-4 text-center">{filteredMembers.length} hasil ditemukan</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
              {filteredMembers.map((m, i) => (
                <button key={m.id} onClick={() => setSelectedMember(m)}
                  className="glass-card rounded-lg p-4 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] animate-reveal-up"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center gap-3">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-border" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        m.gender === "male" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
                      }`}>{m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.relation} · Gen {m.generation}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-reveal-up" style={{ animationDelay: "200ms" }}>
            <ZoomableCanvas>
              {roots.map((root) => (
                <TreeNode key={root.id} member={root} allMembers={members}
                  expandedNodes={expandedNodes} onToggle={toggleNode}
                  onSelect={setSelectedMember} onAddChild={startAddMember} />
              ))}
            </ZoomableCanvas>
          </div>
        )}
      </section>

      {selectedMember && (
        <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)}
          onEdit={() => { setEditingMember(selectedMember); setSelectedMember(null); }}
          onDelete={() => deleteMember(selectedMember.id)} />
      )}
      {editingMember && <MemberForm member={editingMember} onSave={(m) => updateMember(m as FamilyMember)} onCancel={() => setEditingMember(null)} />}
      {isAddingMember && <MemberForm parentId={addParentId} parentGeneration={parentMember?.generation}
        onSave={(m) => addMember(m as Omit<FamilyMember, "id">)} onCancel={() => setIsAddingMember(false)} />}
    </div>
  );
};

export default Index;
