import type { ReactNode } from "react";
import { IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopIcon from "@mui/icons-material/Stop";

/** Only the GM can control the scene, so the buttons are only shown to the GM */
export interface RoundControls {
  canGoPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
  onEnd: () => void;
}

interface RoundCounterProps {
  round: number;
  /** Group playing its turn, if any */
  activeGroup?: { name: string; icon?: ReactNode };
  controls?: RoundControls;
}

export function RoundCounter({
  round,
  activeGroup,
  controls,
}: RoundCounterProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 2 }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6">Round {round}</Typography>
        {activeGroup && (
          <>
            <Typography variant="h6">-</Typography>
            {activeGroup.icon}
            <Typography variant="h6">{activeGroup.name} turn</Typography>
          </>
        )}
      </Stack>
      {controls && (
        <Stack direction="row" spacing={1}>
          <IconButton
            aria-label="Previous turn"
            disabled={!controls.canGoPrevious}
            onClick={controls.onPrevious}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton aria-label="Next turn" onClick={controls.onNext}>
            <ChevronRightIcon />
          </IconButton>
          <IconButton aria-label="Reset rounds" onClick={controls.onReset}>
            <RestartAltIcon />
          </IconButton>
          <IconButton
            aria-label="End structured scene"
            onClick={controls.onEnd}
          >
            <StopIcon />
          </IconButton>
        </Stack>
      )}
    </Stack>
  );
}
