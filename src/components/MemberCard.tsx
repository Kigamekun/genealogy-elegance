import { FamilyMember } from "@/lib/family-data";
import { User, Heart, Calendar, ChevronDown, ChevronRight, UserPlus } from "lucide-react";

interface MemberCardProps {
  member: FamilyMember;
  spouse?: FamilyMember;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  onAddChild: () => void;
}

export function MemberCard({
  member,
  spouse,
  hasChildren,
  isExpanded,
  onToggle,
  onClick,
  onAddChild,
}: MemberCardProps) {
  const isDeceased = !!member.deathDate;

  return (
    <div className="flex flex-col items-center">
      {/* Couple container */}
      <div className="flex items-center gap-3">
        {/* Main member */}
        <button
          onClick={onClick}
          className="glass-card rounded-lg p-4 w-48 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                member.gender === "male"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent/15 text-accent"
              }`}
            >
              {member.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-foreground leading-tight">
                {member.name}
              </p>
              <p className="text-xs text-muted-foreground">{member.relation}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(member.birthDate).getFullYear()}</span>
            {isDeceased && (
              <>
                <span>–</span>
                <span>{new Date(member.deathDate!).getFullYear()}</span>
              </>
            )}
          </div>
        </button>

        {/* Spouse */}
        {spouse && (
          <>
            <Heart className="w-4 h-4 text-accent shrink-0" />
            <button
              onClick={onClick}
              className="glass-card rounded-lg p-4 w-48 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                    spouse.gender === "male"
                      ? "bg-primary/15 text-primary"
                      : "bg-accent/15 text-accent"
                  }`}
                >
                  {spouse.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate text-foreground leading-tight">
                    {spouse.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{spouse.relation}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{new Date(spouse.birthDate).getFullYear()}</span>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 mt-2">
        {hasChildren && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-200 active:scale-95"
            aria-label={isExpanded ? "Tutup" : "Buka"}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={onAddChild}
          className="p-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 active:scale-95"
          aria-label="Tambah anak"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
