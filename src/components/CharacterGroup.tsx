import type { ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SettingsIcon from "@mui/icons-material/Settings";
import { ClueIcon } from "./icons/Clue";
import { DoomIcon } from "./icons/Doom";
import { GateIcon } from "./icons/Gate";
import { ReckoningIcon } from "./icons/Reckoning";
import type { GroupNames } from "../types";
import { UNASSIGNED_GROUP_ID } from "../utils/metadata";

export interface CharacterGroupInfo {
  id: number;
  defaultName: string;
  Icon?: typeof ClueIcon;
}

export const CHARACTER_GROUPS: CharacterGroupInfo[] = [
  { id: 1, defaultName: "Investigators", Icon: ClueIcon },
  { id: 2, defaultName: "Enemies", Icon: DoomIcon },
  { id: 3, defaultName: "Group 3", Icon: GateIcon },
  { id: 4, defaultName: "Group 4", Icon: ReckoningIcon },
];

/** Where the characters that leave their group go. Always shown last, and only to the GM. */
export const UNASSIGNED_GROUP: CharacterGroupInfo = {
  id: UNASSIGNED_GROUP_ID,
  defaultName: "Unassigned",
};

export const ALL_GROUPS: CharacterGroupInfo[] = [
  ...CHARACTER_GROUPS,
  UNASSIGNED_GROUP,
];

export const getGroupName = (
  group: CharacterGroupInfo,
  groupNames: GroupNames,
): string => groupNames[group.id]?.trim() || group.defaultName;

/** Groups from top to bottom. Groups missing from the saved order go last, in their default order. */
export const sortGroups = (groupOrder: number[]): CharacterGroupInfo[] => {
  const position = (group: CharacterGroupInfo) => {
    const index = groupOrder.indexOf(group.id);
    return index === -1 ? groupOrder.length + group.id : index;
  };
  return [...CHARACTER_GROUPS].sort((a, b) => position(a) - position(b));
};

/** Moves a group to the place of another one, the groups in between shift to make room */
export const moveGroup = (
  groupIds: number[],
  movedId: number,
  targetId: number,
): number[] => {
  const nextIds = groupIds.filter((id) => id !== movedId);
  nextIds.splice(groupIds.indexOf(targetId), 0, movedId);
  return nextIds;
};

export interface GroupReorderProps {
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

interface CharacterGroupProps {
  name: string;
  /** Number of characters shown in the group */
  count: number;
  /** Only the GM sees the characters hidden from the players */
  hiddenCount?: number;
  Icon: CharacterGroupInfo["Icon"];
  /** Only the GM can change the settings of a group */
  onSettings?: () => void;
  /** Only the GM can change the order of the groups */
  reorder?: GroupReorderProps;
  children: ReactNode;
}

export function CharacterGroup({
  name,
  count,
  hiddenCount,
  Icon,
  onSettings,
  reorder,
  children,
}: CharacterGroupProps) {
  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        mb: 2,
        opacity: reorder?.isDragging ? 0.5 : 1,
        outline: reorder?.isDropTarget ? "2px dashed" : "none",
      }}
      onDragOver={
        reorder
          ? (e) => {
              // Allows the drop, otherwise the browser doesn't fire it
              e.preventDefault();
              reorder.onDragOver();
            }
          : undefined
      }
      onDrop={reorder?.onDrop}
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
  );
}
