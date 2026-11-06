import { DamageIcon as DamageIconSVG } from "./icons/Damage";
import { HorrorIcon as HorrorIconSVG } from "./icons/Horror";
import { DiceIcon as DiceIconSVG } from "./icons/Dice";

const ICON_SIZE = 20;

export function HorrorIcon() {
  return (
    <HorrorIconSVG sx={{ fontSize: ICON_SIZE, color: "secondary.light" }} />
  );
}

export function DamageIcon() {
  return <DamageIconSVG color="error" sx={{ fontSize: ICON_SIZE }} />;
}

export function DiceIcon() {
  return <DiceIconSVG sx={{ fontSize: ICON_SIZE, color: "primary.main" }} />;
}
