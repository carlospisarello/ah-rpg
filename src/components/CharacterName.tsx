import { IconButton, Stack, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { VisibleIcon } from "./icons/Visible";
import { InvisibleIcon } from "./icons/Invisible";
import type { CounterData } from "../types";
import { DamageIcon, DiceIcon, HorrorIcon } from "./CounterIcons";

interface CharacterNameProps {
  name: string;
  isGM: boolean;
  counterData: CounterData;
  isVisibilityButtonDisabled: boolean;
  isCharacterHidden: boolean;
  onToggleVisibility: () => void;
}

export function CharacterName({
  name,
  isGM,
  counterData,
  isVisibilityButtonDisabled,
  isCharacterHidden,
  onToggleVisibility,
}: CharacterNameProps) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      justifyContent="space-between"
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {isGM && (
          <IconButton
            size="small"
            onClick={onToggleVisibility}
            disabled={isVisibilityButtonDisabled}
          >
            {counterData.visible ? <VisibleIcon /> : <InvisibleIcon />}
          </IconButton>
        )}
        <Typography variant="h6">
          {name}
          {!isGM && isCharacterHidden && " (hidden)"}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <HorrorIcon />
        <Typography>{counterData.horrorLimit}</Typography>
        <DamageIcon />
        <Typography>{counterData.damage}</Typography>
        <DiceIcon />
        <Typography>{counterData.limit}</Typography>
      </Stack>
    </Stack>
  );
}
