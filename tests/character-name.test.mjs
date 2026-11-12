import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite/package.json"))("esbuild");
const mocks = {
  "react/jsx-runtime": `
    export const jsx = (type, props) => ({ type, props });
    export const jsxs = jsx;
  `,
  "@mui/material": `export const Avatar = "Avatar", Box = "Box", ButtonBase = "ButtonBase", Stack = "Stack", Typography = "Typography";`,
  "@mui/icons-material/Visibility": `export default "Visibility";`,
  "@mui/icons-material/VisibilityOff": `export default "VisibilityOff";`,
  "./icons/Visible": `export const VisibleIcon = "VisibleIcon";`,
  "./icons/Invisible": `export const InvisibleIcon = "InvisibleIcon";`,
  "./CounterIcons": `export const DamageIcon = "DamageIcon", DiceIcon = "DiceIcon", HorrorIcon = "HorrorIcon";`,
};
const bundle = await build({
  entryPoints: ["src/components/CharacterName.tsx"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  plugins: [{
    name: "character-name-mocks",
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
const { CharacterName } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("character names truncate within the available space without shrinking controls", () => {
  for (const isGM of [false, true]) {
    const name = "A very long character name that exceeds the available width";
    const tree = CharacterName({
      name, isGM, isCharacterHidden: true, isVisibilityButtonDisabled: false,
      counterData: { visible: true, horrorLimit: 1, damage: 2, limit: 3 },
      onToggleVisibility: () => {},
    });
    const [nameContainer, stats] = tree.props.children;
    const [visibility, labelContainer] = nameContainer.props.children;
    const label = labelContainer.props.children[0];
    assert.equal(nameContainer.props.sx.minWidth, 0);
    assert.equal(nameContainer.props.sx.flex, 1);
    assert.equal(label.props.noWrap, true);
    assert.equal(label.props.sx.minWidth, 0);
    assert.equal(label.props.title, `${name}${isGM ? "" : " (hidden)"}`);
    assert.equal(stats.props.sx.flexShrink, 0);
    if (isGM) assert.equal(visibility.props.sx.flexShrink, 0);
  }
});

test("avatar and name actions stop clicks from toggling the accordion", () => {
  let visibilityToggles = 0;
  let cameraCenters = 0;
  const tree = CharacterName({
    name: "Character", itemText: "", imageUrl: "", isGM: true,
    isCharacterHidden: false, isVisibilityButtonDisabled: false,
    counterData: { visible: true, horrorLimit: 0, damage: 0, limit: 1 },
    onToggleVisibility: () => visibilityToggles++,
    onCenterOnCharacter: () => cameraCenters++,
  });
  const [nameContainer] = tree.props.children;
  const [avatar, labelContainer] = nameContainer.props.children;
  const label = labelContainer.props.children[0];

  for (const control of [avatar, label]) {
    const event = { stopped: false, stopPropagation() { this.stopped = true; } };
    control.props.onClick(event);
    assert.equal(event.stopped, true);
  }
  assert.equal(visibilityToggles, 1);
  assert.equal(cameraCenters, 1);
});
