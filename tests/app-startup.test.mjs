import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

const mocks = {
  react: `
    export const useState = (initial) => globalThis.__appTest.useState(initial);
    export const useEffect = (effect) => globalThis.__appTest.useEffect(effect);
  `,
  "react/jsx-runtime": `
    export const jsx = (type, props) => ({ type, props });
    export const jsxs = jsx;
  `,
  "@mui/material": `
    export const Box = "Box", CircularProgress = "CircularProgress",
      Alert = "Alert", Container = "Container";
  `,
  "@owlbear-rodeo/sdk": `export default globalThis.__appTest.obr;`,
  "./components/CharacterList": `export const CharacterList = "CharacterList";`,
  "./hooks/useReassignOrphanedCharacters": `export const useReassignOrphanedCharacters = () => {};`,
  "./hooks/useAssignDefaultGroups": `export const useAssignDefaultGroups = () => {};`,
  "./utils/metadata": `
    export const getGroupNames = (metadata) => metadata.names || {};
    export const getGroupIcons = (metadata) => metadata.icons || {};
    export const getScene = (metadata) => metadata.scene || {};
  `,
};

const bundle = await build({
  entryPoints: ["src/App.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  plugins: [{
    name: "startup-mocks",
    setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, ({ path }) =>
        Object.hasOwn(mocks, path) ? { path, namespace: "mock" } : undefined,
      );
      plugin.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
        contents: mocks[path],
        loader: "js",
      }));
    },
  }],
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function harness({
  sceneReady = Promise.resolve(true),
  playerId = Promise.resolve("gm"),
  onReady = (callback) => callback(),
} = {}) {
  const listeners = { ready: new Set(), items: new Set(), party: new Set(), metadata: new Set() };
  const subscribe = (kind) => (callback) => {
    listeners[kind].add(callback);
    return () => listeners[kind].delete(callback);
  };
  const states = [];
  let effect;
  let index = 0;
  const obr = {
    onReady,
    player: {
      getId: () => playerId,
      getName: async () => "GM",
      getMetadata: async () => ({}),
      getRole: async () => "GM",
    },
    party: { getPlayers: async () => [], onChange: subscribe("party") },
    scene: {
      isReady: () => sceneReady,
      onReadyChange: subscribe("ready"),
      getMetadata: async () => ({}),
      onMetadataChange: subscribe("metadata"),
      items: { getItems: async () => [], onChange: subscribe("items") },
    },
  };
  globalThis.__appTest = {
    obr,
    useState(initial) {
      const current = index++;
      states[current] = initial;
      return [initial, (value) => {
        states[current] = typeof value === "function" ? value(states[current]) : value;
      }];
    },
    useEffect(callback) { effect = callback; },
  };
  return {
    states,
    listeners,
    obr,
    start: () => effect(),
    emit: (kind, value) => listeners[kind].forEach((callback) => callback(value)),
  };
}

async function start(options) {
  const h = harness(options);
  const { default: App } = await import(`${moduleUrl}#${Math.random()}`);
  App();
  return { ...h, cleanup: h.start() };
}

test("loads a scene that is already ready and cleans up subscriptions", async () => {
  const h = await start();
  await flush();
  assert.equal(h.states[0], "ready");
  assert.equal(h.states[2].currentPlayer.id, "gm");
  for (const listeners of Object.values(h.listeners)) assert.equal(listeners.size, 1);
  h.cleanup();
  for (const listeners of Object.values(h.listeners)) assert.equal(listeners.size, 0);
});

test("waits for a scene and reloads after a readiness transition", async () => {
  const h = await start({ sceneReady: Promise.resolve(false) });
  await flush();
  assert.equal(h.states[0], "loading");
  h.emit("ready", true);
  await flush();
  assert.equal(h.states[0], "ready");
  h.emit("ready", false);
  assert.equal(h.states[0], "loading");
  assert.equal(h.listeners.items.size, 0);
  h.emit("ready", true);
  await flush();
  assert.equal(h.states[0], "ready");
  assert.equal(h.listeners.items.size, 1);
  h.cleanup();
});

test("a readiness event wins over an older initial readiness query", async () => {
  const query = deferred();
  const h = await start({ sceneReady: query.promise });
  h.emit("ready", true);
  await flush();
  query.resolve(false);
  await flush();
  assert.equal(h.states[0], "ready");
  assert.equal(h.listeners.items.size, 1);
  h.cleanup();
});

test("updates state after initialization and ignores SDK readiness after unmount", async () => {
  const h = await start();
  await flush();
  h.emit("items", [{ id: "token", layer: "CHARACTER" }]);
  h.emit("party", [{ id: "player" }]);
  h.emit("metadata", { names: { 1: "Live" } });
  assert.equal(h.states[2].characters[0].id, "token");
  assert.equal(h.states[2].players[0].id, "player");
  assert.deepEqual(h.states[2].groupNames, { 1: "Live" });
  h.cleanup();

  let readyCallback;
  const unmounted = await start({ onReady: (callback) => { readyCallback = callback; } });
  unmounted.cleanup();
  readyCallback();
  assert.equal(unmounted.listeners.ready.size, 0);
  assert.equal(unmounted.states[0], "loading");
});

test("ignores an obsolete load and retains updates received during initialization", async () => {
  const firstPlayer = deferred();
  const h = await start({ playerId: firstPlayer.promise });
  await flush();
  h.emit("ready", false);
  h.obr.player.getId = async () => "new-gm";
  h.emit("ready", true);
  const characters = [{ id: "new", layer: "CHARACTER" }, { id: "ignored", layer: "MAP" }];
  h.emit("items", characters);
  h.emit("party", [{ id: "player" }]);
  h.emit("metadata", { names: { 1: "Updated" }, scene: { round: 2 } });
  await flush();
  firstPlayer.resolve("old-gm");
  await flush();
  assert.equal(h.states[0], "ready");
  assert.equal(h.states[2].currentPlayer.id, "new-gm");
  assert.deepEqual(h.states[2].characters, [characters[0]]);
  assert.deepEqual(h.states[2].players, [{ id: "player" }]);
  assert.deepEqual(h.states[2].groupNames, { 1: "Updated" });
  assert.deepEqual(h.states[2].scene, { round: 2 });
  h.cleanup();
});

test("reports initialization errors and cleans up data subscriptions", async () => {
  const failure = deferred();
  const h = await start({ playerId: failure.promise });
  await flush();
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    failure.reject(new Error("load failed"));
    await flush();
    assert.equal(h.states[0], "error");
    assert.equal(h.states[1], "load failed");
    assert.equal(h.listeners.items.size, 0);
    assert.equal(errors.length, 1);
  } finally {
    console.error = originalError;
    h.cleanup();
  }
});

test("reports a failed initial scene readiness query", async () => {
  const query = deferred();
  const h = await start({ sceneReady: query.promise });
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try {
    query.reject(new Error("readiness failed"));
    await flush();
    assert.equal(h.states[0], "error");
    assert.equal(h.states[1], "readiness failed");
    assert.equal(errors.length, 1);
  } finally {
    console.error = originalError;
    h.cleanup();
  }
});
