import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

const mocks = {
  react: `export const useState = initial => globalThis.__dragTest.useState(initial);`,
  "react/jsx-runtime": `
    export const jsx = (type, props) => ({ type, props });
    export const jsxs = jsx;
  `,
  "@mui/material": `
    export const Button = "Button", Container = "Container", Typography = "Typography",
      Box = "Box", Stack = "Stack";
  `,
  "./CharacterItem": `export const CharacterItem = "CharacterItem";`,
  "./CharacterGroup": `
    export const CHARACTER_GROUPS = [{ id: 1, defaultName: "One" }, { id: 2, defaultName: "Two" }];
    export const UNASSIGNED_GROUP = { id: 5, defaultName: "Unassigned" };
    export const CharacterGroup = "CharacterGroup";
    export const getCharacterGroups = custom => [...CHARACTER_GROUPS, ...custom.map(id => ({ id, defaultName: String(id) }))];
    export const getAllGroups = custom => [...getCharacterGroups(custom), UNASSIGNED_GROUP];
    export const getNextGroupId = () => 6;
    export const getGroupIcon = () => undefined;
    export const getGroupName = group => group.defaultName;
  `,
  "./StructuredSceneDialog": `export const StructuredSceneDialog = "StructuredSceneDialog";`,
  "./CreateGroupDialog": `export const CreateGroupDialog = "CreateGroupDialog";`,
  "./GroupSettingsDialog": `export const GroupSettingsDialog = "GroupSettingsDialog";`,
  "./RoundCounter": `export const RoundCounter = "RoundCounter";`,
  "../utils/metadata": `
    export const canPlayerSeeCharacter = () => true, getAssignee = () => "gm",
      getGroup = character => character.group, isCharacterVisible = () => true;
    export const refillDice = async characters => { globalThis.__dragTest.refilled.push(characters); };
    export const updateScene = async scene => { globalThis.__dragTest.saved.push(scene); };
  `,
};
mocks["../components/CharacterGroup"] = mocks["./CharacterGroup"];

async function load(entry) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    plugins: [{
      name: "drag-mocks",
      setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, ({ path }) =>
          Object.hasOwn(mocks, path) ? { path, namespace: "mock" } : undefined,
        );
        plugin.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
          contents: mocks[path], loader: "js",
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}#${Math.random()}`);
}

const { moveGroupInScene, normalizeScene } = await load("src/utils/structuredScene.ts");
const { CharacterList } = await load("src/components/CharacterList.tsx");
const scene = (changes = {}) => ({
  active: true, round: 3, turnGroup: 1, roundGroups: [1, 2],
  groupOrder: [3, 4], customGroups: [3, 4], deletedGroups: [], ...changes,
});

test("dropping a round group on outside background places it first and advances the active turn", () => {
  const change = moveGroupInScene(scene(), 1, "outside", null);
  assert.deepEqual(change.scene.roundGroups, [2]);
  assert.deepEqual(change.scene.groupOrder, [1, 3, 4]);
  assert.equal(change.scene.turnGroup, 2);
  assert.equal(change.scene.round, 3);
  assert.deepEqual(change.refillGroupIds, []);
  assert.deepEqual(normalizeScene(change.scene).groupOrder, [1, 3, 4]);
  const last = moveGroupInScene(scene({ roundGroups: [1] }), 1, "outside", null);
  assert.equal(last.scene.turnGroup, null);
});

test("targeted drops and empty-space moves within each zone retain their ordering", () => {
  assert.deepEqual(moveGroupInScene(scene(), 1, "outside", 4).scene.groupOrder, [3, 1, 4]);
  assert.deepEqual(moveGroupInScene(scene(), 3, "outside", null).scene.groupOrder, [4, 3]);
  assert.deepEqual(moveGroupInScene(scene(), 1, "round", null).scene.roundGroups, [2, 1]);
  const entered = moveGroupInScene(scene(), 3, "round", null);
  assert.deepEqual(entered.scene.roundGroups, [1, 2, 3]);
  assert.deepEqual(entered.refillGroupIds, [3]);
});

function descendants(node) {
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(descendants)];
}

function harness(isGM = true) {
  const states = [];
  let index = 0;
  globalThis.__dragTest = {
    saved: [], refilled: [],
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = initial;
      return [states[current], value => { states[current] = value; }];
    },
  };
  const gameState = {
    currentPlayer: { id: "gm" }, isGM, characters: [], players: [],
    groupNames: {}, groupIcons: {}, scene: scene(),
  };
  return () => { index = 0; return CharacterList({ gameState }); };
}

const event = (sameTarget = true) => {
  const currentTarget = {};
  return {
    currentTarget, target: sameTarget ? currentTarget : {},
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
};

test("the viewport background accepts a round group, but not child controls", async () => {
  const render = harness();
  let tree = render();
  descendants(tree).find(node => node.type === "CharacterGroup" && node.props.name === "One")
    .props.reorder.onDragStart();
  tree = render();
  const outerStack = tree.props.children.props.children[0];
  for (const node of [tree, tree.props.children, outerStack]) {
    const childEvent = event(false);
    node.props.onDragOver(childEvent);
    assert.equal(childEvent.prevented, false);
    const over = event();
    node.props.onDragOver(over);
    assert.equal(over.prevented, true);
  }
  const drop = event();
  tree.props.onDrop(drop);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(drop.prevented, true);
  assert.deepEqual(globalThis.__dragTest.saved[0].groupOrder, [1, 3, 4]);
  assert.deepEqual(globalThis.__dragTest.refilled, [[]]);
  assert.equal(render().props.onDrop, undefined);
});

test("round and outside zones stop bubbling, and players cannot drag groups", () => {
  const render = harness();
  let tree = render();
  descendants(tree).find(node => node.type === "CharacterGroup" && node.props.name === "One")
    .props.reorder.onDragStart();
  tree = render();
  const outerStack = tree.props.children.props.children[0];
  const zones = descendants(tree).filter(node => node.type === "Stack" && node.props.onDrop && node !== outerStack);
  assert.equal(zones.length, 2);
  for (const zone of zones) {
    const over = event();
    zone.props.onDragOver(over);
    assert.equal(over.prevented, true);
    assert.equal(over.stopped, true);
    const drop = event();
    zone.props.onDrop(drop);
    assert.equal(drop.stopped, true);
  }
  const playerTree = harness(false)();
  assert.equal(playerTree.props.onDrop, undefined);
});
