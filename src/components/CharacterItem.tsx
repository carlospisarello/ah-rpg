import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Select,
  MenuItem,
  Typography,
  ButtonGroup,
  Stack,
  Fab,
} from "@mui/material";
import { DiceIcon as DiceIconNative } from "./icons/Dice";
import CloseIcon from "@mui/icons-material/Close";
import { ResetIcon } from "./icons/Reset";
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

export function CharacterItem({ character, gameState }: CharacterItemProps) {
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

  // Damaged dice are counted from the right
  const isDamagedDie = (index: number) =>
    index >= counterData.limit - counterData.damage;

  // Horror dice are counted from the left
  const isHorrorDie = (index: number) => index < counterData.horrorLimit;

  const renderGroupIcon = (group: CharacterGroupInfo) => {
    const Icon = getGroupIcon(group, gameState.groupIcons);
    return Icon && <Icon />;
  };

  return (
    <Card
      variant="outlined"
      sx={{ borderColor: (theme) => theme.palette.primary.main }}
    >
      <CardHeader
        sx={{ paddingBottom: 0 }}
        title={
          <CharacterName
            name={character.name}
            isGM={isGM}
            counterData={counterData}
            onToggleVisibility={handleVisibility}
            // Disabled if both the counter and the item are invisible
            isVisibilityButtonDisabled={
              !character.visible && !counterData.visible
            }
            isCharacterHidden={!character.visible || !counterData.visible}
          />
        }
      />
      <CardContent
        sx={(theme) => ({ paddingBottom: `${theme.spacing(2)} !important` })}
      >
        <Stack spacing={2} justifyContent="center">
          {/* Control Buttons */}
          {canInteract && (
            <Stack direction="row" spacing={1} alignItems="center">
              <HorrorIcon />
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
                <Button
                  disabled={counterData.horrorLimit === 0}
                  onClick={handleHorrorLimitReset}
                >
                  <ResetIcon />
                </Button>
              </ButtonGroup>
              <DamageIcon />
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
                <Button
                  disabled={counterData.damage === 0}
                  onClick={handleDamageReset}
                >
                  <ResetIcon />
                </Button>
              </ButtonGroup>
              <DiceIcon />
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
          )}

          {/* Dice Display */}
          <Stack direction="row" justifyContent="space-between">
            {canInteract && (
              <Fab
                onClick={handleUsedReset}
                sx={FAB_SX}
                color="primary"
                disabled={counterData.used.length === 0}
              >
                <ResetIcon sx={DIE_ICON_SX} />
              </Fab>
            )}
            {Array.from({ length: counterData.limit }, (_, i) => {
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
      </CardContent>
    </Card>
  );
}
