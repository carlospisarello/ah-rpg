import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

const mocks = {
  "@mui/material": `
    export const Alert = "Alert", Button = "Button", Checkbox = "Checkbox",
      Dialog = "Dialog", DialogActions = "DialogActions", DialogContent = "DialogContent",
      DialogContentText = "DialogContentText", DialogTitle = "DialogTitle",
      FormControl = "FormControl", InputLabel = "InputLabel", ListItemText = "ListItemText",
      MenuItem = "MenuItem", Select = "Select", Stack = "Stack", TextField = "TextField";
  `,
  "./CharacterGroup": `
    export const GROUP_ICONS = { clue: { label: "Clue", Icon: "Icon" } };
    export const UNASSIGNED_GROUP = { id: 5 };
    export const getAllGroups = () => [];
    export const getGroupName = (group, names) => names[group.id] ?? group.defaultName;
    export const getGroupIconKey = () => "clue";
  `,
  "../utils/metadata": `
    export const getGroup = () => 5;
    export const updateGroupNames = async value => globalThis.__groupNameTest.names.push(value);
    export const updateGroupIcons = async () => {};
    export const updateCounterData = async () => {};
    export const updateScene = async () => {};
  `,
  "../utils/structuredScene": `export const addGroupToScene = scene => scene;`,
  "../utils/deleteGroup": `export const deleteGroup = async () => {};`,
};

const bundle = await build({
  stdin: {
    contents: `
      export { createElement } from "react";
      export { create, act } from "react-test-renderer";
      export { CreateGroupDialog } from "./src/components/CreateGroupDialog";
      export { GroupSettingsDialog } from "./src/components/GroupSettingsDialog";
    `,
    resolveDir: process.cwd(),
    loader: "js",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  plugins: [{
    name: "group-form-mocks",
    setup(plugin) {
      plugin.onResolve({ filter: /^(react|react\/jsx-runtime|react-test-renderer|react-hook-form)$/ }, ({ path }) => ({
        path: pathToFileURL(require.resolve(path)).href,
        external: true,
      }));
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

const { createElement, create, act, CreateGroupDialog, GroupSettingsDialog } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const common = {
  characters: [],
  groupNames: {},
  groupIcons: {},
  customGroups: [],
  onClose: () => { globalThis.__groupNameTest.closed++; },
};

async function render(component, props) {
  globalThis.__groupNameTest = { names: [], closed: 0 };
  let renderer;
  await act(async () => { renderer = create(createElement(component, props)); });
  return renderer;
}

const field = (renderer) => renderer.root.findByType("TextField");
const accept = (renderer) => renderer.root.findAllByType("Button")
  .find((button) => button.props.children === "Accept" && button.props.variant === "contained");
const changeName = async (renderer, value) => {
  await act(async () => { field(renderer).props.onChange({ target: { name: "name", value } }); });
};
const submit = async (renderer) => {
  await act(async () => { await accept(renderer).props.onClick(); });
};

test("creation enforces required and 20-character group names before saving", async () => {
  const renderer = await render(CreateGroupDialog, {
    ...common, nextGroupId: 7, scene: { deletedGroups: [] },
  });
  assert.equal(field(renderer).props.inputProps.maxLength, 20);
  assert.equal(accept(renderer).props.disabled, true);

  await changeName(renderer, "   ");
  assert.equal(accept(renderer).props.disabled, true);
  assert.equal(field(renderer).props.helperText, "Group name is required.");
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, []);

  await changeName(renderer, "x".repeat(21));
  assert.equal(accept(renderer).props.disabled, true);
  assert.match(field(renderer).props.helperText, /at most 20/);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, []);

  await changeName(renderer, "x".repeat(20));
  assert.equal(accept(renderer).props.disabled, false);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, [{ 7: "x".repeat(20) }]);
  assert.equal(globalThis.__groupNameTest.closed, 1);
  renderer.unmount();
});

test("settings require legacy overlong names to be shortened and save trimmed names", async () => {
  const renderer = await render(GroupSettingsDialog, {
    ...common,
    group: { id: 2, defaultName: "Default" },
    groupNames: { 2: "x".repeat(21) },
    deletedGroups: [],
  });
  assert.equal(field(renderer).props.inputProps.maxLength, 20);
  assert.equal(accept(renderer).props.disabled, true);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, []);

  await changeName(renderer, "  New group  ");
  assert.equal(accept(renderer).props.disabled, false);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, [{ 2: "New group" }]);
  assert.equal(globalThis.__groupNameTest.closed, 1);
  renderer.unmount();
});

test("settings reject invalid edits and accept a name at the limit", async () => {
  const renderer = await render(GroupSettingsDialog, {
    ...common,
    group: { id: 2, defaultName: "Default" },
    groupNames: { 2: "Original", 3: "Other" },
    deletedGroups: [],
  });
  assert.equal(accept(renderer).props.disabled, true);

  await changeName(renderer, "  ");
  assert.equal(accept(renderer).props.disabled, true);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, []);

  await changeName(renderer, "x".repeat(21));
  assert.equal(accept(renderer).props.disabled, true);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, []);

  await changeName(renderer, "x".repeat(20));
  assert.equal(accept(renderer).props.disabled, false);
  await submit(renderer);
  assert.deepEqual(globalThis.__groupNameTest.names, [{ 2: "x".repeat(20), 3: "Other" }]);
  renderer.unmount();
});
