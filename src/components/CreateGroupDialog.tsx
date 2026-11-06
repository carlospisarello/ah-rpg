import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import type { Character, GroupIcons, GroupNames, SceneState } from "../types";
import {
  getGroup,
  updateCounterData,
  updateGroupIcons,
  updateGroupNames,
  updateScene,
} from "../utils/metadata";
import { addGroupToScene } from "../utils/structuredScene";
import { GROUP_ICONS, getAllGroups, getGroupName } from "./CharacterGroup";

interface CreateGroupDialogProps {
  characters: Character[];
  groupNames: GroupNames;
  groupIcons: GroupIcons;
  customGroups: number[];
  nextGroupId: number;
  scene: SceneState;
  onClose: () => void;
}

export function CreateGroupDialog({
  characters,
  groupNames,
  groupIcons,
  customGroups,
  nextGroupId,
  scene,
  onClose,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState(Object.keys(GROUP_ICONS)[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const trimmedName = name.trim();
  const allGroups = getAllGroups(customGroups, scene.deletedGroups);

  const handleAccept = async () => {
    try {
      await updateGroupNames({ ...groupNames, [nextGroupId]: trimmedName });
      await updateGroupIcons({ ...groupIcons, [nextGroupId]: iconKey });
      await updateScene(addGroupToScene(scene, nextGroupId));
      await Promise.all(
        memberIds.map((id) => updateCounterData(id, { group: nextGroupId })),
      );
      onClose();
    } catch (err) {
      console.error("Failed to create the group:", err);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Create group</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <FormControl fullWidth>
            <InputLabel id="new-group-icon-label">Icon</InputLabel>
            <Select
              labelId="new-group-icon-label"
              label="Icon"
              value={iconKey}
              onChange={(e) => setIconKey(e.target.value)}
            >
              {Object.entries(GROUP_ICONS).map(([key, { label, Icon }]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Icon />
                    <span>{label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="new-group-characters-label">Characters</InputLabel>
            <Select
              labelId="new-group-characters-label"
              label="Characters"
              multiple
              value={memberIds}
              onChange={(e) =>
                setMemberIds(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value,
                )
              }
              renderValue={(selected) => `${selected.length} selected`}
            >
              {characters.map((character) => {
                const currentGroup = allGroups.find(
                  (g) => g.id === getGroup(character),
                );
                return (
                  <MenuItem key={character.id} value={character.id}>
                    <Checkbox checked={memberIds.includes(character.id)} />
                    <ListItemText
                      primary={character.name}
                      secondary={
                        currentGroup
                          ? getGroupName(currentGroup, groupNames)
                          : undefined
                      }
                    />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAccept}
          disabled={trimmedName === ""}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
}
