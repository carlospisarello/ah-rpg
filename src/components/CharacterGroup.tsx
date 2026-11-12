import type { DropZone } from "../utils/structuredScene";
import type { DragEvent, ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import { ClueIcon } from "./icons/Clue";
import { DamageIcon } from "./icons/Damage";
import { DiceIcon } from "./icons/Dice";
import { DoomIcon } from "./icons/Doom";
import { GateIcon } from "./icons/Gate";
import { HorrorIcon } from "./icons/Horror";
import { InvisibleIcon } from "./icons/Invisible";
import { ReckoningIcon } from "./icons/Reckoning";
import { ResetIcon } from "./icons/Reset";
import { VisibleIcon } from "./icons/Visible";
import type { GroupIcons, GroupNames } from "../types";
import { UNASSIGNED_GROUP_ID } from "../utils/metadata";

export interface CharacterGroupInfo {
  id: number;
  defaultName: string;
  Icon?: typeof ClueIcon;
}

/** Icons a group can use, by the key saved in the scene metadata */
export const GROUP_ICONS: Record<
  string,
  { label: string; Icon: typeof ClueIcon }
> = {
  clue: { label: "Clue", Icon: ClueIcon },
  damage: { label: "Damage", Icon: DamageIcon },
  dice: { label: "Dice", Icon: DiceIcon },
  doom: { label: "Doom", Icon: DoomIcon },
  gate: { label: "Gate", Icon: GateIcon },
  horror: { label: "Horror", Icon: HorrorIcon },
  invisible: { label: "Invisible", Icon: InvisibleIcon },
  reckoning: { label: "Reckoning", Icon: ReckoningIcon },
  reset: { label: "Reset", Icon: ResetIcon },
  visible: { label: "Visible", Icon: VisibleIcon },
};

export const CHARACTER_GROUPS: CharacterGroupInfo[] = [
  { id: 1, defaultName: "Investigators", Icon: ClueIcon },
  { id: 2, defaultName: "Enemies", Icon: DoomIcon },
];

/** Where the characters that leave their group go. Always shown last, and only to the GM. */
export const UNASSIGNED_GROUP: CharacterGroupInfo = {
  id: UNASSIGNED_GROUP_ID,
  defaultName: "Unassigned",
};

/** The default groups plus the ones created by the GM, in id order */
export const getCharacterGroups = (
  customGroups: number[],
  deletedGroups: number[] = [],
): CharacterGroupInfo[] => [
  ...CHARACTER_GROUPS.filter((group) => !deletedGroups.includes(group.id)),
  ...customGroups.map((id) => ({ id, defaultName: `Group ${id}` })),
];

/** Same as getCharacterGroups, plus the unassigned group at the end */
export const getAllGroups = (
  customGroups: number[],
  deletedGroups: number[] = [],
): CharacterGroupInfo[] => [
  ...getCharacterGroups(customGroups, deletedGroups),
  UNASSIGNED_GROUP,
];

/** The first id after every group in use, new groups never reuse an id */
export const getNextGroupId = (
  customGroups: number[],
  deletedGroups: number[] = [],
): number =>
  Math.max(UNASSIGNED_GROUP_ID, ...customGroups, ...deletedGroups) + 1;

/** Key of the group's icon: the custom one, or the key of its default icon */
export const getGroupIconKey = (
  group: CharacterGroupInfo,
  groupIcons: GroupIcons,
): string | undefined => {
  const custom = groupIcons[group.id];
  if (custom && GROUP_ICONS[custom]) return custom;
  return Object.keys(GROUP_ICONS).find(
    (key) => GROUP_ICONS[key].Icon === group.Icon,
  );
};

export const getGroupIcon = (
  group: CharacterGroupInfo,
  groupIcons: GroupIcons,
): CharacterGroupInfo["Icon"] => {
  const key = getGroupIconKey(group, groupIcons);
  return key ? GROUP_ICONS[key].Icon : undefined;
};

export const getGroupName = (
  group: CharacterGroupInfo,
  groupNames: GroupNames,
): string => groupNames[group.id]?.trim() || group.defaultName;

export interface GroupReorderProps {
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

interface CharacterGroupProps {
  name: string;
  /** Number of characters shown in the group */
  count: number;
  /** The current round number */
  round?: number;
  /** Only the GM sees the characters hidden from the players */
  hiddenCount?: number;
  Icon: CharacterGroupInfo["Icon"];
  /** Only the GM can change the settings of a group */
  onSettings?: () => void;
  /** Whether the group is playing its turn */
  isActive?: boolean;
  /** Only the GM can change the order of the groups */
  reorder?: GroupReorderProps;
  characterDrop?: {
    isTarget: boolean;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  children: ReactNode;
  zone?: DropZone | null;
}

export function CharacterGroup({
  name,
  count,
  hiddenCount,
  Icon,
  onSettings,
  isActive,
  reorder,
  characterDrop,
  children,
  zone,
}: CharacterGroupProps) {
  return (
    <Box>
      <Accordion
        defaultExpanded
        disableGutters={zone !== "round" && zone !== null}
        sx={{
          border: 2,
          borderStyle: characterDrop?.isTarget ? "dashed" : "solid",
          borderColor: isActive
            ? "primary.main"
            : characterDrop?.isTarget
              ? "white"
              : "transparent",
          opacity: reorder?.isDragging ? 0.5 : 1,
        }}
        onDragOver={characterDrop?.onDragOver}
        onDragLeave={characterDrop?.onDragLeave}
        onDrop={characterDrop?.onDrop}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          draggable={!!reorder}
          onDragStart={
            reorder
              ? (e) => {
                  // Firefox doesn't start the drag without some data
                  e.dataTransfer.setData("text/plain", name);
                  e.dataTransfer.effectAllowed = "move";
                  reorder.onDragStart();
                }
              : undefined
          }
          onDragEnd={reorder?.onDragEnd}
        >
          <Stack direction="row" spacing={1} alignItems="center" width="100%">
            {reorder && <DragIndicatorIcon sx={{ cursor: "grab" }} />}
            {Icon && <Icon />}
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {name} ({count}
              {!!hiddenCount && `, ${hiddenCount} hidden`})
            </Typography>
            {onSettings && (
              <IconButton
                size="small"
                aria-label="Group settings"
                // Keeps the click from toggling the accordion
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings();
                }}
              >
                <SettingsIcon />
              </IconButton>
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>{children}</Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
