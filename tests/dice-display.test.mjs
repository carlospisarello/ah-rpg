import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

const mocks = {
  react: `
    export const useState = () => [globalThis.__diceTest.counterData, () => {}];
    export const useEffect = () => {};
    export const useCallback = callback => callback;
  `,
  "react/jsx-runtime": `
    export const jsx = (type, props, key) => ({ type, props, key });
    export const jsxs = jsx;
  `,
  "@mui/material": `
    export const Card = "Card", CardContent = "CardContent", CardHeader = "CardHeader",
      Button = "Button", IconButton = "IconButton", Select = "Select", MenuItem = "MenuItem",
      Typography = "Typography", ButtonGroup = "ButtonGroup", Stack = "Stack", Fab = "Fab";
  `,
  "./icons/Dice": `export const DiceIcon = "DiceIconNative";`,
  "@mui/icons-material/Close": `export default "CloseIcon";`,
  "./icons/Reset": `export const ResetIcon = "ResetIcon";`,
  "../utils/metadata": `
    export const GM_ASSIGNEE = "gm", UNASSIGNED_GROUP_ID = 5;
    export const getCounterData = () => {};
    export const updateCounterData = (id, updates) => globalThis.__diceTest.update(id, updates);
    export const canPlayerInteract = () => true;
    export const canPlayerSeeCharacter = () => true;
    export const withDamagedDiceUsed = () => [];
    export const withUnassignedOwner = updates => updates;
  `,
  "./CharacterName": `export const CharacterName = "CharacterName";`,
  "./CounterIcons": `export const DamageIcon = "DamageIcon", DiceIcon = "DiceIcon", HorrorIcon = "HorrorIcon";`,
  "./CharacterGroup": `
    export const getAllGroups = () => [];
    export const getGroupIcon = () => null;
    export const getGroupName = () => "";
  `,
};

const bundle = await build({
  entryPoints: ["src/components/CharacterItem.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  plugins: [{
    name: "dice-display-mocks",
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
const { CharacterItem } = await import(moduleUrl);

function renderDice(limit, changes = {}) {
  const updates = [];
  globalThis.__diceTest = {
    counterData: {
      limit, horrorLimit: 0, damage: 0, used: [], visible: true,
      assignedTo: "player", ...changes,
    },
    update: async (id, data) => updates.push([id, data]),
  };
  const tree = CharacterItem({
    character: { id: "character", visible: true },
    gameState: { isGM: false, players: [], currentPlayer: { id: "player" } },
  });
  const mainStack = tree.props.children[1].props.children;
  const diceStack = mainStack.props.children[1];
  return { tree, diceStack, rows: diceStack.props.children, updates };
}

test("dice stay in one row below seven and split evenly into two rows from seven", () => {
  for (const [limit, sizes] of [
    [1, [1]], [6, [6]], [7, [4, 3]], [8, [4, 4]],
    [9, [5, 4]], [13, [7, 6]],
  ]) {
    const { diceStack, rows } = renderDice(limit);
    assert.equal(diceStack.props.spacing, 2);
    assert.deepEqual(rows.map((row) => row.props.children.length), sizes);
    assert.ok(rows.every((row) =>
      row.props.direction === "row" && row.props.justifyContent === "space-around",
    ));
    assert.deepEqual(
      rows.flatMap((row) => row.props.children.map((die) => die.key)),
      Array.from({ length: limit }, (_, index) => index),
    );
  }
});

test("the card header allows the character name to shrink", () => {
  const { tree } = renderDice(1);
  assert.equal(tree.props.children[0].props.sx["& .MuiCardHeader-content"].minWidth, 0);
});

test("dice in both rows retain their original state and click indices", async () => {
  const { rows, updates } = renderDice(7, { horrorLimit: 5, damage: 1, used: [1] });
  const dice = rows.flatMap((row) => row.props.children);
  assert.equal(dice[1].props.children.type, "CloseIcon");
  assert.equal(dice[4].props.children.props.color, "secondary");
  assert.equal(dice[5].props.children.props.color, "inherit");
  assert.equal(dice[6].props.color, "error");
  assert.equal(dice[6].props.children.type, "CloseIcon");

  await dice[4].props.onClick();
  await dice[1].props.onClick();
  await dice[6].props.onClick();
  assert.deepEqual(updates, [
    ["character", { used: [1, 4] }],
    ["character", { used: [] }],
  ]);
});
