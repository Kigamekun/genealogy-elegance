import { useMemo, useRef, useState } from "react";
import { Calendar, Crown, Heart, Pencil, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { FamilyMember, getParentIds, getSpouseIds, getSpouses } from "@/lib/family-data";
import { cn } from "@/lib/utils";

interface FamilyCanvasGraphProps {
  members: FamilyMember[];
  selectedMemberId?: string;
  onSelectMember: (member: FamilyMember) => void;
  onClearSelection?: () => void;
  onEditMember: (member: FamilyMember) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (memberId: string) => void;
  onSetFamilyHead: (memberId: string, isFamilyHead: boolean) => void;
  onDeleteMember: (memberId: string) => void;
  onConnectParent: (childId: string, parentId: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

interface UnitDraft {
  generation: number;
  memberIds: string[];
  maleId?: string;
  wifeIds: string[];
  spouseGap: number;
  memberOffsets: number[];
  weight: number;
  width: number;
  orderKey: number;
}

interface PreparedUnitDraft extends UnitDraft {
  id: string;
  sourceUnitId?: string;
  sourceClusterKey?: string;
  sourceParentIds?: string[];
  subtreeWidth: number;
}

interface UnitLayout {
  id: string;
  generation: number;
  memberIds: string[];
  maleId?: string;
  wifeIds: string[];
  spouseGap: number;
  x: number;
  y: number;
  width: number;
  centerX: number;
  footprintX: number;
  footprintWidth: number;
  order: number;
}

interface SpouseConnector {
  id: string;
  x1: number;
  x2: number;
  y: number;
}

interface ParentGroup {
  id: string;
  laneKey: string;
  parentAnchors: Point[];
  source: Point;
  busY: number;
  targets: Point[];
}

interface ConnectorGeometry {
  paths: string[];
  joints: Point[];
}

const CARD_WIDTH = 260;
const CARD_HEIGHT = 122;
const SPOUSE_GAP = 82;
const MULTI_WIFE_GAP = 420;
const UNIT_GAP = 116;
const SAME_SOURCE_CLUSTER_GAP = 40;
const V_GAP = 168;
const PADDING_X = 120;
const PADDING_Y = 86;
const CORNER_RADIUS = 34;
const PAIR_JOIN_OFFSET = 34;
const PAIR_LANE_GAP = 24;

function parseYear(dateString?: string): string {
  if (!dateString) return "----";
  const year = new Date(dateString).getFullYear();
  return Number.isNaN(year) ? "----" : year.toString();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function solveNonOverlappingPositions(desired: number[], widths: number[], gap: number | number[]): number[] {
  if (desired.length === 0) return [];

  const gaps = Array.isArray(gap) ? gap : new Array(Math.max(0, desired.length - 1)).fill(gap);
  const offsets = desired.map((_, index) =>
    widths.slice(0, index).reduce((sum, width) => sum + width, 0)
    + gaps.slice(0, index).reduce((sum, currentGap) => sum + currentGap, 0),
  );
  const adjusted = desired.map((value, index) => value - offsets[index]);
  // Keep small clusters anchored closer to their ideal center while allowing
  // wide sibling rows to absorb most of the reflow when a new child is added.
  const weights = widths.map((width) => {
    const normalizedWidth = Math.max(width, CARD_WIDTH);
    return Math.pow(CARD_WIDTH / normalizedWidth, 2);
  });

  const blocks: Array<{ start: number; end: number; value: number; weight: number }> = [];

  adjusted.forEach((value, index) => {
    blocks.push({ start: index, end: index, value, weight: weights[index] });

    while (blocks.length > 1) {
      const current = blocks[blocks.length - 1];
      const previous = blocks[blocks.length - 2];
      if (previous.value <= current.value) break;

      const weight = previous.weight + current.weight;
      const mergedValue = ((previous.value * previous.weight) + (current.value * current.weight)) / weight;
      blocks.splice(blocks.length - 2, 2, {
        start: previous.start,
        end: current.end,
        value: mergedValue,
        weight,
      });
    }
  });

  const solved = new Array(desired.length).fill(0);
  blocks.forEach((block) => {
    for (let index = block.start; index <= block.end; index += 1) {
      solved[index] = block.value + offsets[index];
    }
  });

  return solved;
}

function timestamp(dateString: string): number {
  const value = Date.parse(dateString);
  return Number.isNaN(value) ? 0 : value;
}

function buildRoundedOrthogonalPath(points: Point[], radius = CORNER_RADIUS): string {
  const clean = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });

  if (clean.length === 0) return "";
  if (clean.length === 1) return `M ${round(clean[0].x)} ${round(clean[0].y)}`;

  let path = `M ${round(clean[0].x)} ${round(clean[0].y)}`;

  for (let index = 1; index < clean.length - 1; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    const next = clean[index + 1];

    const inVector = { x: current.x - previous.x, y: current.y - previous.y };
    const outVector = { x: next.x - current.x, y: next.y - current.y };
    const inLength = Math.hypot(inVector.x, inVector.y);
    const outLength = Math.hypot(outVector.x, outVector.y);

    if (inLength === 0 || outLength === 0) continue;

    const isStraight = (inVector.x === 0 && outVector.x === 0) || (inVector.y === 0 && outVector.y === 0);
    if (isStraight) {
      path += ` L ${round(current.x)} ${round(current.y)}`;
      continue;
    }

    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);
    const beforeCorner = {
      x: current.x - (inVector.x / inLength) * cornerRadius,
      y: current.y - (inVector.y / inLength) * cornerRadius,
    };
    const afterCorner = {
      x: current.x + (outVector.x / outLength) * cornerRadius,
      y: current.y + (outVector.y / outLength) * cornerRadius,
    };

    path += ` L ${round(beforeCorner.x)} ${round(beforeCorner.y)} Q ${round(current.x)} ${round(current.y)} ${round(afterCorner.x)} ${round(afterCorner.y)}`;
  }

  const end = clean[clean.length - 1];
  path += ` L ${round(end.x)} ${round(end.y)}`;
  return path;
}

function makeOrthogonalPath(from: Point, to: Point): string {
  if (from.x === to.x || from.y === to.y) {
    return buildRoundedOrthogonalPath([from, to]);
  }

  const middleY = (from.y + to.y) / 2;
  return buildRoundedOrthogonalPath([
    from,
    { x: from.x, y: middleY },
    { x: to.x, y: middleY },
    to,
  ]);
}

function buildConnectorGeometry(source: Point, targets: Point[], busY: number): ConnectorGeometry {
  if (targets.length === 0) return { paths: [], joints: [] };
  if (targets.length === 1) {
    return {
      paths: [makeOrthogonalPath(source, targets[0])],
      joints: [],
    };
  }

  const sortedTargets = [...targets].sort((left, right) => left.x - right.x);
  const minX = sortedTargets[0].x;
  const maxX = sortedTargets[sortedTargets.length - 1].x;
  const hubX = Math.max(minX, Math.min(maxX, source.x));
  const leftMost = sortedTargets[0];
  const rightMost = sortedTargets[sortedTargets.length - 1];
  const innerTargets = sortedTargets.slice(1, -1);

  const trunkPath = makeOrthogonalPath(source, { x: hubX, y: busY });
  const leftBranchPath = buildRoundedOrthogonalPath([
    { x: hubX, y: busY },
    { x: leftMost.x, y: busY },
    leftMost,
  ]);
  const rightBranchPath = buildRoundedOrthogonalPath([
    { x: hubX, y: busY },
    { x: rightMost.x, y: busY },
    rightMost,
  ]);
  const innerDropPaths = innerTargets.map((target) =>
    buildRoundedOrthogonalPath([
      { x: target.x, y: busY },
      target,
    ]),
  );

  const joints = [
    { x: hubX, y: busY },
    ...sortedTargets.map((target) => ({ x: target.x, y: busY })),
  ];

  return {
    paths: [trunkPath, leftBranchPath, rightBranchPath, ...innerDropPaths],
    joints,
  };
}

function buildParentGroupGeometry(group: ParentGroup): ConnectorGeometry {
  const baseGeometry = buildConnectorGeometry(group.source, group.targets, group.busY);
  if (group.parentAnchors.length <= 1) return baseGeometry;

  const pairPaths = group.parentAnchors.map((parentAnchor) =>
    buildRoundedOrthogonalPath([
      parentAnchor,
      { x: parentAnchor.x, y: group.source.y },
      { x: group.source.x, y: group.source.y },
    ]),
  );

  const joints = [{ x: group.source.x, y: group.source.y }, ...baseGeometry.joints];
  const uniqueJoints = joints.filter((joint, index) =>
    joints.findIndex((candidate) => candidate.x === joint.x && candidate.y === joint.y) === index,
  );

  return {
    paths: [...pairPaths, ...baseGeometry.paths],
    joints: uniqueJoints,
  };
}

function getAnchors(position: NodePosition): Record<"top" | "bottom" | "left" | "right", Point> {
  return {
    top: { x: position.x + CARD_WIDTH / 2, y: position.y - 1 },
    bottom: { x: position.x + CARD_WIDTH / 2, y: position.y + CARD_HEIGHT + 1 },
    left: { x: position.x - 1, y: position.y + CARD_HEIGHT / 2 },
    right: { x: position.x + CARD_WIDTH + 1, y: position.y + CARD_HEIGHT / 2 },
  };
}

function ActionButton({
  title,
  active,
  disabled,
  className,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      data-no-pan="true"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 w-7 rounded-full border border-border/80 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-secondary hover:text-foreground",
        active && "border-primary/60 bg-primary/10 text-primary",
        disabled && "cursor-not-allowed opacity-45 hover:bg-background/90 hover:text-muted-foreground",
        className,
      )}
    >
      <span className="sr-only">{title}</span>
      {children}
    </button>
  );
}

export function FamilyCanvasGraph({
  members,
  selectedMemberId,
  onSelectMember,
  onClearSelection,
  onEditMember,
  onAddChild,
  onAddSpouse,
  onSetFamilyHead,
  onDeleteMember,
  onConnectParent,
}: FamilyCanvasGraphProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [connectState, setConnectState] = useState<{ sourceId: string } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  const layout = useMemo(() => {
    const generationLevels = Array.from(new Set(members.map((member) => member.generation))).sort((a, b) => a - b);

    const getMemberCenterFromPositions = (lookup: Map<string, NodePosition>, memberId: string): number | null => {
      const position = lookup.get(memberId);
      return position ? position.x + CARD_WIDTH / 2 : null;
    };

    const resolveFamilySourceCenter = (parentIds: string[] | undefined, lookup: Map<string, NodePosition>): number | undefined => {
      if (!parentIds || parentIds.length === 0) return undefined;

      const fatherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "male");
      const motherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "female");
      const father = fatherId ? memberMap.get(fatherId) : undefined;
      const motherCenter = motherId ? getMemberCenterFromPositions(lookup, motherId) : null;

      if (father && motherCenter !== null && getSpouseIds(father).length > 1) {
        return motherCenter;
      }

      const centers = parentIds
        .map((parentId) => getMemberCenterFromPositions(lookup, parentId))
        .filter((value): value is number => value !== null);

      if (centers.length === 0) return undefined;
      if (centers.length === 1) return centers[0];
      return average(centers);
    };

    const shouldUseMotherAnchor = (parentIds: string[] | undefined): boolean => {
      if (!parentIds || parentIds.length < 2) return false;

      const fatherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "male");
      const motherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "female");
      if (!fatherId || !motherId) return false;

      const father = memberMap.get(fatherId);
      return Boolean(father && getSpouseIds(father).length > 1);
    };

    const getMemberWeight = (member: FamilyMember) => {
      const parentBirth = getParentIds(member)
        .map((parentId) => memberMap.get(parentId))
        .filter((parent): parent is FamilyMember => Boolean(parent))
        .map((parent) => timestamp(parent.birthDate));
      if (parentBirth.length > 0) return average(parentBirth);
      return timestamp(member.birthDate);
    };

    const rowDrafts: UnitDraft[][] = generationLevels.map((generation) => {
      const membersInGeneration = members
        .filter((member) => member.generation === generation)
        .sort((left, right) => {
          const leftWeight = getMemberWeight(left);
          const rightWeight = getMemberWeight(right);
          if (leftWeight !== rightWeight) return leftWeight - rightWeight;
          return left.birthDate.localeCompare(right.birthDate) || left.name.localeCompare(right.name);
        });

      const generationIdSet = new Set(membersInGeneration.map((member) => member.id));
      const processed = new Set<string>();
      const drafts: UnitDraft[] = [];

      for (const male of membersInGeneration.filter((member) => member.gender === "male")) {
        if (processed.has(male.id)) continue;

        const wives = getSpouseIds(male)
          .map((spouseId) => memberMap.get(spouseId))
          .filter((candidate): candidate is FamilyMember => Boolean(candidate))
          .filter((candidate) => candidate.gender === "female")
          .filter((candidate) => generationIdSet.has(candidate.id))
          .filter((candidate) => !processed.has(candidate.id))
          .sort((left, right) => left.birthDate.localeCompare(right.birthDate) || left.name.localeCompare(right.name));

        const memberIds = [male.id, ...wives.map((wife) => wife.id)];
        memberIds.forEach((id) => processed.add(id));
        const spouseGap = wives.length > 1 ? MULTI_WIFE_GAP : SPOUSE_GAP;

        const weight = average(memberIds.map((id) => getMemberWeight(memberMap.get(id)!)));
        drafts.push({
          generation,
          memberIds,
          maleId: male.id,
          wifeIds: wives.map((wife) => wife.id),
          spouseGap,
          memberOffsets: memberIds.map((_, memberIndex) => memberIndex * (CARD_WIDTH + spouseGap)),
          weight,
          width: memberIds.length * CARD_WIDTH + Math.max(0, memberIds.length - 1) * spouseGap,
          orderKey: timestamp(male.birthDate) || weight,
        });
      }

      for (const member of membersInGeneration) {
        if (processed.has(member.id)) continue;
        processed.add(member.id);
        drafts.push({
          generation,
          memberIds: [member.id],
          maleId: member.gender === "male" ? member.id : undefined,
          wifeIds: [],
          spouseGap: SPOUSE_GAP,
          memberOffsets: [0],
          weight: getMemberWeight(member),
          width: CARD_WIDTH,
          orderKey: timestamp(member.birthDate) || getMemberWeight(member),
        });
      }

      drafts.sort((left, right) => {
        if (left.weight !== right.weight) return left.weight - right.weight;
        const leftLead = memberMap.get(left.memberIds[0]);
        const rightLead = memberMap.get(right.memberIds[0]);
        if (!leftLead || !rightLead) return 0;
        return leftLead.birthDate.localeCompare(rightLead.birthDate) || leftLead.name.localeCompare(rightLead.name);
      });

      return drafts;
    });

    const preparedRows: PreparedUnitDraft[][] = [];
    const draftUnitByMember = new Map<string, string>();

    rowDrafts.forEach((drafts, rowIndex) => {
      const preparedDrafts = drafts.map((draft, unitIndex) => {
        const unitId = `g${draft.generation}-u${unitIndex}`;
        const leadMemberId = draft.maleId ?? draft.memberIds[0];
        const leadMember = memberMap.get(leadMemberId);
        const availableParentIds = leadMember
          ? getParentIds(leadMember).filter((parentId) => draftUnitByMember.has(parentId))
          : [];
        const fatherId = availableParentIds.find((parentId) => memberMap.get(parentId)?.gender === "male");
        const motherId = availableParentIds.find((parentId) => memberMap.get(parentId)?.gender === "female");
        const sourceParentIds = fatherId && motherId
          ? [fatherId, motherId]
          : fatherId
            ? [fatherId]
            : availableParentIds.slice(0, 1);
        const primaryParentId = sourceParentIds[0];

        return {
          ...draft,
          id: unitId,
          sourceUnitId: primaryParentId ? draftUnitByMember.get(primaryParentId) : undefined,
          sourceClusterKey: sourceParentIds.length > 0
            ? `${sourceParentIds.slice().sort().join(":")}->g${draft.generation}`
            : undefined,
          sourceParentIds: sourceParentIds.length > 0 ? sourceParentIds : undefined,
          subtreeWidth: draft.width,
        };
      });

      preparedDrafts.forEach((draft) => {
        draft.memberIds.forEach((memberId) => {
          draftUnitByMember.set(memberId, draft.id);
        });
      });

      preparedRows[rowIndex] = preparedDrafts;
    });

    const draftById = new Map<string, PreparedUnitDraft>();
    const childDraftsBySource = new Map<string, PreparedUnitDraft[]>();

    preparedRows.flat().forEach((draft) => {
      draftById.set(draft.id, draft);
      if (!draft.sourceUnitId) return;
      if (!childDraftsBySource.has(draft.sourceUnitId)) {
        childDraftsBySource.set(draft.sourceUnitId, []);
      }
      childDraftsBySource.get(draft.sourceUnitId)!.push(draft);
    });

    childDraftsBySource.forEach((childDrafts) => {
      childDrafts.sort((left, right) => {
        if (left.orderKey !== right.orderKey) return left.orderKey - right.orderKey;
        if (left.weight !== right.weight) return left.weight - right.weight;
        return left.memberIds[0].localeCompare(right.memberIds[0]);
      });
    });

    const subtreeWidthCache = new Map<string, number>();
    const resolveSubtreeWidth = (unitId: string): number => {
      if (subtreeWidthCache.has(unitId)) return subtreeWidthCache.get(unitId)!;

      const draft = draftById.get(unitId);
      if (!draft) return CARD_WIDTH;

      const childDrafts = childDraftsBySource.get(unitId) ?? [];

      if (draft.maleId && draft.wifeIds.length > 1) {
        const childClusterWidthsByWife = new Map<string, number>();

        draft.wifeIds.forEach((wifeId) => {
          const wifeChildDrafts = childDrafts.filter((childDraft) => childDraft.sourceParentIds?.includes(wifeId));
          const clusterWidth = wifeChildDrafts.length === 0
            ? CARD_WIDTH
            : wifeChildDrafts.reduce((sum, childDraft) => sum + resolveSubtreeWidth(childDraft.id), 0)
              + Math.max(0, wifeChildDrafts.length - 1) * UNIT_GAP;
          childClusterWidthsByWife.set(wifeId, Math.max(CARD_WIDTH, clusterWidth));
        });

        const memberOffsets = [0];
        let cursor = CARD_WIDTH + SPOUSE_GAP;

        draft.wifeIds.forEach((wifeId) => {
          const wifeSpanWidth = childClusterWidthsByWife.get(wifeId) ?? CARD_WIDTH;
          memberOffsets.push(cursor + (wifeSpanWidth - CARD_WIDTH) / 2);
          cursor += wifeSpanWidth + SAME_SOURCE_CLUSTER_GAP;
        });

        draft.memberOffsets = memberOffsets;
        draft.width = Math.max(
          cursor - SAME_SOURCE_CLUSTER_GAP,
          memberOffsets[memberOffsets.length - 1] + CARD_WIDTH,
        );
      }

      if (childDrafts.length === 0) {
        subtreeWidthCache.set(unitId, draft.width);
        return draft.width;
      }

      const childSpanWidth = childDrafts.reduce((sum, childDraft) => sum + resolveSubtreeWidth(childDraft.id), 0)
        + Math.max(0, childDrafts.length - 1) * UNIT_GAP;
      const subtreeWidth = Math.max(draft.width, childSpanWidth);
      subtreeWidthCache.set(unitId, subtreeWidth);
      return subtreeWidth;
    };

    preparedRows.forEach((drafts) => {
      drafts.forEach((draft) => {
        draft.subtreeWidth = resolveSubtreeWidth(draft.id);
      });
    });

    const positions = new Map<string, NodePosition>();
    const unitByMember = new Map<string, string>();
    const unitsById = new Map<string, UnitLayout>();
    const rawUnits: UnitLayout[] = [];
    let globalOrder = 0;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;

    preparedRows.forEach((drafts, rowIndex) => {
      const y = PADDING_Y + rowIndex * (CARD_HEIGHT + V_GAP);

      const clusterMap = new Map<string, {
        id: string;
        sourceUnitId?: string;
        sourceParentIds?: string[];
        sourceCenter?: number;
        sortValue: number;
        units: PreparedUnitDraft[];
        width: number;
      }>();

      drafts.forEach((draft) => {
        const sourceCenter = resolveFamilySourceCenter(draft.sourceParentIds, positions)
          ?? (draft.sourceUnitId ? unitsById.get(draft.sourceUnitId)?.centerX : undefined);
        const clusterId = draft.sourceClusterKey ?? draft.sourceUnitId ?? draft.id;

        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, {
            id: clusterId,
            sourceUnitId: draft.sourceUnitId,
            sourceParentIds: draft.sourceParentIds,
            sourceCenter,
            sortValue: sourceCenter ?? draft.weight,
            units: [],
            width: 0,
          });
        }

        const cluster = clusterMap.get(clusterId)!;
        cluster.units.push(draft);
        cluster.sourceCenter = sourceCenter ?? cluster.sourceCenter;
        cluster.sortValue = sourceCenter ?? Math.min(cluster.sortValue, draft.weight);
      });

      const clusters = Array.from(clusterMap.values())
        .map((cluster) => {
          cluster.units.sort((left, right) => {
            if (left.orderKey !== right.orderKey) return left.orderKey - right.orderKey;
            if (left.weight !== right.weight) return left.weight - right.weight;
            return left.memberIds[0].localeCompare(right.memberIds[0]);
          });

          const width = cluster.units.reduce((sum, unit) => sum + unit.subtreeWidth, 0)
            + Math.max(0, cluster.units.length - 1) * UNIT_GAP;

          return {
            ...cluster,
            width,
          };
        })
        .sort((left, right) => {
          if (left.sortValue !== right.sortValue) return left.sortValue - right.sortValue;
          return left.id.localeCompare(right.id);
        });

      let fallbackX = 0;
      const desiredClusterPositions = clusters.map((cluster) => {
        if (cluster.sourceCenter !== undefined) {
          return cluster.sourceCenter - cluster.width / 2;
        }

        const currentX = fallbackX;
        fallbackX += cluster.width + UNIT_GAP;
        return currentX;
      });

      const clusterGaps = clusters.slice(0, -1).map((cluster, index) => {
        const nextCluster = clusters[index + 1];
        return cluster.sourceUnitId && nextCluster?.sourceUnitId && cluster.sourceUnitId === nextCluster.sourceUnitId
          ? SAME_SOURCE_CLUSTER_GAP
          : UNIT_GAP;
      });

      const solvedClusterPositions = solveNonOverlappingPositions(
        desiredClusterPositions,
        clusters.map((cluster) => cluster.width),
        clusterGaps,
      );

      clusters.forEach((cluster, clusterIndex) => {
        let footprintCursor = solvedClusterPositions[clusterIndex];

        cluster.units.forEach((draft) => {
          const unitX = footprintCursor + (draft.subtreeWidth - draft.width) / 2;
          const centerX = footprintCursor + draft.subtreeWidth / 2;
          const unit: UnitLayout = {
            id: draft.id,
            generation: draft.generation,
            memberIds: draft.memberIds,
            maleId: draft.maleId,
            wifeIds: draft.wifeIds,
            spouseGap: draft.spouseGap,
            x: unitX,
            y,
            width: draft.width,
            centerX,
            footprintX: footprintCursor,
            footprintWidth: draft.subtreeWidth,
            order: globalOrder,
          };
          globalOrder += 1;
          unitsById.set(unit.id, unit);
          rawUnits.push(unit);

          minX = Math.min(minX, footprintCursor);
          maxX = Math.max(maxX, footprintCursor + draft.subtreeWidth);

          draft.memberIds.forEach((memberId, memberIndex) => {
            const memberX = unitX + (draft.memberOffsets[memberIndex] ?? (memberIndex * (CARD_WIDTH + draft.spouseGap)));
            positions.set(memberId, { x: memberX, y });
            unitByMember.set(memberId, unit.id);
          });

          footprintCursor += draft.subtreeWidth + UNIT_GAP;
        });
      });
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = 0;
      maxX = CARD_WIDTH;
    }

    const shiftX = PADDING_X - minX;
    const shiftedPositions = new Map<string, NodePosition>();
    for (const [memberId, position] of positions.entries()) {
      shiftedPositions.set(memberId, {
        x: position.x + shiftX,
        y: position.y,
      });
    }

    const shiftedUnitsById = new Map<string, UnitLayout>();
    rawUnits.forEach((unit) => {
      shiftedUnitsById.set(unit.id, {
        ...unit,
        x: unit.x + shiftX,
        centerX: unit.centerX + shiftX,
        footprintX: unit.footprintX + shiftX,
      });
    });

    const contentWidth = maxX - minX;
    const width = contentWidth + PADDING_X * 2;
    const height = generationLevels.length * CARD_HEIGHT + Math.max(0, generationLevels.length - 1) * V_GAP + PADDING_Y * 2;

    const spouseConnectors: SpouseConnector[] = [];
    shiftedUnitsById.forEach((unit) => {
      if (unit.memberIds.length <= 1) return;

      unit.memberIds.slice(0, -1).forEach((memberId, index) => {
        const nextMemberId = unit.memberIds[index + 1];
        const currentPosition = shiftedPositions.get(memberId);
        const nextPosition = shiftedPositions.get(nextMemberId);
        if (!currentPosition || !nextPosition) return;

        spouseConnectors.push({
          id: `${unit.id}-spouse-link-${memberId}-${nextMemberId}`,
          x1: currentPosition.x + CARD_WIDTH + 16,
          x2: nextPosition.x - 16,
          y: unit.y + CARD_HEIGHT / 2,
        });
      });
    });

    const groupedBySource = new Map<string, {
      parentIds: string[];
      fatherId?: string;
      motherId?: string;
      generation: number;
      childIds: Set<string>;
    }>();
    for (const child of members) {
      const parentIds = getParentIds(child).filter((parentId) => unitByMember.has(parentId));
      if (parentIds.length === 0) continue;

      const fatherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "male");
      const motherId = parentIds.find((parentId) => memberMap.get(parentId)?.gender === "female");
      const sourceParentIds = fatherId && motherId ? [fatherId, motherId] : fatherId ? [fatherId] : [parentIds[0]];
      const sourceKey = `${sourceParentIds.slice().sort().join(":")}->g${child.generation}`;

      if (!groupedBySource.has(sourceKey)) {
        groupedBySource.set(sourceKey, {
          parentIds: sourceParentIds,
          fatherId,
          motherId,
          generation: child.generation,
          childIds: new Set(),
        });
      }

      groupedBySource.get(sourceKey)!.childIds.add(child.id);
    }

    const pendingParentGroups = Array.from(groupedBySource.entries())
      .map(([sourceKey, group]) => {
        const anchorEntries = group.parentIds
          .map((parentId) => {
            const position = shiftedPositions.get(parentId);
            if (!position) return null;

            return {
              id: parentId,
              anchor: getAnchors(position).bottom,
            };
          })
          .filter((entry): entry is { id: string; anchor: Point } => Boolean(entry));

        if (anchorEntries.length === 0) return null;

        const motherAnchored = shouldUseMotherAnchor(group.parentIds);
        const selectedAnchors = motherAnchored && group.motherId
          ? anchorEntries.filter((entry) => entry.id === group.motherId)
          : anchorEntries;
        const effectiveAnchors = selectedAnchors.length > 0 ? selectedAnchors : anchorEntries;

        const targets = Array.from(group.childIds)
          .map((childId) => {
            const position = shiftedPositions.get(childId);
            if (!position) return null;

            return getAnchors(position).top;
          })
          .filter((target): target is Point => Boolean(target))
          .sort((left, right) => left.x - right.x)
          .filter((target, index, allTargets) =>
            allTargets.findIndex((candidate) => candidate.x === target.x && candidate.y === target.y) === index,
          );

        if (targets.length === 0) return null;

        const parentAnchors = effectiveAnchors.map((entry) => entry.anchor).sort((left, right) => left.x - right.x);
        const sourceCenter = motherAnchored && group.motherId
          ? parentAnchors[0]?.x
          : resolveFamilySourceCenter(group.parentIds, shiftedPositions) ?? average(parentAnchors.map((anchor) => anchor.x));
        const laneKey = motherAnchored && group.motherId
          ? `${group.motherId}->g${group.generation}`
          : group.fatherId
            ? `${group.fatherId}->g${group.generation}`
            : `${group.parentIds.slice().sort().join(":")}->g${group.generation}`;

        return {
          id: sourceKey,
          laneKey,
          parentAnchors,
          targets,
          sourceX: round(sourceCenter),
        };
      })
      .filter((group): group is {
        id: string;
        laneKey: string;
        parentAnchors: Point[];
        targets: Point[];
        sourceX: number;
      } => Boolean(group));

    const laneIndexByGroupId = new Map<string, number>();
    const pendingGroupsByLane = new Map<string, typeof pendingParentGroups>();

    pendingParentGroups.forEach((group) => {
      if (!pendingGroupsByLane.has(group.laneKey)) pendingGroupsByLane.set(group.laneKey, []);
      pendingGroupsByLane.get(group.laneKey)!.push(group);
    });

    pendingGroupsByLane.forEach((groups) => {
      groups
        .sort((left, right) => left.sourceX - right.sourceX)
        .forEach((group, laneIndex) => {
          laneIndexByGroupId.set(group.id, laneIndex);
        });
    });

    const parentGroups: ParentGroup[] = pendingParentGroups.map((group) => {
      const laneIndex = laneIndexByGroupId.get(group.id) ?? 0;
      const source = group.parentAnchors.length === 1
        ? group.parentAnchors[0]
        : {
            x: group.sourceX,
            y: Math.max(...group.parentAnchors.map((anchor) => anchor.y)) + PAIR_JOIN_OFFSET + laneIndex * PAIR_LANE_GAP,
          };

      const topY = Math.min(...group.targets.map((target) => target.y));
      const minBusY = source.y + 28;
      const maxBusY = topY - 34;
      const preferredBusY = source.y + 72;
      const safeBusY = maxBusY <= minBusY
        ? round((source.y + topY) / 2)
        : Math.min(maxBusY, Math.max(minBusY, preferredBusY));

      return {
        id: group.id,
        laneKey: group.laneKey,
        parentAnchors: group.parentAnchors,
        source,
        busY: safeBusY,
        targets: group.targets,
      };
    });

    parentGroups.sort((left, right) => {
      const sourceDiff = left.source.y - right.source.y;
      if (sourceDiff !== 0) return sourceDiff;
      return left.source.x - right.source.x;
    });

      return {
        positions: shiftedPositions,
        unitByMember,
        width,
        height,
        spouseConnectors,
        parentGroups,
      };
  }, [memberMap, members]);

  const sourceMember = connectState ? memberMap.get(connectState.sourceId) : undefined;
  const sourcePosition = connectState ? layout.positions.get(connectState.sourceId) : undefined;

  const previewPath = useMemo(() => {
    if (!connectState || !cursor || !sourcePosition) return null;
    return makeOrthogonalPath(getAnchors(sourcePosition).top, cursor);
  }, [connectState, cursor, sourcePosition]);

  const handleCanvasMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!connectState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const cancelConnectMode = () => {
    setConnectState(null);
    setCursor(null);
  };

  const handleMemberClick = (member: FamilyMember) => {
    if (!connectState) {
      onSelectMember(member);
      return;
    }

    if (connectState.sourceId === member.id) {
      cancelConnectMode();
      return;
    }

    onConnectParent(connectState.sourceId, member.id);
    cancelConnectMode();
  };

  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{ width: Math.max(layout.width, 980), height: Math.max(layout.height, 560) }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        cancelConnectMode();
        onClearSelection?.();
      }}
      onPointerMove={handleCanvasMove}
      onPointerLeave={() => setCursor(null)}
    >
      <svg className="absolute inset-0 h-full w-full pointer-events-none" shapeRendering="geometricPrecision">
        {layout.spouseConnectors.map((connector) => (
          <line
            key={connector.id}
            x1={connector.x1}
            y1={connector.y}
            x2={connector.x2}
            y2={connector.y}
            stroke="hsl(var(--tree-line) / 0.7)"
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeDasharray="8 8"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {layout.parentGroups.map((group) => {
          const geometry = buildParentGroupGeometry(group);
          return (
            <g key={group.id}>
              {geometry.paths.map((path, index) => (
                <path
                  key={`${group.id}-path-${index}`}
                  d={path}
                  fill="none"
                  stroke="hsl(var(--tree-line))"
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {geometry.joints.map((joint, index) => (
                <circle
                  key={`${group.id}-joint-${index}`}
                  cx={joint.x}
                  cy={joint.y}
                  r={1.7}
                  fill="hsl(var(--tree-line))"
                />
              ))}
            </g>
          );
        })}

        {previewPath && (
          <path
            d={previewPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2.2}
            strokeDasharray="6 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {members.map((member) => {
        const position = layout.positions.get(member.id);
        if (!position) return null;

        const spouses = getSpouses(members, member.id);
        const spouseIds = getSpouseIds(member);
        const isSelected = selectedMemberId === member.id;
        const isConnectingSource = connectState?.sourceId === member.id;
        const isConnectingTarget = Boolean(connectState && connectState.sourceId !== member.id);
        const spouseButtonDisabled = member.gender === "female" && spouseIds.length > 0;

        return (
          <div
            key={member.id}
            className="absolute group animate-reveal-up transition-[left,top,opacity,transform] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
            style={{ left: position.x, top: position.y, width: CARD_WIDTH }}
          >
            <button
              data-no-pan="true"
              onClick={() => handleMemberClick(member)}
              className={cn(
                "glass-card group relative h-[122px] w-full overflow-hidden rounded-3xl border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                isSelected && "border-primary/70 ring-2 ring-primary/25",
                isConnectingSource && "border-primary/70 ring-2 ring-primary/30",
                isConnectingTarget && "hover:border-accent/70",
              )}
            >
              <span
                className={cn(
                  "absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm",
                  member.gender === "male"
                    ? "border-sky-200 bg-sky-50 text-sky-600"
                    : "border-pink-200 bg-pink-50 text-pink-600",
                )}
              >
                <span className="text-sm font-semibold leading-none">{member.gender === "male" ? "♂" : "♀"}</span>
              </span>
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-3.5">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold",
                      member.gender === "male" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
                    )}>
                      {member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 pr-10">
                    <p className="truncate text-lg font-semibold leading-tight text-foreground">{member.name}</p>
                    {member.isFamilyHead && (
                      <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                        <Crown className="h-2.5 w-2.5" />
                        Kepala
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{parseYear(member.birthDate)}</span>
                    {member.deathDate && <span>– {parseYear(member.deathDate)}</span>}
                  </div>

                  {spouses.length > 0 && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      Pasangan: {spouses.map((spouse) => spouse.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </button>

            <div
              className={cn(
                "absolute top-2 z-20 flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-background/92 p-1.5 shadow-sm backdrop-blur transition-all duration-200",
                !isSelected && !isConnectingSource && "pointer-events-none opacity-0",
                member.gender === "male" ? "-left-14" : "-right-14",
              )}
            >
              <ActionButton title="Edit anggota" onClick={() => onEditMember(member)}>
                <Pencil className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                title={spouseButtonDisabled ? "Istri tidak boleh punya banyak suami" : "Tambah pasangan"}
                onClick={() => onAddSpouse(member.id)}
                disabled={spouseButtonDisabled}
              >
                <Heart className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                title="Sambungkan orang tua"
                active={connectState?.sourceId === member.id}
                onClick={() => setConnectState({ sourceId: member.id })}
              >
                <UsersRound className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
            </div>

            <div
              className={cn(
                "absolute -bottom-14 z-20 flex items-center gap-2 rounded-full border border-border/70 bg-background/92 px-2 py-1.5 shadow-sm backdrop-blur transition-all duration-200",
                !isSelected && !isConnectingSource && "pointer-events-none opacity-0",
                member.gender === "male" ? "left-6" : "right-6 flex-row-reverse",
              )}
            >
              <ActionButton title="Tambah anak" onClick={() => onAddChild(member.id)}>
                <UserPlus className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                title={member.isFamilyHead ? "Lepas kepala keluarga" : "Jadikan kepala keluarga"}
                active={member.isFamilyHead}
                onClick={() => onSetFamilyHead(member.id, !member.isFamilyHead)}
              >
                <Crown className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                title="Hapus anggota"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDeleteMember(member.id)}
              >
                <Trash2 className="mx-auto h-3.5 w-3.5" />
              </ActionButton>
            </div>
          </div>
        );
      })}

      {connectState && sourceMember && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur">
          <p className="text-xs text-foreground">
            Mode sambung orang tua dari <span className="font-semibold">{sourceMember.name}</span>, klik kartu tujuan
          </p>
          <button
            data-no-pan="true"
            onClick={cancelConnectMode}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
