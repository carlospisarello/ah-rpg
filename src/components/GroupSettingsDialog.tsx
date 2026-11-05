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
import type { Character, GroupNames } from "../types";
import {
  getGroup,
  updateCounterData,
  updateGroupNames,
} from "../utils/metadata";
import { ALL_GROUPS, UNASSIGNED_GROUP, getGroupName } from "./CharacterGroup";
import type { CharacterGroupInfo } from "./CharacterGroup";

interface GroupSettingsDialogProps {
  group: CharacterGroupInfo;
  characters: Character[];
  groupNames: GroupNames;
  onClose: () => void;
}

export function GroupSettingsDialog({
  group,
  characters,
  groupNames,
  onClose,
}: GroupSettingsDialogProps) {
  const initialName = getGroupName(group, groupNames);
  const initialMemberIds = characters
    .filter((character) => getGroup(character) === group.id)
    .map((character) => character.id);

  const [name, setName] = useState(initialName);
  const [memberIds, setMemberIds] = useState(initialMemberIds);

  const trimmedName = name.trim();
  const hasNameChange = trimmedName !== initialName;
  const hasMembershipChange =
    memberIds.length !== initialMemberIds.length ||
    memberIds.some((id) => !initialMemberIds.includes(id));
  const canAccept =
    (hasNameChange || hasMembershipChange) && trimmedName !== "";

  const handleAccept = async () => {
    const addedIds = memberIds.filter((id) => !initialMemberIds.includes(id));
    const removedIds = initialMemberIds.filter((id) => !memberIds.includes(id));

    try {
      if (hasNameChange) {
        await updateGroupNames({ ...groupNames, [group.id]: trimmedName });
      }
      await Promise.all([
        ...addedIds.map((id) => updateCounterData(id, { group: group.id })),
        ...removedIds.map((id) =>
          updateCounterData(id, { group: UNASSIGNED_GROUP.id }),
        ),
      ]);
      onClose();
    } catch (err) {
      console.error("Failed to save group settings:", err);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Group settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="group-characters-label">Characters</InputLabel>
            <Select
              labelId="group-characters-label"
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
                const currentGroup = ALL_GROUPS.find(
                  (g) => g.id === getGroup(character),
                );
                return (
                  <MenuItem key={character.id} value={character.id}>
                    <Checkbox checked={memberIds.includes(character.id)} />
                    <ListItemText
                      primary={character.name}
                      secondary={
                        currentGroup && currentGroup.id !== group.id
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
          disabled={!canAccept}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
}
