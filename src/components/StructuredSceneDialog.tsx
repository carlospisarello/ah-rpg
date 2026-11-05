import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
} from "@mui/material";
import type { Character, GroupIcons, GroupNames } from "../types";
import { getGroup, isCharacterVisible } from "../utils/metadata";
import {
  getCharacterGroups,
  getGroupIcon,
  getGroupName,
} from "./CharacterGroup";

interface StructuredSceneDialogProps {
  characters: Character[];
  groupNames: GroupNames;
  groupIcons: GroupIcons;
  customGroups: number[];
  onAccept: (selectedIds: number[]) => void;
  onCancel: () => void;
}

export function StructuredSceneDialog({
  characters,
  groupNames,
  groupIcons,
  customGroups,
  onAccept,
  onCancel,
}: StructuredSceneDialogProps) {
  const groups = getCharacterGroups(customGroups);
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Start structured scene</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button
            size="small"
            onClick={() => setSelected(groups.map((g) => g.id))}
          >
            Select all
          </Button>
          <Button size="small" onClick={() => setSelected([])}>
            Deselect all
          </Button>
        </Stack>
        <FormGroup>
          {groups.map((group) => {
            const { id, defaultName } = group;
            const Icon = getGroupIcon(group, groupIcons);
            const groupCharacters = characters.filter(
              (character) => getGroup(character) === id,
            );
            const hiddenCount = groupCharacters.filter(
              (character) => !isCharacterVisible(character),
            ).length;
            return (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked={selected.includes(id)}
                    onChange={() => toggle(id)}
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {Icon && <Icon />}
                    <Typography>
                      {getGroupName({ id, defaultName }, groupNames)} (
                      {groupCharacters.length - hiddenCount}
                      {!!hiddenCount && `, ${hiddenCount} hidden`})
                    </Typography>
                  </Stack>
                }
              />
            );
          })}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0}
          onClick={() => onAccept(selected)}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
}
