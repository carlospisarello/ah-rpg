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
    customGroups: [],
    deletedGroups: [],
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
    let active = true;
    let generation = 0;
    let readyChanges = 0;
    let unsubscribeReady: (() => void) | undefined;
    let unsubscribeData: Array<() => void> = [];

    const clearDataSubscriptions = () => {
      unsubscribeData.forEach((unsubscribe) => unsubscribe());
      unsubscribeData = [];
    };

    const reportError = (err: unknown) => {
      console.error("Failed to initialize plugin:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize plugin",
      );
      setState("error");
    };

    const handleSceneReady = (isSceneReady: boolean) => {
      const currentGeneration = ++generation;
      clearDataSubscriptions();
      setState("loading");
      if (!isSceneReady) return;

      let loaded = false;
      let latestCharacters: GameState["characters"] | undefined;
      let latestPlayers: GameState["players"] | undefined;
      let latestMetadata:
        | Awaited<ReturnType<typeof OBR.scene.getMetadata>>
        | undefined;

      const initialize = async () => {
        try {
          // Keep changes received while the initial snapshot is loading.
          unsubscribeData.push(
            OBR.scene.items.onChange((items) => {
              if (!active || currentGeneration !== generation) return;
              const characters = filterCharacters(items);
              latestCharacters = characters;
              if (loaded) {
                setGameState((prev) => ({ ...prev, characters }));
              }
            }),
          );
          unsubscribeData.push(
            OBR.party.onChange((players) => {
              if (!active || currentGeneration !== generation) return;
              latestPlayers = players;
              if (loaded) setGameState((prev) => ({ ...prev, players }));
            }),
          );
          unsubscribeData.push(
            OBR.scene.onMetadataChange((metadata) => {
              if (!active || currentGeneration !== generation) return;
              latestMetadata = metadata;
              if (loaded) {
                setGameState((prev) => ({
                  ...prev,
                  groupNames: getGroupNames(metadata),
                  groupIcons: getGroupIcons(metadata),
                  scene: getScene(metadata),
                }));
              }
            }),
          );

          const initialState = await loadGameState();
          if (!active || currentGeneration !== generation) return;
          loaded = true;
          setGameState({
            ...initialState,
            characters: latestCharacters ?? initialState.characters,
            players: latestPlayers ?? initialState.players,
            ...(latestMetadata && {
              groupNames: getGroupNames(latestMetadata),
              groupIcons: getGroupIcons(latestMetadata),
              scene: getScene(latestMetadata),
            }),
          });
          setState("ready");
        } catch (err) {
          if (!active || currentGeneration !== generation) return;
          clearDataSubscriptions();
          reportError(err);
        }
      };

      void initialize();
    };

    OBR.onReady(() => {
      if (!active) return;
      try {
        unsubscribeReady = OBR.scene.onReadyChange((isSceneReady) => {
          readyChanges++;
          handleSceneReady(isSceneReady);
        });
        // A later readiness event takes precedence over the query's response.
        const changesAtQuery = readyChanges;
        void OBR.scene.isReady().then(
          (isSceneReady) => {
            if (active && readyChanges === changesAtQuery) {
              handleSceneReady(isSceneReady);
            }
          },
          (err: unknown) => {
            if (active && readyChanges === changesAtQuery) reportError(err);
          },
        );
      } catch (err) {
        if (active) reportError(err);
      }
    });

    return () => {
      active = false;
      generation++;
      unsubscribeReady?.();
      clearDataSubscriptions();
    };
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
      <Container sx={{ py: 4, minWidth: "500px" }}>
        <Alert severity="error">Error: {error}</Alert>
      </Container>
    );
  }

  return <CharacterList gameState={gameState} />;
}

export default App;
