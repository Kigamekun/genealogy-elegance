import { useState, useCallback, useMemo } from "react";
import { FamilyMember, getInitialMembers } from "@/lib/family-data";

export function useFamilyTree() {
  const [members, setMembers] = useState<FamilyMember[]>(getInitialMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [generationFilter, setGenerationFilter] = useState<number | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["1"]));
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addParentId, setAddParentId] = useState<string | undefined>();

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addMember = useCallback((member: Omit<FamilyMember, "id">) => {
    const id = Date.now().toString();
    setMembers((prev) => [...prev, { ...member, id }]);
    setIsAddingMember(false);
    setAddParentId(undefined);
  }, []);

  const updateMember = useCallback((updated: FamilyMember) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditingMember(null);
  }, []);

  const deleteMember = useCallback((id: string) => {
    setMembers((prev) => {
      // Remove member and reassign children
      return prev.filter((m) => m.id !== id && m.spouseId !== id).map((m) =>
        m.parentId === id ? { ...m, parentId: undefined } : m
      );
    });
    setSelectedMember(null);
  }, []);

  const generations = useMemo(() => {
    const gens = new Set(members.map((m) => m.generation));
    return Array.from(gens).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (generationFilter !== null) {
      result = result.filter((m) => m.generation === generationFilter);
    }
    return result;
  }, [members, searchQuery, generationFilter]);

  const startAddMember = useCallback((parentId?: string) => {
    setIsAddingMember(true);
    setAddParentId(parentId);
  }, []);

  return {
    members,
    filteredMembers,
    searchQuery,
    setSearchQuery,
    generationFilter,
    setGenerationFilter,
    generations,
    expandedNodes,
    toggleNode,
    selectedMember,
    setSelectedMember,
    editingMember,
    setEditingMember,
    isAddingMember,
    setIsAddingMember,
    addParentId,
    startAddMember,
    addMember,
    updateMember,
    deleteMember,
  };
}
