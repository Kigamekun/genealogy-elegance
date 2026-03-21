import { FamilyMember, getChildren, getSpouse } from "@/lib/family-data";
import { MemberCard } from "./MemberCard";

interface TreeNodeProps {
  member: FamilyMember;
  allMembers: FamilyMember[];
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (member: FamilyMember) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}

export function TreeNode({
  member,
  allMembers,
  expandedNodes,
  onToggle,
  onSelect,
  onAddChild,
  depth = 0,
}: TreeNodeProps) {
  const children = getChildren(allMembers, member.id);
  const spouse = getSpouse(allMembers, member.id);
  const isExpanded = expandedNodes.has(member.id);
  const hasChildren = children.length > 0;

  // Also get children through spouse
  const spouseChildren = spouse ? getChildren(allMembers, spouse.id) : [];
  const allChildren = [...children, ...spouseChildren.filter((sc) => !children.find((c) => c.id === sc.id))];

  return (
    <div
      className="flex flex-col items-center"
      style={{ animationDelay: `${depth * 80}ms` }}
    >
      <MemberCard
        member={member}
        spouse={spouse}
        hasChildren={allChildren.length > 0}
        isExpanded={isExpanded}
        onToggle={() => onToggle(member.id)}
        onClick={() => onSelect(member)}
        onAddChild={() => onAddChild(member.id)}
      />

      {/* Children */}
      {isExpanded && allChildren.length > 0 && (
        <div className="mt-6 relative">
          {/* Vertical connector */}
          <div className="absolute top-0 left-1/2 -translate-x-px w-0.5 h-6 bg-tree-line -translate-y-6" />

          {/* Horizontal connector */}
          {allChildren.length > 1 && (
            <div className="absolute top-0 h-0.5 bg-tree-line" style={{
              left: `${100 / (allChildren.length * 2)}%`,
              right: `${100 / (allChildren.length * 2)}%`,
            }} />
          )}

          <div className="flex gap-8 pt-6 relative">
            {allChildren.map((child) => (
              <div key={child.id} className="flex flex-col items-center animate-node-expand">
                {/* Vertical connector to child */}
                <div className="w-0.5 h-6 bg-tree-line -mt-6 mb-0" />
                <TreeNode
                  member={child}
                  allMembers={allMembers}
                  expandedNodes={expandedNodes}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
