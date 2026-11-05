import { useEffect } from "react";
import type { GameState } from "../types";
import {
  DEFAULT_GROUP,
  metadataKeys,
  updateCounterData,
} from "../utils/metadata";

/**
 * Gives the default group to every character that doesn't have one yet.
 * Only the GM's client does it, so players don't race to write it.
 */
export function useAssignDefaultGroups(
  { isGM, characters }: GameState,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !isGM) return;

    const ungroupedCharacters = characters.filter(
      (character) => character.metadata?.[metadataKeys.group] === undefined,
    );

    ungroupedCharacters.forEach((character) =>
      updateCounterData(character.id, { group: DEFAULT_GROUP }).catch((err) =>
        console.error("Failed to assign default group:", err),
      ),
    );
  }, [enabled, isGM, characters]);
}
