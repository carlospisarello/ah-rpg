export interface Character {
  id: string;
  name: string;
  visible: boolean;
  metadata: Record<string, unknown>;
}

export interface Player {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

export type CurrentPlayer = Player;

export interface GameState {
  currentPlayer: CurrentPlayer | null;
  players: Player[];
  characters: Character[];
  groupNames: GroupNames;
  /** Group ids from top to bottom, see sortGroups */
  groupOrder: number[];
  round: number;
  isGM: boolean;
}

/** Custom group names, by group id. Groups without an entry keep their default name. */
export type GroupNames = Record<number, string>;

export interface CounterData {
  limit: number;
  horrorLimit: number;
  damage: number;
  used: number[];
  counter: number;
  visible: boolean;
  wasVisible: boolean;
  /** "gm" or a player id */
  assignedTo: string;
  /** Index of the character's group card, see CHARACTER_GROUPS */
  group: number;
}
