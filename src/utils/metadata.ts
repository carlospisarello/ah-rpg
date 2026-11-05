import OBR, { type Metadata } from "@owlbear-rodeo/sdk";
import type {
  Character,
  CounterData,
  GroupIcons,
  GroupNames,
  SceneState,
} from "../types";

const METADATA_PREFIX = "ah-rpg-dice";

export const GM_ASSIGNEE = "gm";

export const DEFAULT_GROUP = 1;

/** The group of the characters that left their group, see UNASSIGNED_GROUP */
export const UNASSIGNED_GROUP_ID = 5;

/** Scene metadata, shared by every client in the scene */
export const sceneMetadataKeys = {
  groupNames: `${METADATA_PREFIX}/group-names`,
  groupIcons: `${METADATA_PREFIX}/group-icons`,
  groupOrder: `${METADATA_PREFIX}/group-order`,
  round: `${METADATA_PREFIX}/round`,
  structuredScene: `${METADATA_PREFIX}/structured-scene`,
  turnGroup: `${METADATA_PREFIX}/turn-group`,
  roundGroups: `${METADATA_PREFIX}/round-groups`,
  customGroups: `${METADATA_PREFIX}/custom-groups`,
};

export const getGroupNames = (metadata: Metadata): GroupNames =>
  (metadata[sceneMetadataKeys.groupNames] as GroupNames) || {};

export async function updateGroupNames(groupNames: GroupNames): Promise<void> {
  await OBR.scene.setMetadata({ [sceneMetadataKeys.groupNames]: groupNames });
}

export const getGroupIcons = (metadata: Metadata): GroupIcons =>
  (metadata[sceneMetadataKeys.groupIcons] as GroupIcons) || {};

export async function updateGroupIcons(groupIcons: GroupIcons): Promise<void> {
  await OBR.scene.setMetadata({ [sceneMetadataKeys.groupIcons]: groupIcons });
}

export const getScene = (metadata: Metadata): SceneState => ({
  active: (metadata[sceneMetadataKeys.structuredScene] as boolean) || false,
  round: (metadata[sceneMetadataKeys.round] as number) || 1,
  turnGroup: (metadata[sceneMetadataKeys.turnGroup] as number | null) ?? null,
  roundGroups: (metadata[sceneMetadataKeys.roundGroups] as number[]) || [],
  groupOrder: (metadata[sceneMetadataKeys.groupOrder] as number[]) || [],
  customGroups: (metadata[sceneMetadataKeys.customGroups] as number[]) || [],
});

export async function updateScene(scene: SceneState): Promise<void> {
  await OBR.scene.setMetadata({
    [sceneMetadataKeys.structuredScene]: scene.active,
    [sceneMetadataKeys.round]: scene.round,
    [sceneMetadataKeys.turnGroup]: scene.turnGroup,
    [sceneMetadataKeys.roundGroups]: scene.roundGroups,
    [sceneMetadataKeys.groupOrder]: scene.groupOrder,
    [sceneMetadataKeys.customGroups]: scene.customGroups,
  });
}

export const metadataKeys = {
  limit: `${METADATA_PREFIX}/limit`,
  horrorLimit: `${METADATA_PREFIX}/horror-limit`,
  damage: `${METADATA_PREFIX}/damage`,
  used: `${METADATA_PREFIX}/used`,
  assignment: `${METADATA_PREFIX}/assignment`,
  group: `${METADATA_PREFIX}/group`,
  counter: `${METADATA_PREFIX}/counter`,
  counterVisible: `${METADATA_PREFIX}/counter-visible`,
  counterWasVisible: `${METADATA_PREFIX}/counter-was-visible`,
};

/** CounterData fields that map 1:1 onto a metadata key. */
const directFieldKeys = {
  counter: metadataKeys.counter,
  limit: metadataKeys.limit,
  horrorLimit: metadataKeys.horrorLimit,
  damage: metadataKeys.damage,
  used: metadataKeys.used,
  assignedTo: metadataKeys.assignment,
  group: metadataKeys.group,
} as const;

export const getAssignee = (character: Character): string =>
  (character.metadata?.[metadataKeys.assignment] as string) || GM_ASSIGNEE;

export const getGroup = (character: Character): number =>
  (character.metadata?.[metadataKeys.group] as number) || DEFAULT_GROUP;

export async function getCounterData(
  character: Character,
): Promise<CounterData> {
  const metadata = character.metadata || {};
  return {
    limit: (metadata[metadataKeys.limit] as number) || 6,
    horrorLimit: (metadata[metadataKeys.horrorLimit] as number) || 0,
    damage: (metadata[metadataKeys.damage] as number) || 0,
    used: (metadata[metadataKeys.used] as number[]) || [],
    counter: (metadata[metadataKeys.counter] as number) || 0,
    visible: (metadata[metadataKeys.counterVisible] as boolean) !== false,
    wasVisible: (metadata[metadataKeys.counterWasVisible] as boolean) !== false,
    assignedTo: (metadata[metadataKeys.assignment] as string) || GM_ASSIGNEE,
    group: getGroup(character),
  };
}

/** Characters that leave their group belong to the GM */
export const withUnassignedOwner = (
  updates: Partial<CounterData>,
): Partial<CounterData> =>
  updates.group === UNASSIGNED_GROUP_ID
    ? { ...updates, assignedTo: GM_ASSIGNEE }
    : updates;

export async function updateCounterData(
  characterId: string,
  updates: Partial<CounterData>,
): Promise<void> {
  updates = withUnassignedOwner(updates);
  const changes: Record<string, unknown> = {};

  for (const field of Object.keys(directFieldKeys) as Array<
    keyof typeof directFieldKeys
  >) {
    if (updates[field] !== undefined) {
      changes[directFieldKeys[field]] = updates[field];
    }
  }

  if (updates.visible !== undefined) {
    changes[metadataKeys.counterVisible] = updates.visible;
    if (updates.visible) {
      // Making the counter visible also resets wasVisible
      changes[metadataKeys.counterWasVisible] = true;
    }
  }
  // An explicit wasVisible takes precedence over the implicit one above
  if (updates.wasVisible !== undefined) {
    changes[metadataKeys.counterWasVisible] = updates.wasVisible;
  }

  await OBR.scene.items.updateItems([characterId], (items) => {
    items.forEach((item) => {
      item.metadata = { ...item.metadata, ...changes };
    });
  });
}

/** Returns `used` plus every die currently damaged (those are consumed once the damage is cleared). */
export function withDamagedDiceUsed({
  limit,
  damage,
  used,
}: CounterData): number[] {
  const newUsed = [...used];
  for (let i = limit - damage; i < limit; i++) {
    if (!newUsed.includes(i)) {
      newUsed.push(i);
    }
  }
  return newUsed;
}

/** Refills every spent die of the characters, except the damaged ones which stay spent. */
export async function refillDice(characters: Character[]): Promise<void> {
  await Promise.all(
    characters.map(async (character) => {
      const counterData = await getCounterData(character);
      await updateCounterData(character.id, {
        used: withDamagedDiceUsed({ ...counterData, used: [] }),
      });
    }),
  );
}

function isAssignedToPlayer(assignedTo: string, playerId: string): boolean {
  return assignedTo !== GM_ASSIGNEE && assignedTo === playerId;
}

export function canPlayerInteract(
  playerIsGM: boolean,
  playerId: string,
  assignedTo: string,
): boolean {
  return playerIsGM || isAssignedToPlayer(assignedTo, playerId);
}

export function shouldPlayerSeeCounter(
  playerIsGM: boolean,
  playerId: string,
  counterVisible: boolean,
  assignedTo: string,
): boolean {
  // The GM and the assigned player always see the counter; others only if it's visible
  return (
    playerIsGM || isAssignedToPlayer(assignedTo, playerId) || counterVisible
  );
}

/** Whether the character is shown to the players who aren't assigned to it */
export function isCharacterVisible(character: Character): boolean {
  // A hidden item hides its counter, see CharacterItem
  return (
    character.visible &&
    (character.metadata?.[metadataKeys.counterVisible] as boolean) !== false
  );
}

/** Same outcome as CharacterItem, read from the metadata so the list can filter without loading counter data. */
export function canPlayerSeeCharacter(
  character: Character,
  playerIsGM: boolean,
  playerId: string,
): boolean {
  return shouldPlayerSeeCounter(
    playerIsGM,
    playerId,
    isCharacterVisible(character),
    getAssignee(character),
  );
}
