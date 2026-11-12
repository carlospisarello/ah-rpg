import { useState, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Select,
  MenuItem,
  Typography,
  ButtonGroup,
  Stack,
  Fab,
} from "@mui/material";
import OBR from "@owlbear-rodeo/sdk";
import { DiceIcon as DiceIconNative } from "./icons/Dice";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { ExpandMore } from "@mui/icons-material";
import type { Character, CounterData, GameState, Player } from "../types";
import {
  GM_ASSIGNEE,
  getCounterData,
  updateCounterData,
  canPlayerInteract,
  canPlayerSeeCharacter,
  withDamagedDiceUsed,
  withUnassignedOwner,
  UNASSIGNED_GROUP_ID,
} from "../utils/metadata";
import { CharacterName } from "./CharacterName";
import { DamageIcon, DiceIcon, HorrorIcon } from "./CounterIcons";
import { getAllGroups, getGroupIcon, getGroupName } from "./CharacterGroup";
import type { CharacterGroupInfo } from "./CharacterGroup";

interface CharacterItemProps {
  character: Character;
  gameState: GameState;
  drag?: {
    isDragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
  };
}

const FAB_SX = { width: 25, height: 25, minHeight: 25 };
const DIE_FAB_SX = { ...FAB_SX, borderRadius: "5px !important" };
const DIE_ICON_SX = { fontSize: 15 };

function getAssigneeLabel(
  assigneeId: string,
  currentPlayerId: string,
  players: Player[],
): string {
  if (assigneeId === currentPlayerId) return "you";
  if (assigneeId === GM_ASSIGNEE) return "GM";
  return players.find((p) => p.id === assigneeId)?.name || "Unknown";
}

export function CharacterItem({
  character,
  gameState,
  drag,
}: CharacterItemProps) {
  const [counterData, setCounterData] = useState<CounterData | null>(null);

  const { isGM, players } = gameState;
  const currentPlayerId = gameState.currentPlayer?.id || "";

  /** Persists the updates to the scene item and mirrors them in local state. */
  const applyUpdates = useCallback(
    async (updates: Partial<CounterData>) => {
      await updateCounterData(character.id, updates);
      setCounterData((prev) =>
        prev ? { ...prev, ...withUnassignedOwner(updates) } : prev,
      );
    },
    [character.id],
  );

  useEffect(() => {
    getCounterData(character).then(setCounterData);
  }, [character]);

  // Hide the counter when its item becomes invisible
  useEffect(() => {
    if (!counterData || character.visible || !counterData.visible) return;
    applyUpdates({ visible: false, wasVisible: true });
  }, [character.visible, counterData, applyUpdates]);

  if (!counterData) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  const canInteract = canPlayerInteract(
    isGM,
    currentPlayerId,
    counterData.assignedTo,
  );
  // Same check as CharacterList, so a group card is never rendered without a visible character
  if (!canPlayerSeeCharacter(character, isGM, currentPlayerId)) {
    return null;
  }

  const handleLimitIncrement = async () => {
    if (!canInteract) return;
    await updateCounterData(character.id, {
      limit: counterData.limit + 1,
    });
    setCounterData((prev) =>
      prev ? { ...prev, limit: prev.limit + 1 } : prev,
    );
  };

  const handleLimitDecrement = async () => {
    if (counterData.limit === 1 || !canInteract) return;
    const limit = Math.max(0, counterData.limit - 1);

    await applyUpdates({
      limit,
      // Horror limit and damage can't exceed the new limit
      horrorLimit: Math.min(counterData.horrorLimit, limit),
      damage: Math.min(counterData.damage, limit),
    });
  };

  const handleHorrorLimitIncrement = async () => {
    if (!canInteract || counterData.horrorLimit >= counterData.limit) return;
    await applyUpdates({ horrorLimit: counterData.horrorLimit + 1 });
  };

  const handleHorrorLimitDecrement = async () => {
    if (!canInteract || counterData.horrorLimit === 0) return;
    await applyUpdates({
      horrorLimit: Math.max(0, counterData.horrorLimit - 1),
    });
  };

  const handleHorrorLimitReset = async () => {
    if (!canInteract || counterData.horrorLimit === 0) return;
    await applyUpdates({ horrorLimit: 0 });
  };

  const handleDamageIncrement = async () => {
    if (!canInteract || counterData.damage >= counterData.limit) return;
    await applyUpdates({ damage: counterData.damage + 1 });
  };

  const handleDamageDecrement = async () => {
    if (!canInteract || counterData.damage === 0) return;
    await applyUpdates({
      damage: Math.max(0, counterData.damage - 1),
      used: withDamagedDiceUsed(counterData),
    });
  };

  const handleDamageReset = async () => {
    if (!canInteract || counterData.damage === 0) return;
    await applyUpdates({
      damage: 0,
      used: withDamagedDiceUsed(counterData),
    });
  };

  const handleAssignmentChange = (assignTo: string) =>
    applyUpdates({ assignedTo: assignTo });

  const handleGroupChange = (group: number) => applyUpdates({ group });

  const handleUsedToggle = async (index: number) => {
    if (!canInteract) return;
    await applyUpdates({
      used: counterData.used.includes(index)
        ? counterData.used.filter((i) => i !== index)
        : [...counterData.used, index],
    });
  };

  const handleUsedReset = async () => {
    if (!canInteract) return;
    await applyUpdates({ used: [] });
  };

  const handleVisibility = async () => {
    if (!canInteract) return;
    const visible = !counterData.visible;
    await applyUpdates({ visible, wasVisible: visible });
  };

  const handleCenterOnCharacter = async () => {
    try {
      const [bounds, scale, width, height] = await Promise.all([
        OBR.scene.items.getItemBounds([character.id]),
        OBR.viewport.getScale(),
        OBR.viewport.getWidth(),
        OBR.viewport.getHeight(),
      ]);
      await OBR.player.select([character.id], true);
      // The viewport position is the screen offset of the scene origin
      await OBR.viewport.animateTo({
        position: {
          x: width / 2 - bounds.center.x * scale,
          y: height / 2 - bounds.center.y * scale,
        },
        scale,
      });
    } catch (error) {
      console.error("Failed to center the character in the viewport:", error);
    }
  };

  // Damaged dice are counted from the right
  const isDamagedDie = (index: number) =>
    index >= counterData.limit - counterData.damage;

  // Horror dice are counted from the left
  const isHorrorDie = (index: number) => index < counterData.horrorLimit;

  const firstRowSize =
    counterData.limit >= 7
      ? Math.ceil(counterData.limit / 2)
      : counterData.limit;
  const diceRows =
    counterData.limit >= 7
      ? [firstRowSize, counterData.limit - firstRowSize]
      : [firstRowSize];

  const renderGroupIcon = (group: CharacterGroupInfo) => {
    const Icon = getGroupIcon(group, gameState.groupIcons);
    return Icon && <Icon />;
  };

  return (
    <div>
      <Accordion
        variant="outlined"
        sx={{ opacity: drag?.isDragging ? 0.5 : 1 }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore />}
          draggable={!!drag}
          onDragStart={
            drag
              ? (e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("text/plain", character.name);
                  e.dataTransfer.effectAllowed = "move";
                  drag.onDragStart();
                }
              : undefined
          }
          onDragEnd={
            drag
              ? (e) => {
                  e.stopPropagation();
                  drag.onDragEnd();
                }
              : undefined
          }
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ width: "100%", marginRight: 2 }}
          >
            {drag && <DragIndicatorIcon sx={{ cursor: "grab" }} />}
            <CharacterName
              name={character.name}
              itemText={character.itemText}
              imageUrl={character.imageUrl}
              isGM={isGM}
              counterData={counterData}
              onToggleVisibility={handleVisibility}
              // Disabled if both the counter and the item are invisible
              isVisibilityButtonDisabled={
                !character.visible && !counterData.visible
              }
              isCharacterHidden={!character.visible || !counterData.visible}
              onCenterOnCharacter={handleCenterOnCharacter}
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ paddingTop: 0 }}>
          <Stack spacing={2} justifyContent="center">
            {/* Control Buttons */}
            {canInteract && (
              <Stack
                direction="row"
                gap={1}
                alignItems="center"
                flexWrap={"wrap"}
              >
                <Stack direction="row" spacing={1} flexGrow={1}>
                  <IconButton
                    color="secondary"
                    onClick={handleHorrorLimitReset}
                    aria-label="Reset horror limit"
                    title="Reset horror limit"
                  >
                    <HorrorIcon />
                  </IconButton>
                  <ButtonGroup
                    size="small"
                    variant="contained"
                    fullWidth
                    color="secondary"
                  >
                    <Button
                      disabled={counterData.horrorLimit === 0}
                      onClick={handleHorrorLimitDecrement}
                    >
                      −
                    </Button>
                    <Button
                      disabled={counterData.horrorLimit >= counterData.limit}
                      onClick={handleHorrorLimitIncrement}
                    >
                      +
                    </Button>
                  </ButtonGroup>
                </Stack>
                <Stack direction="row" spacing={1} flexGrow={1}>
                  <IconButton
                    color="error"
                    onClick={handleDamageReset}
                    aria-label="Heal all damage"
                    title="Heal all damage"
                  >
                    <DamageIcon />
                  </IconButton>
                  <ButtonGroup
                    size="small"
                    variant="contained"
                    fullWidth
                    color="error"
                  >
                    <Button
                      disabled={counterData.damage === 0}
                      onClick={handleDamageDecrement}
                    >
                      −
                    </Button>
                    <Button
                      disabled={counterData.damage >= counterData.limit}
                      onClick={handleDamageIncrement}
                    >
                      +
                    </Button>
                  </ButtonGroup>
                </Stack>
                <Stack direction="row" spacing={1} flexGrow={1}>
                  <IconButton
                    onClick={handleUsedReset}
                    color="primary"
                    disabled={counterData.used.length === 0}
                    aria-label="Refill dice"
                    title="Refill dice"
                  >
                    <DiceIcon />
                  </IconButton>
                  <ButtonGroup
                    size="small"
                    variant="contained"
                    fullWidth
                    color="primary"
                  >
                    <Button
                      onClick={handleLimitDecrement}
                      disabled={counterData.limit <= 1}
                    >
                      −
                    </Button>
                    <Button onClick={handleLimitIncrement}>+</Button>
                  </ButtonGroup>
                </Stack>
              </Stack>
            )}

            {/* Dice Display */}
            <Stack spacing={2}>
              {diceRows.map((rowSize, rowIndex) => (
                <Stack
                  key={rowIndex}
                  direction="row"
                  justifyContent="space-evenly"
                >
                  {Array.from({ length: rowSize }, (_, columnIndex) => {
                    const i = rowIndex * firstRowSize + columnIndex;
                    const DieIcon =
                      isDamagedDie(i) || counterData.used.includes(i)
                        ? CloseIcon
                        : DiceIconNative;
                    return (
                      <Fab
                        key={i}
                        onClick={() => !isDamagedDie(i) && handleUsedToggle(i)}
                        sx={DIE_FAB_SX}
                        color={isDamagedDie(i) ? "error" : "primary"}
                      >
                        <DieIcon
                          sx={DIE_ICON_SX}
                          color={isHorrorDie(i) ? "secondary" : "inherit"}
                        />
                      </Fab>
                    );
                  })}
                </Stack>
              ))}
            </Stack>

            {/* Assignment Section */}
            {isGM && (
              <Select
                value={counterData.group}
                onChange={(e) => handleGroupChange(Number(e.target.value))}
                size="small"
              >
                {getAllGroups(
                  gameState.scene.customGroups,
                  gameState.scene.deletedGroups,
                ).map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {renderGroupIcon(group)}
                      <span>{getGroupName(group, gameState.groupNames)}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            )}
            {/* Unassigned characters always belong to the GM, so there's nothing to choose */}
            {isGM && counterData.group !== UNASSIGNED_GROUP_ID && (
              <Select
                value={counterData.assignedTo}
                onChange={(e) => handleAssignmentChange(e.target.value)}
                size="small"
              >
                <MenuItem value={GM_ASSIGNEE}>GM</MenuItem>
                {players.map((player) => (
                  <MenuItem key={player.id} value={player.id}>
                    {player.name}
                  </MenuItem>
                ))}
              </Select>
            )}
            {!isGM && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Assigned to:{" "}
                {getAssigneeLabel(
                  counterData.assignedTo,
                  currentPlayerId,
                  players,
                )}
              </Typography>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
