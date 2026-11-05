import { IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface RoundCounterProps {
  round: number;
  /** Only the GM can change the round, so the buttons are only shown to the GM */
  onRoundChange?: (round: number) => void;
}

export function RoundCounter({ round, onRoundChange }: RoundCounterProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Typography variant="h6">Round {round}</Typography>
      {onRoundChange && (
        <Stack direction="row" spacing={1}>
          <IconButton
            aria-label="Previous round"
            disabled={round <= 1}
            onClick={() => onRoundChange(round - 1)}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            aria-label="Next round"
            onClick={() => onRoundChange(round + 1)}
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>
      )}
    </Stack>
  );
}
