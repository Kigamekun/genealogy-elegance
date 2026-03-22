import { FamilyMember } from "@/lib/family-data";
import { X, Calendar, User, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemberDetailModalProps {
  member: FamilyMember;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MemberDetailModal({ member, onClose, onEdit, onDelete }: MemberDetailModalProps) {
  const isDeceased = !!member.deathDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        className="glass-card rounded-2xl p-6 max-w-md w-full relative z-10 animate-reveal-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary transition-colors active:scale-95">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-4 mb-5">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt={member.name} className="w-20 h-20 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
              member.gender === "male" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
            }`}>
              {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
          )}
          <div>
            <h2 className="font-display text-xl text-foreground leading-tight">{member.name}</h2>
            <p className="text-sm text-muted-foreground">
              {member.gender === "male" ? "Laki-laki" : "Perempuan"} · Generasi {member.generation}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">
              {new Date(member.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              {isDeceased && (
                <span className="text-muted-foreground">
                  {" "}– {new Date(member.deathDate!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{member.gender === "male" ? "Laki-laki" : "Perempuan"}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{member.description}</p>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Edit className="w-3.5 h-3.5 mr-1.5" />Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} className="flex-1">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Hapus
          </Button>
        </div>
      </div>
    </div>
  );
}
