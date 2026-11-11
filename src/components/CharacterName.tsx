import { Avatar, Box, ButtonBase, Stack, Typography } from "@mui/material";
import { VisibleIcon } from "./icons/Visible";
import { InvisibleIcon } from "./icons/Invisible";
import type { CounterData } from "../types";
import { DamageIcon, DiceIcon, HorrorIcon } from "./CounterIcons";

interface CharacterNameProps {
  name: string;
  itemText: string;
  imageUrl: string;
  isGM: boolean;
  counterData: CounterData;
  isVisibilityButtonDisabled: boolean;
  isCharacterHidden: boolean;
  onToggleVisibility: () => void;
  onCenterOnCharacter: () => void;
}

const avatarSx = { width: 40, height: 40, flexShrink: 0 };

export function CharacterName({
  name,
  itemText,
  imageUrl,
  isGM,
  counterData,
  isVisibilityButtonDisabled,
  isCharacterHidden,
  onToggleVisibility,
  onCenterOnCharacter,
}: CharacterNameProps) {
  const characterAvatar = (
    <Avatar
      alt={name}
      src={imageUrl}
      imgProps={{ className: "avatar-image" }}
      sx={{
        ...avatarSx,
        "& .avatar-image": {
          transition: "filter 0.15s",
          // Hidden characters are shown in greyscale and darkened
          filter: isCharacterHidden
            ? "grayscale(1) brightness(0.5)"
            : "none",
        },
      }}
    />
  );

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      justifyContent="space-between"
    >
      <Stack direction="row" spacing={1} alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
        {isGM ? (
          <ButtonBase
            onClick={onToggleVisibility}
            disabled={isVisibilityButtonDisabled}
            aria-label={isCharacterHidden ? "Show character" : "Hide character"}
            title={isCharacterHidden ? "Show character" : "Hide character"}
            sx={{
              ...avatarSx,
              position: "relative",
              borderRadius: "50%",
              "&:hover .avatar-image, &.Mui-focusVisible .avatar-image": {
                filter: isCharacterHidden
                  ? "grayscale(1) blur(2px) brightness(0.4)"
                  : "blur(2px) brightness(0.4)",
              },
              "&:hover .avatar-overlay, &.Mui-focusVisible .avatar-overlay": {
                opacity: 1,
              },
            }}
          >
            {characterAvatar}
            <Box
              className="avatar-overlay"
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isCharacterHidden ? 1 : 0,
                transition: "opacity 0.15s",
                pointerEvents: "none",
              }}
            >
              {isCharacterHidden ? <InvisibleIcon /> : <VisibleIcon />}
            </Box>
          </ButtonBase>
        ) : (
          characterAvatar
        )}

        <Stack direction="column">
          {/* Text added with the Text tool in the scene (empty by default) */}
          <Typography
            component="button"
            variant="h6"
            noWrap
            onClick={onCenterOnCharacter}
            disabled={!isGM && isCharacterHidden}
            sx={{
              minWidth: 0,
              maxWidth: "100%",
              p: 0,
              border: 0,
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              color: "text.primary",
            }}
            title={`${itemText || name}${!isGM && isCharacterHidden ? " (hidden)" : ""}`}
          >
            {itemText || name}
            {!isGM && isCharacterHidden && " (hidden)"}
          </Typography>
          {itemText && (
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ minWidth: 0 }}
              title={`${name}${!isGM && isCharacterHidden ? " (hidden)" : ""}`}
            >
              {name}
              {!isGM && isCharacterHidden && " (hidden)"}
            </Typography>
          )}
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
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
