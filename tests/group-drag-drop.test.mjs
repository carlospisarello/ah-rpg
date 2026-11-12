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
    export const updateCounterData = async (id, updates) => { globalThis.__dragTest.charactersUpdated.push([id, updates]); };
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

test("moving a round group to the beginning outside advances the active turn", () => {
  const change = moveGroupInScene(scene(), 1, "outside", 0);
  assert.deepEqual(change.scene.roundGroups, [2]);
  assert.deepEqual(change.scene.groupOrder, [1, 3, 4]);
  assert.equal(change.scene.turnGroup, 2);
  assert.equal(change.scene.round, 3);
  assert.deepEqual(change.refillGroupIds, []);
  assert.deepEqual(normalizeScene(change.scene).groupOrder, [1, 3, 4]);
  const last = moveGroupInScene(scene({ roundGroups: [1] }), 1, "outside", 0);
  assert.equal(last.scene.turnGroup, null);
});

test("insertion positions work in both directions and across zones", () => {
  assert.deepEqual(moveGroupInScene(scene(), 1, "outside", 1).scene.groupOrder, [3, 1, 4]);
  assert.deepEqual(moveGroupInScene(scene(), 1, "outside", 2).scene.groupOrder, [3, 4, 1]);
  assert.deepEqual(moveGroupInScene(scene(), 3, "outside", 2).scene.groupOrder, [4, 3]);
  assert.deepEqual(moveGroupInScene(scene(), 4, "outside", 0).scene.groupOrder, [4, 3]);
  assert.deepEqual(moveGroupInScene(scene(), 1, "round", 2).scene.roundGroups, [2, 1]);
  assert.deepEqual(moveGroupInScene(scene(), 2, "round", 0).scene.roundGroups, [2, 1]);
  const entered = moveGroupInScene(scene(), 3, "round", 2);
  assert.deepEqual(entered.scene.roundGroups, [1, 2, 3]);
  assert.deepEqual(entered.refillGroupIds, [3]);
});

function descendants(node) {
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(descendants)];
}

function harness(isGM = true, sceneChanges = {}, characters = []) {
  const states = [];
  let index = 0;
  globalThis.__dragTest = {
    saved: [], refilled: [], charactersUpdated: [],
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = initial;
      return [states[current], value => { states[current] = value; }];
    },
  };
  const gameState = {
    currentPlayer: { id: "gm" }, isGM, characters, players: [],
    groupNames: {}, groupIcons: {}, scene: scene(sceneChanges),
  };
  return () => { index = 0; return CharacterList({ gameState }); };
}

const event = (sameTarget = true, clientY = 0, rectangles = []) => {
  const currentTarget = {
    querySelectorAll: () => rectangles.map(([top, height]) => ({
      getBoundingClientRect: () => ({ top, height }),
    })),
  };
  return {
    currentTarget, target: sameTarget ? currentTarget : {}, clientY,
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
};

const group = (tree, name) =>
  descendants(tree).find(node => node.type === "CharacterGroup" && node.props.name === name);
const zones = tree => {
  const outerStack = tree.props.children.props.children[0];
  return descendants(tree).filter(node => node.type === "Stack" && node.props.onDrop && node !== outerStack);
};
const lines = tree => descendants(tree).filter(node =>
  node.type === "Box" && node.props.sx?.backgroundColor === "white");
const outline = node => node.props.sx.outline;
const tick = () => new Promise(resolve => setImmediate(resolve));

test("the viewport background accepts a round group, but not child controls", async () => {
  const render = harness();
  let tree = render();
  group(tree, "One").props.reorder.onDragStart();
  tree = render();
  const outerStack = tree.props.children.props.children[0];
  for (const node of [tree, tree.props.children, outerStack]) {
    const childEvent = event(false);
    node.props.onDragOver(childEvent);
    assert.equal(childEvent.prevented, false);
    const over = event();
    node.props.onDragOver(over);
    assert.equal(over.prevented, true);
    assert.equal(over.stopped, true);
  }
  tree = render();
  assert.equal(outline(zones(tree)[1]), "2px dashed");
  assert.equal(lines(tree).length, 1);
  const drop = event();
  tree.props.onDrop(drop);
  await tick();
  assert.equal(drop.prevented, true);
  assert.deepEqual(globalThis.__dragTest.saved[0].groupOrder, [1, 3, 4]);
  assert.deepEqual(globalThis.__dragTest.refilled, [[]]);
  assert.equal(render().props.onDrop, undefined);
});

test("round and outside zones stop bubbling, and players cannot drag groups", () => {
  const render = harness();
  let tree = render();
  group(tree, "One").props.reorder.onDragStart();
  tree = render();
  const dropZones = zones(tree);
  assert.equal(dropZones.length, 2);
  for (const zone of dropZones) {
    const over = event(true, 20, [[0, 100], [116, 100]]);
    zone.props.onDragOver(over);
    assert.equal(over.prevented, true);
    assert.equal(over.stopped, true);
    const drop = event(true, 20, [[0, 100], [116, 100]]);
    zone.props.onDrop(drop);
    assert.equal(drop.stopped, true);
  }
  const playerTree = harness(false)();
  assert.equal(playerTree.props.onDrop, undefined);
});

test("group halves and gaps show the same position that is saved", async () => {
  for (const [y, expected, wrapperIndex, edge] of [
    [10, [1, 3, 4], 0, "before"],
    [80, [3, 1, 4], 1, "before"],
    [108, [3, 1, 4], 1, "before"],
    [190, [3, 4, 1], 1, "after"],
  ]) {
    const render = harness();
    group(render(), "One").props.reorder.onDragStart();
    let tree = render();
    let outside = zones(tree)[1];
    outside.props.onDragOver(event(true, y, [[0, 100], [116, 100]]));
    tree = render();
    outside = zones(tree)[1];
    assert.equal(outline(outside), "2px dashed");
    assert.equal(lines(tree).length, 1);
    const indicator = descendants(outside)
      .find(node => node.props?.children === lines(tree)[0]);
    assert.deepEqual(indicator.props.sx, { px: "8px", py: "8px", pointerEvents: "none" });
    const wrappers = descendants(outside).filter(node =>
      Array.isArray(node.props?.children) &&
      node.props.children.some(child => child?.props?.["data-drop-group"]));
    const children = wrappers[wrapperIndex].props.children;
    assert.equal(children[edge === "before" ? 0 : 2], indicator);
    outside.props.onDrop(event(true, y, [[0, 100], [116, 100]]));
    await tick();
    assert.deepEqual(globalThis.__dragTest.saved[0].groupOrder, expected);
  }
});

test("drag end clears both indicators without saving", async () => {
  const render = harness();
  group(render(), "One").props.reorder.onDragStart();
  let tree = render();
  zones(tree)[1].props.onDragOver(event(true, 80, [[0, 100], [116, 100]]));
  tree = render();
  assert.equal(lines(tree).length, 1);
  group(tree, "One").props.reorder.onDragEnd();
  tree = render();
  assert.equal(lines(tree).length, 0);
  assert.equal(descendants(tree).some(node => node.props?.sx?.outline === "2px dashed"), false);
  await tick();
  assert.equal(globalThis.__dragTest.saved.length, 0);
});

test("the position stays stable after the padded indicator shifts group bounds", async () => {
  for (const [y, before, after, expected] of [
    [40, [[0, 100], [116, 100]], [[18, 100], [134, 100]], [1, 3, 4]],
    [150, [[0, 100], [116, 100]], [[0, 100], [134, 100]], [3, 1, 4]],
    [190, [[0, 100], [116, 100]], [[0, 100], [116, 100]], [3, 4, 1]],
  ]) {
    const render = harness();
    group(render(), "One").props.reorder.onDragStart();
    let tree = render();
    zones(tree)[1].props.onDragOver(event(true, y, before));
    tree = render();
    zones(tree)[1].props.onDragOver(event(true, y, after));
    tree = render();
    assert.equal(lines(tree).length, 1);
    zones(tree)[1].props.onDrop(event(true, y, after));
    await tick();
    assert.deepEqual(globalThis.__dragTest.saved[0].groupOrder, expected);
  }
});

test("unchanged positions have an outline but no line or save", async () => {
  for (const y of [10, 80, 120]) {
    const render = harness();
    group(render(), "One").props.reorder.onDragStart();
    let tree = render();
    zones(tree)[0].props.onDragOver(event(true, y, [[0, 100], [116, 100]]));
    tree = render();
    assert.equal(outline(zones(tree)[0]), "2px dashed");
    assert.equal(lines(tree).length, 0);
    zones(tree)[0].props.onDrop(event(true, y, [[0, 100], [116, 100]]));
    await tick();
    assert.equal(globalThis.__dragTest.saved.length, 0);
  }
});

test("round header inserts first and refills the entering group's dice", async () => {
  const render = harness();
  group(render(), "3").props.reorder.onDragStart();
  let tree = render();
  zones(tree)[0].props.onDragOver(event(false, 10, [[50, 100], [166, 100]]));
  tree = render();
  assert.equal(lines(tree).length, 1);
  zones(tree)[0].props.onDrop(event(false, 10, [[50, 100], [166, 100]]));
  await tick();
  assert.deepEqual(globalThis.__dragTest.saved[0].roundGroups, [3, 1, 2]);
  assert.equal(globalThis.__dragTest.refilled.length, 1);
});

test("empty destinations have 8px vertical and horizontal padding", () => {
  for (const [changes, source, destination] of [
    [{ roundGroups: [1, 2, 3, 4], groupOrder: [] }, "One", 1],
    [{ roundGroups: [], groupOrder: [1, 2, 3, 4], turnGroup: null }, "One", 0],
  ]) {
    const render = harness(true, changes);
    group(render(), source).props.reorder.onDragStart();
    let tree = render();
    zones(tree)[destination].props.onDragOver(event());
    tree = render();
    const lineParent = descendants(tree).find(node => node.props?.children === lines(tree)[0]);
    assert.deepEqual(lineParent.props.sx, { px: "8px", py: "8px", pointerEvents: "none" });
  }
});

test("Unassigned is a fixed final target with a padded insertion line", async () => {
  const render = harness(true, { roundGroups: [1, 2, 3, 4], groupOrder: [] }, [{ group: 5 }]);
  group(render(), "One").props.reorder.onDragStart();
  let tree = render();
  zones(tree)[1].props.onDragOver(event(false, 90, [[0, 100]]));
  tree = render();
  assert.equal(lines(tree).length, 1);
  const lineParent = descendants(tree).find(node => node.props?.children === lines(tree)[0]);
  assert.deepEqual(lineParent.props.sx, { px: "8px", py: "8px", pointerEvents: "none" });
  zones(tree)[1].props.onDrop(event(false, 90, [[0, 100]]));
  await tick();
  assert.deepEqual(globalThis.__dragTest.saved[0].groupOrder, [1]);
});

test("character drops target groups without a positional indicator or reordering", async () => {
  const characters = [
    { id: "a", group: 1 },
    { id: "b", group: 2 },
    { id: "c", group: 2 },
  ];
  const render = harness(true, {}, characters);
  let tree = render();
  const character = descendants(tree).find(node => node.type === "CharacterItem" && node.props.character.id === "a");
  character.props.drag.onDragStart();
  tree = render();
  assert.ok(group(tree, "Unassigned"));
  assert.equal(zones(tree).length, 0);
  assert.equal(tree.props.onDrop, undefined);
  const over = event();
  group(tree, "Two").props.characterDrop.onDragOver(over);
  assert.equal(over.prevented, true);
  assert.equal(over.stopped, true);
  tree = render();
  assert.equal(group(tree, "Two").props.characterDrop.isTarget, true);
  assert.equal(group(tree, "One").props.characterDrop.isTarget, false);
  assert.equal(lines(tree).length, 0);
  const drop = event();
  group(tree, "Two").props.characterDrop.onDrop(drop);
  await tick();
  assert.equal(drop.prevented, true);
  assert.equal(drop.stopped, true);
  assert.deepEqual(globalThis.__dragTest.charactersUpdated, [["a", { group: 2 }]]);
  assert.deepEqual(globalThis.__dragTest.saved, []);
  assert.equal(group(render(), "Unassigned"), undefined);
});

test("dropping a character in its existing group does not write or reorder", async () => {
  const render = harness(true, {}, [{ id: "a", group: 1 }]);
  descendants(render()).find(node => node.type === "CharacterItem").props.drag.onDragStart();
  let tree = render();
  group(tree, "One").props.characterDrop.onDragOver(event());
  tree = render();
  assert.equal(group(tree, "One").props.characterDrop.isTarget, true);
  group(tree, "One").props.characterDrop.onDrop(event());
  await tick();
  assert.deepEqual(globalThis.__dragTest.charactersUpdated, []);
});

test("characters can be dropped on the temporarily visible Unassigned group", async () => {
  const render = harness(true, {}, [{ id: "a", group: 1 }]);
  descendants(render()).find(node => node.type === "CharacterItem").props.drag.onDragStart();
  const tree = render();
  group(tree, "Unassigned").props.characterDrop.onDrop(event());
  await tick();
  assert.deepEqual(globalThis.__dragTest.charactersUpdated, [["a", { group: 5 }]]);
});

test("players cannot drag characters or target groups", () => {
  const tree = harness(false, {}, [{ id: "a", group: 1 }])();
  assert.equal(descendants(tree).find(node => node.type === "CharacterItem").props.drag, undefined);
  assert.equal(group(tree, "One").props.characterDrop, undefined);
});
