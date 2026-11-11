import { TextField } from "@mui/material";
import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";

export const GROUP_NAME_MAX_LENGTH = 20;

export interface GroupNameForm {
  name: string;
}

export function GroupNameField({
  control,
  autoFocus = false,
}: {
  control: Control<GroupNameForm>;
  autoFocus?: boolean;
}) {
  return (
    <Controller
      name="name"
      control={control}
      rules={{
        maxLength: {
          value: GROUP_NAME_MAX_LENGTH,
          message: `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters.`,
        },
        validate: (value) => value.trim() !== "" || "Group name is required.",
      }}
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <TextField
          {...field}
          inputRef={ref}
          label="Group name"
          inputProps={{ maxLength: GROUP_NAME_MAX_LENGTH }}
          error={Boolean(error)}
          helperText={error?.message ?? `Maximum ${GROUP_NAME_MAX_LENGTH} characters`}
          fullWidth
          autoFocus={autoFocus}
        />
      )}
    />
  );
}
