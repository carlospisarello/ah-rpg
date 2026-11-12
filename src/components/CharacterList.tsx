import { useState, type DragEvent } from "react";
import { Button, Container, Typography, Box, Stack } from "@mui/material";
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
  updateCounterData,
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
  const [draggedCharacterId, setDraggedCharacterId] = useState<string | null>(
    null,
  );
  const [characterDropGroupId, setCharacterDropGroupId] = useState<number | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<{
    zone: DropZone;
    position: number;
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

  if (gameState.characters.length === 0 && !gameState.isGM) {
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

  const editingGroup = getAllGroups(
    gameState.scene.customGroups,
    gameState.scene.deletedGroups,
  ).find((group) => group.id === editingGroupId);

  const scene = normalizeScene(gameState.scene);
  const groupById = (id: number) =>
    getCharacterGroups(scene.customGroups, scene.deletedGroups).find(
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

  const isUnchangedPosition = (zone: DropZone, position: number) => {
    const groups = zone === "round" ? scene.roundGroups : scene.groupOrder;
    const oldIndex =
      draggedGroupId === null ? -1 : groups.indexOf(draggedGroupId);
    return (
      oldIndex !== -1 && (position === oldIndex || position === oldIndex + 1)
    );
  };

  const handleGroupDrop = (zone: DropZone, position: number) => {
    const movedId = draggedGroupId;
    const unchanged = isUnchangedPosition(zone, position);
    clearDrag();
    if (movedId === null || unchanged) return;
    return applyChange(moveGroupInScene(scene, movedId, zone, position));
  };

  function clearDrag() {
    setDraggedGroupId(null);
    setDraggedCharacterId(null);
    setDropTarget(null);
    setCharacterDropGroupId(null);
  }

  const handleCharacterDrop = async (groupId: number) => {
    const character = gameState.characters.find(
      (item) => item.id === draggedCharacterId,
    );
    clearDrag();
    if (!character || getGroup(character) === groupId) return;
    try {
      await updateCounterData(character.id, { group: groupId });
    } catch (error) {
      console.error("Failed to move the character to the group:", error);
    }
  };

  const activeGroup =
    scene.active && scene.turnGroup !== null
      ? groupById(scene.turnGroup)
      : undefined;

  const renderGroup = (group: CharacterGroupInfo, zone: DropZone | null) => {
    const isUnassigned = group.id === UNASSIGNED_GROUP.id;
    const groupCharacters = sortedCharacters.filter(
      (character) => getGroup(character) === group.id,
    );
    // The unassigned group is only shown to the GM
    if (
      isUnassigned &&
      (!gameState.isGM ||
        (groupCharacters.length === 0 && draggedCharacterId === null))
    )
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
        zone={zone}
        key={group.id}
        name={getGroupName(group, gameState.groupNames)}
        count={groupCharacters.length - (hiddenCount ?? 0)}
        hiddenCount={hiddenCount}
        Icon={getGroupIcon(group, gameState.groupIcons)}
        isActive={activeGroup?.id === group.id}
        characterDrop={
          gameState.isGM && draggedCharacterId !== null
            ? {
                isTarget: characterDropGroupId === group.id,
                onDragOver: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCharacterDropGroupId(group.id);
                },
                onDragLeave: (e) => {
                  if (
                    !(e.relatedTarget instanceof Node) ||
                    !e.currentTarget.contains(e.relatedTarget)
                  ) {
                    setCharacterDropGroupId(null);
                  }
                },
                onDrop: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleCharacterDrop(group.id);
                },
              }
            : undefined
        }
        onSettings={
          gameState.isGM && !isUnassigned
            ? () => setEditingGroupId(group.id)
            : undefined
        }
        reorder={
          isManageable
            ? {
                isDragging: draggedGroupId === group.id,
                onDragStart: () => setDraggedGroupId(group.id),
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
              drag={
                gameState.isGM
                  ? {
                      isDragging: draggedCharacterId === character.id,
                      onDragStart: () => setDraggedCharacterId(character.id),
                      onDragEnd: clearDrag,
                    }
                  : undefined
              }
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

  const getDropPosition = (e: DragEvent<HTMLElement>, zone: DropZone) => {
    const groups =
      e.currentTarget.querySelectorAll<HTMLElement>("[data-drop-group]");
    const maxPosition =
      zone === "round" ? scene.roundGroups.length : scene.groupOrder.length;
    for (let index = 0; index < groups.length; index++) {
      if (index >= maxPosition) return maxPosition;
      const bounds = groups[index].getBoundingClientRect();
      if (e.clientY < bounds.top + bounds.height / 2) return index;
    }
    return maxPosition;
  };

  const zoneProps = (zone: DropZone) =>
    gameState.isGM && draggedGroupId !== null
      ? {
          onDragOver: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setDropTarget({ zone, position: getDropPosition(e, zone) });
          },
          onDrop: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            e.stopPropagation();
            handleGroupDrop(zone, getDropPosition(e, zone));
          },
        }
      : {};
  const backgroundProps =
    gameState.isGM && draggedGroupId !== null
      ? {
          onDragOver: (e: DragEvent<HTMLElement>) => {
            if (
              e.target === e.currentTarget &&
              scene.roundGroups.includes(draggedGroupId)
            ) {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget({ zone: "outside", position: 0 });
            } else {
              setDropTarget(null);
            }
          },
          onDrop: (e: DragEvent<HTMLElement>) => {
            if (
              e.target !== e.currentTarget ||
              !scene.roundGroups.includes(draggedGroupId)
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            handleGroupDrop("outside", 0);
          },
        }
      : {};
  const isZoneTarget = (zone: DropZone) =>
    draggedGroupId !== null && dropTarget?.zone === zone;
  const showLine = (zone: DropZone, position: number) =>
    isZoneTarget(zone) &&
    dropTarget?.position === position &&
    !isUnchangedPosition(zone, position);
  const line = (
    <Box sx={{ px: "8px", py: "8px", pointerEvents: "none" }}>
      <Box sx={{ height: "2px", backgroundColor: "white" }} />
    </Box>
  );
  const renderDropGroups = (zone: DropZone) => {
    const ids = zone === "round" ? scene.roundGroups : scene.groupOrder;
    const groups = ids.map((id) => renderGroup(groupById(id), zone));
    if (zone === "outside") groups.push(renderGroup(UNASSIGNED_GROUP, null));
    const visibleGroups = groups.filter((group) => group !== null);
    if (visibleGroups.length === 0) {
      return showLine(zone, 0) ? line : null;
    }
    return visibleGroups.map((group, index) => (
      <Box key={group.key}>
        {showLine(zone, index) && line}
        <Box data-drop-group>{group}</Box>
        {index === visibleGroups.length - 1 &&
          showLine(zone, ids.length) &&
          index < ids.length &&
          line}
      </Box>
    ));
  };

  return (
    <Box
      {...backgroundProps}
      onDragLeave={(e) => {
        if (
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        ) {
          setDropTarget(null);
        }
      }}
      sx={{ minHeight: "100vh" }}
    >
      <Container {...backgroundProps} sx={{ minHeight: "100vh" }}>
        <Stack
          {...backgroundProps}
          spacing={2}
          py={2}
          sx={{ minHeight: "100vh" }}
        >
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
            <Stack
              {...zoneProps("round")}
              sx={{
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
                    const Icon = getGroupIcon(
                      activeGroup,
                      gameState.groupIcons,
                    );
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
              <Stack spacing={2}>
                {renderDropGroups("round")}
              </Stack>
            </Stack>
          )}
          <Stack
            spacing={2}
            {...zoneProps("outside")}
            sx={{ outline: isZoneTarget("outside") ? "2px dashed" : "none" }}
          >
            {renderDropGroups("outside")}
          </Stack>
          {gameState.isGM && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setIsCreatingGroup(true)}
            >
              Create group
            </Button>
          )}
        </Stack>
        {isCreatingGroup && (
          <CreateGroupDialog
            characters={gameState.characters}
            groupNames={gameState.groupNames}
            groupIcons={gameState.groupIcons}
            customGroups={scene.customGroups}
            nextGroupId={getNextGroupId(
              scene.customGroups,
              scene.deletedGroups,
            )}
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
            deletedGroups={scene.deletedGroups}
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
            deletedGroups={scene.deletedGroups}
            onClose={() => setEditingGroupId(null)}
          />
        )}
      </Container>
    </Box>
  );
}
