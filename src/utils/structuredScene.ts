import type { SceneState } from "../types";
import { CHARACTER_GROUPS } from "../components/CharacterGroup";

/** A scene change, plus the groups whose spent dice must be refilled because of it */
export interface SceneChange {
  scene: SceneState;
  refillGroupIds: number[];
}

const DEFAULT_IDS = CHARACTER_GROUPS.map((group) => group.id);

/** Drops unknown groups and appends the ones missing from the saved order, in their default order */
export function normalizeScene(scene: SceneState): SceneState {
  const ALL_IDS = [
    ...DEFAULT_IDS.filter((id) => !scene.deletedGroups.includes(id)),
    ...scene.customGroups,
  ];
  const roundGroups = scene.active
    ? scene.roundGroups.filter((id) => ALL_IDS.includes(id))
    : [];
  const placed = [...roundGroups];
  const groupOrder: number[] = [];
  for (const id of [...scene.groupOrder, ...ALL_IDS]) {
    if (ALL_IDS.includes(id) && !placed.includes(id)) {
      placed.push(id);
      groupOrder.push(id);
    }
  }
  const turnGroup =
    scene.active &&
    scene.turnGroup !== null &&
    roundGroups.includes(scene.turnGroup)
      ? scene.turnGroup
      : (roundGroups[0] ?? null);
  return { ...scene, roundGroups, groupOrder, turnGroup };
}

export function startScene(
  scene: SceneState,
  selectedIds: number[],
): SceneChange {
  const { groupOrder } = normalizeScene({ ...scene, active: false });
  const roundGroups = groupOrder.filter((id) => selectedIds.includes(id));
  return {
    scene: {
      ...scene,
      active: true,
      round: 1,
      turnGroup: roundGroups[0] ?? null,
      roundGroups,
      groupOrder: groupOrder.filter((id) => !roundGroups.includes(id)),
      customGroups: scene.customGroups,
    },
    refillGroupIds: roundGroups,
  };
}

/** The groups that were in the round go first, and no dice change */
export function endScene(scene: SceneState): SceneChange {
  const { roundGroups, groupOrder } = normalizeScene(scene);
  return {
    scene: {
      ...scene,
      active: false,
      round: 1,
      turnGroup: null,
      roundGroups: [],
      groupOrder: [...roundGroups, ...groupOrder],
      customGroups: scene.customGroups,
    },
    refillGroupIds: [],
  };
}

export function resetRounds(scene: SceneState): SceneChange {
  const { roundGroups } = normalizeScene(scene);
  return {
    scene: { ...scene, round: 1, turnGroup: roundGroups[0] ?? null },
    refillGroupIds: roundGroups,
  };
}

export function nextTurn(scene: SceneState): SceneChange {
  const current = normalizeScene(scene);
  const { roundGroups } = current;
  if (roundGroups.length === 0) return { scene, refillGroupIds: [] };
  const index = roundGroups.indexOf(current.turnGroup as number);
  if (index === roundGroups.length - 1) {
    return {
      scene: { ...scene, round: scene.round + 1, turnGroup: roundGroups[0] },
      refillGroupIds: roundGroups,
    };
  }
  return {
    scene: { ...scene, turnGroup: roundGroups[index + 1] },
    refillGroupIds: [],
  };
}

export const canGoPrevious = (scene: SceneState): boolean => {
  const { roundGroups, turnGroup } = normalizeScene(scene);
  return (
    roundGroups.length > 0 && (scene.round > 1 || roundGroups[0] !== turnGroup)
  );
};

export function previousTurn(scene: SceneState): SceneChange {
  const current = normalizeScene(scene);
  const { roundGroups } = current;
  if (!canGoPrevious(scene)) return { scene, refillGroupIds: [] };
  const index = roundGroups.indexOf(current.turnGroup as number);
  if (index > 0) {
    return {
      scene: { ...scene, turnGroup: roundGroups[index - 1] },
      refillGroupIds: [],
    };
  }
  return {
    scene: {
      ...scene,
      round: scene.round - 1,
      turnGroup: roundGroups[roundGroups.length - 1],
    },
    refillGroupIds: roundGroups,
  };
}

export type DropZone = "round" | "outside";

/**
 * Moves a group to the place of `targetId` in a zone. Without a target, a
 * group leaving the round goes first; other moves go to the end of the zone.
 * Groups entering the round counter get their dice refilled.
 */
export function moveGroupInScene(
  scene: SceneState,
  movedId: number,
  zone: DropZone,
  targetId: number | null,
): SceneChange {
  const current = normalizeScene(scene);
  const wasInRound = current.roundGroups.includes(movedId);
  const withoutMoved = (ids: number[]) => ids.filter((id) => id !== movedId);
  const original = zone === "round" ? current.roundGroups : current.groupOrder;
  const destination = withoutMoved(original);
  const targetIndex = targetId === null ? -1 : original.indexOf(targetId);
  const insertIndex =
    targetIndex !== -1
      ? Math.min(targetIndex, destination.length)
      : zone === "outside" && wasInRound && targetId === null
        ? 0
        : destination.length;
  destination.splice(insertIndex, 0, movedId);

  const roundGroups =
    zone === "round" ? destination : withoutMoved(current.roundGroups);
  const groupOrder =
    zone === "round" ? withoutMoved(current.groupOrder) : destination;

  let turnGroup = current.turnGroup;
  const entered = zone === "round" && !wasInRound;
  const left = zone === "outside" && wasInRound;
  if (entered && roundGroups.length === 1) {
    turnGroup = movedId;
  } else if (left && turnGroup === movedId) {
    // The next group takes the turn, or the last one when the moved group was the last
    const index = current.roundGroups.indexOf(movedId);
    turnGroup = roundGroups[Math.min(index, roundGroups.length - 1)] ?? null;
  }

  return {
    scene: { ...scene, roundGroups, groupOrder, turnGroup },
    refillGroupIds: entered ? [movedId] : [],
  };
}

/** Adds a new group at the bottom of the groups outside the round counter */
export function addGroupToScene(
  scene: SceneState,
  groupId: number,
): SceneState {
  const current = normalizeScene(scene);
  return {
    ...scene,
    customGroups: [...scene.customGroups, groupId],
    roundGroups: current.roundGroups,
    groupOrder: [...current.groupOrder, groupId],
    turnGroup: current.turnGroup,
  };
}

/** Removes a group without advancing the round or refilling dice. */
export function removeGroupFromScene(
  scene: SceneState,
  groupId: number,
): SceneState {
  const current = normalizeScene(scene);
  const index = current.roundGroups.indexOf(groupId);
  const roundGroups = current.roundGroups.filter((id) => id !== groupId);
  const turnGroup =
    current.turnGroup === groupId
      ? (roundGroups[Math.min(index, roundGroups.length - 1)] ?? null)
      : current.turnGroup;

  return {
    ...current,
    roundGroups,
    turnGroup,
    groupOrder: current.groupOrder.filter((id) => id !== groupId),
    customGroups: current.customGroups.filter((id) => id !== groupId),
    deletedGroups: [...current.deletedGroups, groupId],
  };
}
