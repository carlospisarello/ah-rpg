import { useState, type DragEvent } from "react";
import { Button, Container, Typography, Box } from "@mui/material";
import type { Character, GameState } from "../types";
import { CharacterItem } from "./CharacterItem";
import {
  getAllGroups,
  getCharacterGroups,
  getNextGroupId,
  CharacterGroup,
  UNASSIGNED_GROUP,
  getGroupIcon,
  getGroupName,
} from "./CharacterGroup";
import type { CharacterGroupInfo } from "./CharacterGroup";
import { StructuredSceneDialog } from "./StructuredSceneDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { RoundCounter } from "./RoundCounter";
import {
  canPlayerSeeCharacter,
  getAssignee,
  getGroup,
  isCharacterVisible,
  refillDice,
  updateScene,
} from "../utils/metadata";
import {
  canGoPrevious,
  endScene,
  moveGroupInScene,
  nextTurn,
  normalizeScene,
  previousTurn,
  resetRounds,
  startScene,
} from "../utils/structuredScene";
import type { DropZone, SceneChange } from "../utils/structuredScene";

interface CharacterListProps {
  gameState: GameState;
}

export function CharacterList({ gameState }: CharacterListProps) {
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    zone: DropZone;
    groupId: number | null;
  } | null>(null);
  const [isStartingScene, setIsStartingScene] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

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

  const editingGroup = getAllGroups(gameState.scene.customGroups).find(
    (group) => group.id === editingGroupId,
  );

  const scene = normalizeScene(gameState.scene);
  const groupById = (id: number) =>
    getCharacterGroups(scene.customGroups).find(
      (group) => group.id === id,
    ) as CharacterGroupInfo;

  const applyChange = async ({
    scene: nextScene,
    refillGroupIds,
  }: SceneChange) => {
    try {
      await Promise.all([
        updateScene(nextScene),
        refillDice(
          gameState.characters.filter((character) =>
            refillGroupIds.includes(getGroup(character)),
          ),
        ),
      ]);
    } catch (err) {
      console.error("Failed to update the structured scene:", err);
    }
  };

  const handleGroupDrop = (zone: DropZone, targetId: number | null) => {
    const movedId = draggedGroupId;
    clearDrag();
    if (movedId === null || movedId === targetId) return;
    return applyChange(moveGroupInScene(scene, movedId, zone, targetId));
  };

  function clearDrag() {
    setDraggedGroupId(null);
    setDropTarget(null);
  }

  const activeGroup =
    scene.active && scene.turnGroup !== null
      ? groupById(scene.turnGroup)
      : undefined;

  const renderGroup = (group: CharacterGroupInfo, zone: DropZone | null) => {
    const isUnassigned = group.id === UNASSIGNED_GROUP.id;
    const groupCharacters = sortedCharacters.filter(
      (character) => getGroup(character) === group.id,
    );
    // The unassigned group is only shown to the GM, and only when it has characters
    if (isUnassigned && (!gameState.isGM || groupCharacters.length === 0))
      return null;
    // The GM also sees empty groups, so that they can be filled
    if (groupCharacters.length === 0 && !gameState.isGM) return null;

    // The GM sees the hidden characters too, which aren't counted in the group's characters
    const hiddenCount = gameState.isGM
      ? groupCharacters.filter((character) => !isCharacterVisible(character))
          .length
      : undefined;

    // The unassigned group keeps its place at the bottom and can't be rearranged
    const isManageable = gameState.isGM && !isUnassigned && zone !== null;

    return (
      <CharacterGroup
        key={group.id}
        name={getGroupName(group, gameState.groupNames)}
        count={groupCharacters.length - (hiddenCount ?? 0)}
        hiddenCount={hiddenCount}
        Icon={getGroupIcon(group, gameState.groupIcons)}
        isActive={activeGroup?.id === group.id}
        onSettings={
          gameState.isGM && !isUnassigned
            ? () => setEditingGroupId(group.id)
            : undefined
        }
        reorder={
          isManageable
            ? {
                isDragging: draggedGroupId === group.id,
                isDropTarget:
                  dropTarget?.groupId === group.id &&
                  draggedGroupId !== group.id,
                onDragStart: () => setDraggedGroupId(group.id),
                onDragOver: () => setDropTarget({ zone, groupId: group.id }),
                onDrop: () => handleGroupDrop(zone, group.id),
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
  };

  // The zones accept groups dropped on empty space, which sends them to the end
  const zoneProps = (zone: DropZone) =>
    gameState.isGM
      ? {
          onDragOver: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            setDropTarget({ zone, groupId: null });
          },
          onDrop: () => handleGroupDrop(zone, null),
        }
      : {};
  const isZoneTarget = (zone: DropZone) =>
    draggedGroupId !== null &&
    dropTarget?.zone === zone &&
    dropTarget.groupId === null;

  return (
    <Container>
      <Box sx={{ py: 2 }}>
        {!scene.active && gameState.isGM && (
          <Button
            fullWidth
            variant="contained"
            sx={{ mb: 2 }}
            onClick={() => setIsStartingScene(true)}
          >
            Start structured scene
          </Button>
        )}
        {scene.active && (
          <Box
            {...zoneProps("round")}
            sx={{
              mb: 2,
              p: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              outline: isZoneTarget("round") ? "2px dashed" : "none",
            }}
          >
            <RoundCounter
              round={scene.round}
              activeGroup={
                activeGroup &&
                (() => {
                  const Icon = getGroupIcon(activeGroup, gameState.groupIcons);
                  return {
                    name: getGroupName(activeGroup, gameState.groupNames),
                    icon: Icon && <Icon />,
                  };
                })()
              }
              controls={
                gameState.isGM
                  ? {
                      canGoPrevious: canGoPrevious(scene),
                      onPrevious: () => applyChange(previousTurn(scene)),
                      onNext: () => applyChange(nextTurn(scene)),
                      onReset: () => applyChange(resetRounds(scene)),
                      onEnd: () => applyChange(endScene(scene)),
                    }
                  : undefined
              }
            />
            {scene.roundGroups.length === 0 && gameState.isGM && (
              <Typography color="textSecondary" sx={{ mb: 2 }}>
                Drag groups here to add them to the round
              </Typography>
            )}
            {scene.roundGroups.map((id) => renderGroup(groupById(id), "round"))}
          </Box>
        )}
        <Box
          {...zoneProps("outside")}
          sx={{ outline: isZoneTarget("outside") ? "2px dashed" : "none" }}
        >
          {scene.groupOrder.map((id) => renderGroup(groupById(id), "outside"))}
        </Box>
        {renderGroup(UNASSIGNED_GROUP, null)}
        {gameState.isGM && (
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setIsCreatingGroup(true)}
          >
            Create group
          </Button>
        )}
      </Box>
      {isCreatingGroup && (
        <CreateGroupDialog
          characters={gameState.characters}
          groupNames={gameState.groupNames}
          groupIcons={gameState.groupIcons}
          customGroups={scene.customGroups}
          nextGroupId={getNextGroupId(scene.customGroups)}
          scene={scene}
          onClose={() => setIsCreatingGroup(false)}
        />
      )}
      {isStartingScene && (
        <StructuredSceneDialog
          characters={gameState.characters}
          groupNames={gameState.groupNames}
          groupIcons={gameState.groupIcons}
          customGroups={scene.customGroups}
          onCancel={() => setIsStartingScene(false)}
          onAccept={(selectedIds) => {
            setIsStartingScene(false);
            applyChange(startScene(scene, selectedIds));
          }}
        />
      )}
      {editingGroup && (
        <GroupSettingsDialog
          group={editingGroup}
          characters={gameState.characters}
          groupNames={gameState.groupNames}
          groupIcons={gameState.groupIcons}
          customGroups={scene.customGroups}
          onClose={() => setEditingGroupId(null)}
        />
      )}
    </Container>
  );
}
