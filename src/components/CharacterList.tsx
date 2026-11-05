import { useState } from "react";
import { Container, Typography, Box } from "@mui/material";
import type { Character, GameState } from "../types";
import { CharacterItem } from "./CharacterItem";
import {
  ALL_GROUPS,
  CharacterGroup,
  UNASSIGNED_GROUP,
  getGroupName,
  moveGroup,
  sortGroups,
} from "./CharacterGroup";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { RoundCounter } from "./RoundCounter";
import {
  canPlayerSeeCharacter,
  getAssignee,
  getGroup,
  isCharacterVisible,
  refillDice,
  updateGroupOrder,
  updateRound,
} from "../utils/metadata";

interface CharacterListProps {
  gameState: GameState;
}

export function CharacterList({ gameState }: CharacterListProps) {
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  if (!gameState.currentPlayer) {
    return (
      <Container>
        <Typography color="error">Player data not available</Typography>
      </Container>
    );
  }

  if (gameState.characters.length === 0) {
    return (
      <Container>
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="textSecondary">
            No characters in the scene yet
          </Typography>
        </Box>
      </Container>
    );
  }

  const currentPlayerId = gameState.currentPlayer.id;
  const isAssignedToCurrentPlayer = (character: Character) =>
    getAssignee(character) === currentPlayerId;

  // Hidden characters are filtered out so that their group card isn't shown empty
  const visibleCharacters = gameState.characters.filter((character) =>
    canPlayerSeeCharacter(character, gameState.isGM, currentPlayerId),
  );

  // Non-GM players see the characters assigned to them first
  const sortedCharacters = gameState.isGM
    ? visibleCharacters
    : [...visibleCharacters].sort(
        (a, b) =>
          Number(isAssignedToCurrentPlayer(b)) -
          Number(isAssignedToCurrentPlayer(a)),
      );

  const editingGroup = ALL_GROUPS.find((group) => group.id === editingGroupId);

  // Every character gets its spent dice back, including the hidden ones
  const handleRoundChange = async (round: number) => {
    try {
      await Promise.all([updateRound(round), refillDice(gameState.characters)]);
    } catch (err) {
      console.error("Failed to change round:", err);
    }
  };

  const handleGroupDrop = async (targetId: number) => {
    if (draggedGroupId === null || draggedGroupId === targetId) return;

    const groupIds = sortGroups(gameState.groupOrder).map((group) => group.id);
    try {
      await updateGroupOrder(moveGroup(groupIds, draggedGroupId, targetId));
    } catch (err) {
      console.error("Failed to reorder groups:", err);
    }
  };

  const clearDrag = () => {
    setDraggedGroupId(null);
    setDropTargetId(null);
  };

  return (
    <Container>
      <Box sx={{ py: 2 }}>
        <RoundCounter
          round={gameState.round}
          onRoundChange={gameState.isGM ? handleRoundChange : undefined}
        />
        {[...sortGroups(gameState.groupOrder), UNASSIGNED_GROUP].map(
          (group) => {
            const isUnassigned = group.id === UNASSIGNED_GROUP.id;
            const groupCharacters = sortedCharacters.filter(
              (character) => getGroup(character) === group.id,
            );
            // The unassigned group is only shown to the GM, and only when it has characters
            if (
              isUnassigned &&
              (!gameState.isGM || groupCharacters.length === 0)
            )
              return null;
            // The GM also sees empty groups, so that they can be filled
            if (groupCharacters.length === 0 && !gameState.isGM) return null;

            // The GM sees the hidden characters too, which aren't counted in the group's characters
            const hiddenCount = gameState.isGM
              ? groupCharacters.filter(
                  (character) => !isCharacterVisible(character),
                ).length
              : undefined;

            // The unassigned group keeps its place at the bottom and can't be rearranged
            const isManageable = gameState.isGM && !isUnassigned;

            return (
              <CharacterGroup
                key={group.id}
                name={getGroupName(group, gameState.groupNames)}
                count={groupCharacters.length - (hiddenCount ?? 0)}
                hiddenCount={hiddenCount}
                Icon={group.Icon}
                onSettings={
                  isManageable ? () => setEditingGroupId(group.id) : undefined
                }
                reorder={
                  isManageable
                    ? {
                        isDragging: draggedGroupId === group.id,
                        isDropTarget:
                          dropTargetId === group.id &&
                          draggedGroupId !== group.id,
                        onDragStart: () => setDraggedGroupId(group.id),
                        onDragOver: () => setDropTargetId(group.id),
                        onDrop: () => handleGroupDrop(group.id),
                        onDragEnd: clearDrag,
                      }
                    : undefined
                }
              >
                {groupCharacters.length > 0 ? (
                  groupCharacters.map((character) => (
                    <CharacterItem
                      key={character.id}
                      character={character}
                      gameState={gameState}
                    />
                  ))
                ) : (
                  <Typography color="textSecondary">
                    No characters in this group
                  </Typography>
                )}
              </CharacterGroup>
            );
          },
        )}
      </Box>
      {editingGroup && (
        <GroupSettingsDialog
          group={editingGroup}
          characters={gameState.characters}
          groupNames={gameState.groupNames}
          onClose={() => setEditingGroupId(null)}
        />
      )}
    </Container>
  );
}
