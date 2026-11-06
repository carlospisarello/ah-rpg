import { useEffect } from "react";
import type { GameState } from "../types";
import {
  DEFAULT_GROUP,
  metadataKeys,
  UNASSIGNED_GROUP_ID,
  updateCounterData,
} from "../utils/metadata";

/**
 * Gives the default group to every character that doesn't have one yet.
 * Only the GM's client does it, so players don't race to write it.
 */
export function useAssignDefaultGroups(
  { isGM, characters, scene }: GameState,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !isGM) return;

    const ungroupedCharacters = characters.filter(
      (character) => character.metadata?.[metadataKeys.group] === undefined,
    );

    ungroupedCharacters.forEach((character) =>
      updateCounterData(character.id, {
        group: scene.deletedGroups.includes(DEFAULT_GROUP)
          ? UNASSIGNED_GROUP_ID
          : DEFAULT_GROUP,
      }).catch((err) =>
        console.error("Failed to assign default group:", err),
      ),
    );
  }, [enabled, isGM, characters, scene.deletedGroups]);
}
