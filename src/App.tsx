import { useState, useEffect } from "react";
import { Box, CircularProgress, Alert, Container } from "@mui/material";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { CharacterList } from "./components/CharacterList";
import { useReassignOrphanedCharacters } from "./hooks/useReassignOrphanedCharacters";
import { useAssignDefaultGroups } from "./hooks/useAssignDefaultGroups";
import { getGroupIcons, getGroupNames, getScene } from "./utils/metadata";
import type { Character, GameState } from "./types";

type PluginState = "loading" | "ready" | "error";

const INITIAL_GAME_STATE: GameState = {
  currentPlayer: null,
  players: [],
  characters: [],
  groupNames: {},
  groupIcons: {},
  scene: {
    active: false,
    round: 1,
    turnGroup: null,
    roundGroups: [],
    groupOrder: [],
  },
  isGM: false,
};

const filterCharacters = (items: Item[]) =>
  items.filter((item) => item.layer === "CHARACTER") as Character[];

async function loadGameState(): Promise<GameState> {
  const id = await OBR.player.getId();
  const name = await OBR.player.getName();
  const metadata = await OBR.player.getMetadata();
  const players = await OBR.party.getPlayers();
  const isGM = (await OBR.player.getRole()) === "GM";
  const characters = filterCharacters(await OBR.scene.items.getItems());
  const sceneMetadata = await OBR.scene.getMetadata();

  return {
    currentPlayer: { id, name, metadata },
    players,
    characters,
    groupNames: getGroupNames(sceneMetadata),
    groupIcons: getGroupIcons(sceneMetadata),
    scene: getScene(sceneMetadata),
    isGM,
  };
}

function App() {
  const [state, setState] = useState<PluginState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);

  useEffect(() => {
    OBR.onReady(() => {
      OBR.scene.onReadyChange(async (isSceneReady) => {
        try {
          setState("loading");
          if (!isSceneReady) return;

          setGameState(await loadGameState());
          setState("ready");

          OBR.scene.items.onChange((items) => {
            setGameState((prev) => ({
              ...prev,
              characters: filterCharacters(items),
            }));
          });

          OBR.party.onChange((players) => {
            setGameState((prev) => ({ ...prev, players }));
          });

          OBR.scene.onMetadataChange((metadata) => {
            setGameState((prev) => ({
              ...prev,
              groupNames: getGroupNames(metadata),
              groupIcons: getGroupIcons(metadata),
              scene: getScene(metadata),
            }));
          });
        } catch (err) {
          console.error("Failed to initialize plugin:", err);
          setError(
            err instanceof Error ? err.message : "Failed to initialize plugin",
          );
          setState("error");
        }
      });
    });
  }, []);

  useReassignOrphanedCharacters(gameState, state === "ready");
  useAssignDefaultGroups(gameState, state === "ready");

  if (state === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Error: {error}</Alert>
      </Container>
    );
  }

  return <CharacterList gameState={gameState} />;
}

export default App;
