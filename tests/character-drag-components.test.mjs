import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const { build } = viteRequire("esbuild");

const mocks = {
  react: `
    export const useState = () => [globalThis.__characterDragData, () => {}];
    export const useEffect = () => {};
    export const useCallback = callback => callback;
  `,
  "react/jsx-runtime": `
    export const jsx = (type, props) => ({ type, props });
    export const jsxs = jsx;
  `,
  "@mui/material": `
    export const Accordion = "Accordion", AccordionSummary = "AccordionSummary",
      AccordionDetails = "AccordionDetails", Card = "Card", CardContent = "CardContent",
      CardHeader = "CardHeader", Button = "Button", IconButton = "IconButton",
      Select = "Select", MenuItem = "MenuItem", Typography = "Typography",
      ButtonGroup = "ButtonGroup", Stack = "Stack", Fab = "Fab", Box = "Box";
  `,
  "@mui/icons-material": `export const ExpandMore = "ExpandMore";`,
  "@owlbear-rodeo/sdk": `export default {};`,
  "../utils/metadata": `
    export const GM_ASSIGNEE = "gm", UNASSIGNED_GROUP_ID = 5;
    export const getCounterData = () => {};
    export const updateCounterData = async () => {};
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

async function load(entry) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    plugins: [{
      name: "component-mocks",
      setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, ({ path }) => {
          if (Object.hasOwn(mocks, path)) return { path, namespace: "mock" };
          if (path.startsWith("@mui/icons-material/")) return { path, namespace: "icon" };
          if (path.startsWith("./icons/")) return { path, namespace: "local-icon" };
        });
        plugin.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
          contents: mocks[path], loader: "js",
        }));
        plugin.onLoad({ filter: /.*/, namespace: "icon" }, () => ({
          contents: `export default "Icon";`, loader: "js",
        }));
        plugin.onLoad({ filter: /.*/, namespace: "local-icon" }, ({ path }) => ({
          contents: `export const ${path.split("/").at(-1)}Icon = "Icon";`, loader: "js",
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}#${Math.random()}`);
}

const { CharacterGroup } = await load("src/components/CharacterGroup.tsx");
const { CharacterItem } = await load("src/components/CharacterItem.tsx");

test("target groups use a dashed white border, or green for the active group", () => {
  for (const [isActive, isTarget, color, style] of [
    [false, true, "white", "dashed"],
    [true, true, "primary.main", "dashed"],
    [true, false, "primary.main", "solid"],
    [false, false, "transparent", "solid"],
  ]) {
    const handler = () => {};
    const tree = CharacterGroup({
      name: "Group", count: 0, isActive,
      characterDrop: { isTarget, onDragOver: handler, onDragLeave: handler, onDrop: handler },
      children: null,
    });
    const accordion = tree.props.children;
    assert.equal(accordion.props.sx.borderColor, color);
    assert.equal(accordion.props.sx.borderStyle, style);
    assert.equal(accordion.props.onDragOver, handler);
    assert.equal(accordion.props.onDrop, handler);
  }
});

test("character summary starts and ends its own drag without bubbling", () => {
  globalThis.__characterDragData = {
    limit: 1, horrorLimit: 0, damage: 0, used: [], visible: true,
    assignedTo: "gm", group: 1,
  };
  let started = 0, ended = 0;
  const tree = CharacterItem({
    character: { id: "c", name: "Character", visible: true },
    gameState: {
      isGM: true, players: [], currentPlayer: { id: "gm" },
      scene: { customGroups: [], deletedGroups: [] }, groupNames: {}, groupIcons: {},
    },
    drag: { isDragging: true, onDragStart: () => started++, onDragEnd: () => ended++ },
  });
  const accordion = tree.props.children;
  const summary = accordion.props.children[0];
  assert.equal(accordion.props.sx.opacity, 0.5);
  assert.equal(summary.props.draggable, true);
  const data = {};
  const event = {
    dataTransfer: { setData: (type, value) => { data[type] = value; } },
    stopPropagation() { this.stopped = true; },
  };
  summary.props.onDragStart(event);
  assert.equal(event.stopped, true);
  assert.equal(event.dataTransfer.effectAllowed, "move");
  assert.equal(data["text/plain"], "Character");
  assert.equal(started, 1);
  event.stopped = false;
  summary.props.onDragEnd(event);
  assert.equal(event.stopped, true);
  assert.equal(ended, 1);
});
