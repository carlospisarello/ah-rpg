import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import type { Character, GroupIcons, GroupNames } from "../types";
import {
  getGroup,
  updateCounterData,
  updateGroupIcons,
  updateGroupNames,
} from "../utils/metadata";
import { deleteGroup } from "../utils/deleteGroup";
import {
  getAllGroups,
  GROUP_ICONS,
  UNASSIGNED_GROUP,
  getGroupIconKey,
  getGroupName,
} from "./CharacterGroup";
import type { CharacterGroupInfo } from "./CharacterGroup";

interface GroupSettingsDialogProps {
  group: CharacterGroupInfo;
  characters: Character[];
  groupNames: GroupNames;
  groupIcons: GroupIcons;
  customGroups: number[];
  deletedGroups: number[];
  onClose: () => void;
}

export function GroupSettingsDialog({
  group,
  characters,
  groupNames,
  groupIcons,
  customGroups,
  deletedGroups,
  onClose,
}: GroupSettingsDialogProps) {
  const initialName = getGroupName(group, groupNames);
  const initialMemberIds = characters
    .filter((character) => getGroup(character) === group.id)
    .map((character) => character.id);

  const initialIconKey = getGroupIconKey(group, groupIcons) ?? "";
  const [iconKey, setIconKey] = useState(initialIconKey);
  const [name, setName] = useState(initialName);
  const [memberIds, setMemberIds] = useState(initialMemberIds);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const hasNameChange = trimmedName !== initialName;
  const hasIconChange = iconKey !== initialIconKey;
  const hasMembershipChange =
    memberIds.length !== initialMemberIds.length ||
    memberIds.some((id) => !initialMemberIds.includes(id));
  const canAccept =
    (hasNameChange || hasIconChange || hasMembershipChange) &&
    trimmedName !== "";

  const handleAccept = async () => {
    const addedIds = memberIds.filter((id) => !initialMemberIds.includes(id));
    const removedIds = initialMemberIds.filter((id) => !memberIds.includes(id));

    try {
      if (hasNameChange) {
        await updateGroupNames({ ...groupNames, [group.id]: trimmedName });
      }
      if (hasIconChange) {
        await updateGroupIcons({ ...groupIcons, [group.id]: iconKey });
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

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGroup(group.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete group:", err);
      setDeleteError("Failed to delete group. Please try again.");
      setDeleting(false);
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
            <InputLabel id="group-icon-label">Icon</InputLabel>
            <Select
              labelId="group-icon-label"
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
                const currentGroup = getAllGroups(
                  customGroups,
                  deletedGroups,
                ).find((g) => g.id === getGroup(character));
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
        <Button
          color="error"
          onClick={() => setConfirmDelete(true)}
          sx={{ mr: "auto" }}
        >
          Delete group
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAccept}
          disabled={!canAccept}
        >
          Accept
        </Button>
      </DialogActions>
      <Dialog
        open={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        aria-labelledby="delete-group-title"
        aria-describedby="delete-group-description"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="delete-group-title">Delete group</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-group-description">
            Delete this group? This action can not be undone.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={handleDelete}
          >
            Accept
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
