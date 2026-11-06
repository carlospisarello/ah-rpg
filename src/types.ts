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
  groupIcons: GroupIcons;
  scene: SceneState;
  isGM: boolean;
}

/** The structured scene, shared by every client in the scene */
export interface SceneState {
  /** Whether a structured scene is running, the round counter is only shown then */
  active: boolean;
  round: number;
  /** Group playing its turn, null when no group is in the round counter */
  turnGroup: number | null;
  /** Groups inside the round counter, in turn order */
  roundGroups: number[];
  /** Groups outside the round counter from top to bottom */
  groupOrder: number[];
  /** Ids of the groups created by the GM, besides the default ones */
  customGroups: number[];
  /** Deleted group ids, retained to prevent default groups and ids from being reused */
  deletedGroups: number[];
}

/** Custom group icon keys, by group id. Groups without an entry keep their default icon. */
export type GroupIcons = Record<number, string>;

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
  /** Group card id, including the Unassigned group */
  group: number;
}
