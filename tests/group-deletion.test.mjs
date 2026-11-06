import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

async function load(entry, mocks = {}) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    plugins: [{
      name: "test-mocks",
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
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}#${Math.random()}`);
}

const groupMock = `
  export const CHARACTER_GROUPS = [1, 2, 3, 4].map(id => ({ id }));
`;
const { normalizeScene, removeGroupFromScene, startScene, endScene } = await load(
  "src/utils/structuredScene.ts",
  { "../components/CharacterGroup": groupMock },
);
const scene = (changes = {}) => ({
  active: true,
  round: 3,
  turnGroup: 2,
  roundGroups: [1, 2, 3],
  groupOrder: [4, 6],
  customGroups: [6],
  deletedGroups: [],
  ...changes,
});

test("deleting an active group chooses the next or previous group without changing the round", () => {
  const middle = removeGroupFromScene(scene(), 2);
  assert.deepEqual(middle.roundGroups, [1, 3]);
  assert.equal(middle.turnGroup, 3);
  assert.equal(middle.round, 3);
  const last = removeGroupFromScene(scene({ turnGroup: 3 }), 3);
  assert.equal(last.turnGroup, 2);
  assert.deepEqual(last.roundGroups, [1, 2]);
});

test("deleting the only round group leaves an active, empty counter", () => {
  const result = removeGroupFromScene(scene({ turnGroup: 2, roundGroups: [2] }), 2);
  assert.equal(result.active, true);
  assert.equal(result.turnGroup, null);
  assert.deepEqual(result.roundGroups, []);
  assert.deepEqual(normalizeScene(result).roundGroups, []);
});

test("deleting inactive or outside groups preserves the active turn and persists across scene changes", () => {
  const deletedDefault = removeGroupFromScene(scene(), 1);
  assert.equal(deletedDefault.turnGroup, 2);
  assert.deepEqual(normalizeScene(deletedDefault).roundGroups, [2, 3]);
  assert.ok(!endScene(deletedDefault).scene.groupOrder.includes(1));
  assert.ok(!startScene(endScene(deletedDefault).scene, [1, 2]).scene.roundGroups.includes(1));
  const deletedCustom = removeGroupFromScene(scene(), 6);
  assert.equal(deletedCustom.turnGroup, 2);
  assert.deepEqual(deletedCustom.customGroups, []);
  assert.ok(!normalizeScene(deletedCustom).groupOrder.includes(6));
});

test("deleted default groups stay unavailable and deleted custom ids are not reused", async () => {
  const { getCharacterGroups, getAllGroups, getNextGroupId } = await load(
    "src/components/CharacterGroup.tsx",
    { "@owlbear-rodeo/sdk": "export default {};" },
  );
  assert.deepEqual(getCharacterGroups([6], [1, 8]).map((group) => group.id), [2, 3, 4, 6]);
  assert.deepEqual(getAllGroups([6], [1]).map((group) => group.id), [2, 3, 4, 6, 5]);
  assert.equal(getNextGroupId([6], [1, 8]), 9);
});

test("new characters go to unassigned if the default group was deleted", async () => {
  const updates = [];
  globalThis.__assignTest = {
    useEffect: (effect) => effect(),
    update: async (id, value) => { updates.push([id, value]); },
  };
  const { useAssignDefaultGroups } = await load("src/hooks/useAssignDefaultGroups.ts", {
    react: "export const useEffect = effect => globalThis.__assignTest.useEffect(effect);",
    "../utils/metadata": `
      export const DEFAULT_GROUP = 1, UNASSIGNED_GROUP_ID = 5;
      export const metadataKeys = { group: "group" };
      export const updateCounterData = (id, value) => globalThis.__assignTest.update(id, value);
    `,
  });
  const characters = [{ id: "new", metadata: {} }, { id: "existing", metadata: { group: 2 } }];
  useAssignDefaultGroups({ isGM: true, characters, scene: { deletedGroups: [1] } }, true);
  assert.deepEqual(updates, [["new", { group: 5 }]]);
});

test("deletion moves members to unassigned with GM ownership and persists scene and metadata", async () => {
  const keys = {
    group: "ah-rpg-dice/group",
    assignment: "ah-rpg-dice/assignment",
    deleted: "ah-rpg-dice/deleted-groups",
  };
  const metadata = {
    "ah-rpg-dice/structured-scene": true,
    "ah-rpg-dice/round": 3,
    "ah-rpg-dice/turn-group": 2,
    "ah-rpg-dice/round-groups": [1, 2, 3],
    "ah-rpg-dice/group-order": [4, 6],
    "ah-rpg-dice/custom-groups": [6],
    "ah-rpg-dice/group-names": { 2: "Old", 3: "Other" },
    "ah-rpg-dice/group-icons": { 2: "dice", 3: "clue" },
  };
  const items = [
    { id: "a", layer: "CHARACTER", metadata: { [keys.group]: 2, [keys.assignment]: "player" } },
    { id: "b", layer: "CHARACTER", metadata: { [keys.group]: 3 } },
    { id: "map", layer: "MAP", metadata: { [keys.group]: 2 } },
  ];
  let written;
  globalThis.__deleteTest = {
    scene: {
      getMetadata: async () => metadata,
      setMetadata: async (value) => { written = value; },
      items: {
        getItems: async () => items,
        updateItems: async (ids, update) => update(items.filter((item) => ids.includes(item.id))),
      },
    },
  };
  const { deleteGroup } = await load("src/utils/deleteGroup.ts", {
    "@owlbear-rodeo/sdk": "export default globalThis.__deleteTest;",
    "../components/CharacterGroup": groupMock,
  });
  await deleteGroup(2);
  assert.equal(items[0].metadata[keys.group], 5);
  assert.equal(items[0].metadata[keys.assignment], "gm");
  assert.equal(items[1].metadata[keys.group], 3);
  assert.equal(items[2].metadata[keys.group], 2);
  assert.deepEqual(written[keys.deleted], [2]);
  assert.equal(written["ah-rpg-dice/turn-group"], 3);
  assert.deepEqual(written["ah-rpg-dice/group-names"], { 3: "Other" });
  assert.deepEqual(written["ah-rpg-dice/group-icons"], { 3: "clue" });
  await assert.rejects(deleteGroup(5), /cannot be deleted/);
});

test("a failed character update does not persist deletion", async () => {
  let saved = false;
  globalThis.__deleteTest = {
    scene: {
      getMetadata: async () => ({}),
      setMetadata: async () => { saved = true; },
      items: {
        getItems: async () => [{ id: "a", layer: "CHARACTER", metadata: {} }],
        updateItems: async () => { throw new Error("update failed"); },
      },
    },
  };
  const { deleteGroup } = await load("src/utils/deleteGroup.ts", {
    "@owlbear-rodeo/sdk": "export default globalThis.__deleteTest;",
    "../components/CharacterGroup": groupMock,
  });
  await assert.rejects(deleteGroup(1), /update failed/);
  assert.equal(saved, false);
});

test("confirmation cancels without deleting and accept deletes only once", async () => {
  const states = [];
  let index = 0;
  let calls = 0;
  let closed = 0;
  let finishDelete;
  globalThis.__dialogTest = {
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = initial;
      return [states[current], (value) => { states[current] = value; }];
    },
    deleteGroup: () => {
      calls++;
      return new Promise((resolve) => { finishDelete = resolve; });
    },
  };
  const { GroupSettingsDialog } = await load("src/components/GroupSettingsDialog.tsx", {
    react: "export const useState = initial => globalThis.__dialogTest.useState(initial);",
    "react/jsx-runtime": `
      export const jsx = (type, props) => ({ type, props });
      export const jsxs = jsx;
      export const Fragment = "Fragment";
    `,
    "@mui/material": `
      export const Alert = "Alert", Button = "Button", Checkbox = "Checkbox",
      Dialog = "Dialog", DialogActions = "DialogActions", DialogContent = "DialogContent",
      DialogContentText = "DialogContentText", DialogTitle = "DialogTitle",
      FormControl = "FormControl", InputLabel = "InputLabel", ListItemText = "ListItemText",
      MenuItem = "MenuItem", Select = "Select", Stack = "Stack", TextField = "TextField";
    `,
    "../utils/deleteGroup": "export const deleteGroup = id => globalThis.__dialogTest.deleteGroup(id);",
    "../utils/metadata": `
      export const getGroup = () => 1;
      export const updateCounterData = async () => {};
      export const updateGroupIcons = async () => {};
      export const updateGroupNames = async () => {};
    `,
    "./CharacterGroup": `
      export const getAllGroups = () => [];
      export const GROUP_ICONS = {};
      export const UNASSIGNED_GROUP = { id: 5 };
      export const getGroupIconKey = () => "";
      export const getGroupName = () => "Group";
    `,
  });
  const props = {
    group: { id: 2 },
    characters: [],
    groupNames: {},
    groupIcons: {},
    customGroups: [],
    deletedGroups: [],
    onClose: () => { closed++; },
  };
  const render = () => { index = 0; return GroupSettingsDialog(props); };
  const descendants = (node) => {
    if (!node || typeof node !== "object") return [];
    const children = node.props?.children;
    return [node, ...(Array.isArray(children) ? children : [children]).flatMap(descendants)];
  };
  const buttons = (tree, label) => descendants(tree).filter(
    (node) => node.type === "Button" && node.props.children === label,
  );
  const dialogs = (tree) => descendants(tree).filter((node) => node.type === "Dialog");

  let tree = render();
  assert.equal(dialogs(tree)[1].props.open, false);
  buttons(tree, "Delete group")[0].props.onClick();
  tree = render();
  assert.equal(dialogs(tree)[1].props.open, true);
  assert.ok(descendants(tree).some((node) =>
    node.props?.children === "Delete this group? This action can not be undone.",
  ));
  buttons(tree, "Cancel")[1].props.onClick();
  assert.equal(dialogs(render())[1].props.open, false);
  assert.equal(calls, 0);
  assert.equal(closed, 0);

  buttons(render(), "Delete group")[0].props.onClick();
  const deleting = buttons(render(), "Accept")[1].props.onClick();
  tree = render();
  assert.equal(calls, 1);
  assert.equal(buttons(tree, "Accept")[1].props.disabled, true);
  assert.equal(buttons(tree, "Cancel")[1].props.disabled, true);
  finishDelete();
  await deleting;
  assert.equal(closed, 1);
});
