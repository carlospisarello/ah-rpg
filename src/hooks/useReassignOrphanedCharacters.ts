import { useEffect } from "react";
import type { GameState } from "../types";
import {
  GM_ASSIGNEE,
  getAssignee,
  updateCounterData,
} from "../utils/metadata";

/**
 * Reassigns to the GM every character assigned to a player who is no longer in
 * the party. Only the GM's client does it, so players don't race to write it.
 */
export function useReassignOrphanedCharacters(
  { isGM, players, characters }: GameState,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !isGM) return;

    // The GM's own client doesn't appear in `players`, but the GM is never assigned by id
    const connectedPlayerIds = new Set(players.map((player) => player.id));
    const orphanedCharacters = characters.filter((character) => {
      const assignee = getAssignee(character);
      return assignee !== GM_ASSIGNEE && !connectedPlayerIds.has(assignee);
    });

    orphanedCharacters.forEach((character) =>
      updateCounterData(character.id, { assignedTo: GM_ASSIGNEE }).catch(
        (err) => console.error("Failed to reassign character to GM:", err),
      ),
    );
  }, [enabled, isGM, players, characters]);
}
