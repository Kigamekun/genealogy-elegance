import { createPortal } from "react-dom";
import { DeferredImage } from "@/components/DeferredImage";
import { useIsConstrainedMode } from "@/hooks/use-performance-mode";
import { FamilyMember } from "@/lib/family-data";
import { formatFamilyDate, getMemberAge, isMemberDeceased } from "@/lib/member-life";
import { X, Calendar, User, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MemberDetailModalProps {
  member: FamilyMember;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MemberDetailModal({ member, onClose, onEdit, onDelete }: MemberDetailModalProps) {
  const isDeceased = isMemberDeceased(member);
  const isConstrainedMode = useIsConstrainedMode();

  const modal = (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 animate-fade-in sm:items-center"
      style={{
        paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 1rem))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 1rem))",
        contain: "layout paint style",
        willChange: "opacity",
      }}
      onClick={onClose}
    >
      <div
        className={cn(
          "absolute inset-0 bg-foreground/20",
          !isConstrainedMode && "backdrop-blur-sm",
        )}
      />
      <div
        className={`glass-card rounded-2xl p-6 max-w-md w-full relative z-10 animate-reveal-up shadow-2xl ${
          isDeceased ? "border-slate-300/80 bg-slate-100/80" : ""
        }`}
        style={{
          contain: "layout paint style",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          backdropFilter: isConstrainedMode ? "none" : undefined,
          WebkitBackdropFilter: isConstrainedMode ? "none" : undefined,
          backgroundColor: isConstrainedMode ? "hsl(var(--background) / 0.96)" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary transition-colors active:scale-95">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-4 mb-5">
          {member.avatarUrl ? (
            <DeferredImage
              src={member.avatarUrl}
              alt={member.name}
              eager
              containerClassName="h-20 w-20 shrink-0 rounded-full ring-2 ring-border"
              imageClassName={cn("object-cover", isDeceased && "grayscale-[0.35]")}
              placeholder={(
                <div className={`flex h-full w-full items-center justify-center rounded-full text-2xl font-bold ${
                  isDeceased
                    ? "bg-slate-200 text-slate-600"
                    : member.gender === "male"
                      ? "bg-primary/15 text-primary"
                      : "bg-accent/15 text-accent"
                }`}>
                  {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
              )}
            />
          ) : (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
              isDeceased
                ? "bg-slate-200 text-slate-600"
                : member.gender === "male"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent/15 text-accent"
            }`}>
              {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
          )}
          <div>
            <h2 className="font-display text-xl text-foreground leading-tight">{member.name}</h2>
            <p className="text-sm text-muted-foreground">
              {member.gender === "male" ? "Laki-laki" : "Perempuan"} · Generasi {member.generation}
            </p>
            <p className="text-xs font-medium text-foreground/80 mt-1">
              Umur {getMemberAge(member) ?? "-"} tahun
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-2 text-sm">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words leading-relaxed text-foreground">
              {formatFamilyDate(member.birthDate, "long")}
              {isDeceased && (
                <span className="text-muted-foreground">
                  {" "}– {formatFamilyDate(member.deathDate, "long")}
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

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }

  return modal;
}
