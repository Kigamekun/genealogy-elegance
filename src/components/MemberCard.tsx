import { DeferredImage } from "@/components/DeferredImage";
import { FamilyMember, getSpouseRelationStatus } from "@/lib/family-data";
import { formatFamilyDate, getMemberAge, isMemberDeceased } from "@/lib/member-life";
import { Heart, Calendar, ChevronDown, ChevronRight, UserPlus } from "lucide-react";

interface MemberCardProps {
  member: FamilyMember;
  spouses?: FamilyMember[];
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: (m: FamilyMember) => void;
  onAddChild: () => void;
}

function Avatar({ member }: { member: FamilyMember }) {
  const isDeceased = isMemberDeceased(member);

  if (member.avatarUrl) {
    return (
      <DeferredImage
        src={member.avatarUrl}
        alt={member.name}
        rootMargin="220px"
        containerClassName="h-10 w-10 shrink-0 rounded-full ring-2 ring-border"
        imageClassName={`object-cover ${isDeceased ? "grayscale-[0.35]" : ""}`}
        placeholder={(
          <div
            className={`flex h-full w-full items-center justify-center rounded-full text-sm font-semibold shrink-0 ${
              isDeceased
                ? "bg-slate-200 text-slate-600"
                : member.gender === "male"
                  ? "bg-primary/15 text-primary"
                  : "bg-accent/15 text-accent"
            }`}
          >
            {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
        )}
      />
    );
  }
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
        isDeceased
          ? "bg-slate-200 text-slate-600"
          : member.gender === "male"
            ? "bg-primary/15 text-primary"
            : "bg-accent/15 text-accent"
      }`}
    >
      {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
    </div>
  );
}

function MiniCard({ member, onClick }: { member: FamilyMember; onClick: () => void }) {
  const isDeceased = isMemberDeceased(member);
  return (
    <button
      onClick={onClick}
      className={`glass-card rounded-lg p-3 w-48 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
        isDeceased ? "border-slate-300/80 bg-slate-100/75" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <Avatar member={member} />
        <div className="min-w-0">
          <p className="font-semibold text-xs truncate text-foreground leading-tight">{member.name}</p>
          <p className="text-[10px] text-muted-foreground">{member.relation}</p>
        </div>
      </div>
      {member.isFamilyHead && (
        <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary mb-1.5">
          Kepala Keluarga
        </span>
      )}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Calendar className="w-2.5 h-2.5" />
        <span className="truncate">{formatFamilyDate(member.birthDate)}</span>
        {isDeceased && <><span>–</span><span className="truncate">{formatFamilyDate(member.deathDate)}</span></>}
      </div>
      <p className="mt-1 text-[10px] font-medium text-foreground/85">Umur {getMemberAge(member) ?? "-"} tahun</p>
    </button>
  );
}

export function MemberCard({ member, spouses = [], hasChildren, isExpanded, onToggle, onClick, onAddChild }: MemberCardProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <MiniCard member={member} onClick={() => onClick(member)} />
        {spouses.map((spouse) => (
          <div key={spouse.id} className="flex items-center gap-2">
            <Heart className={`w-3.5 h-3.5 shrink-0 ${
              getSpouseRelationStatus(member, spouse.id) === "divorced" ? "text-destructive" : "text-accent"
            }`} />
            <MiniCard member={spouse} onClick={() => onClick(spouse)} />
          </div>
        ))}
      </div>
      {spouses.length > 1 && (
        <p className="text-[10px] text-muted-foreground mt-1">{spouses.length} pasangan</p>
      )}
      <div className="flex items-center gap-1 mt-1.5">
        {hasChildren && (
          <button
            onClick={onToggle}
            className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-200 active:scale-95"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
        <button
          onClick={onAddChild}
          className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 active:scale-95"
        >
          <UserPlus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
