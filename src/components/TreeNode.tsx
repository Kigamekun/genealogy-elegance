import { FamilyMember, getFamilyChildren, getSpouses, isStepChildForMember } from "@/lib/family-data";
import { MemberCard } from "./MemberCard";

interface TreeNodeProps {
  member: FamilyMember;
  allMembers: FamilyMember[];
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (member: FamilyMember) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
  ancestorIds?: Set<string>;
}

export function TreeNode({
  member,
  allMembers,
  expandedNodes,
  onToggle,
  onSelect,
  onAddChild,
  depth = 0,
  ancestorIds,
}: TreeNodeProps) {
  const lineage = new Set(ancestorIds ?? []);
  lineage.add(member.id);

  const spouses = getSpouses(allMembers, member.id);
  const allChildren = getFamilyChildren(allMembers, member.id)
    .filter((child) => !lineage.has(child.id));
  const childNodes = allChildren.map((child) => ({
    child,
    isStepChild: isStepChildForMember(allMembers, child, member.id),
  }));
  const isExpanded = expandedNodes.has(member.id);

  return (
    <div className="flex flex-col items-center" style={{ animationDelay: `${depth * 80}ms` }}>
      <MemberCard
        member={member}
        spouses={spouses}
        hasChildren={childNodes.length > 0}
        isExpanded={isExpanded}
        onToggle={() => onToggle(member.id)}
        onClick={onSelect}
        onAddChild={() => onAddChild(member.id)}
      />

      {isExpanded && childNodes.length > 0 && (
        <div className="mt-4 relative">
          <div className="absolute top-0 left-1/2 -translate-x-px w-0.5 h-4 bg-tree-line -translate-y-4" />
          {childNodes.length > 1 && (
            <div className="absolute top-0 h-0.5 bg-tree-line" style={{
              left: `${100 / (childNodes.length * 2)}%`,
              right: `${100 / (childNodes.length * 2)}%`,
            }} />
          )}
          <div className="flex gap-6 pt-4 relative">
            {childNodes.map(({ child, isStepChild }) => (
              <div key={child.id} className="flex flex-col items-center animate-node-expand">
                <div className="w-0.5 h-4 bg-tree-line -mt-4 mb-0" />
                {isStepChild && (
                  <span className="mb-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                    Anak Sambung
                  </span>
                )}
                <TreeNode
                  member={child}
                  allMembers={allMembers}
                  expandedNodes={expandedNodes}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  depth={depth + 1}
                  ancestorIds={lineage}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
