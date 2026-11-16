export type Role = 'en_fila' | 'jugador' | 'dungeon_master';

export const ROLE_LABELS: Record<Role, string> = {
  en_fila: 'En Fila',
  jugador: 'Jugador',
  dungeon_master: 'Dungeon Master',
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_admin: boolean;
  is_superadmin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CharacterSheet {
  player_name: string;
  experience: number;
  inspiration: boolean;
  speed: number;
  initiative_bonus: number;
  hp_current: number;
  hp_temp: number;
  hit_dice: string;
  saving_throws: Record<string, boolean>;
  /** 0 = nada, 1 = competente, 2 = pericia */
  skills: Record<string, number>;
  death_saves: { successes: number; failures: number };
  money: Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>;
  attacks: { name: string; bonus: string; damage: string }[];
  proficiencies_languages: string;
  equipment: string;
  personality_traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  features_traits: string;
  age: string; height: string; weight: string; eyes: string; skin: string; hair: string;
  appearance: string;
  allies: string;
  additional_features: string;
  treasure: string;
  spellcasting: {
    class: string;
    ability: string;
    slots: { total: number; used: number }[];
    spells: { level: number; name: string; prepared: boolean }[];
  };
}

export interface Character {
  id: number;
  user_id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  alignment: string | null;
  background: string | null;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  hit_points: number;
  armor_class: number;
  backstory: string | null;
  avatar_url: string | null;
  sheet: CharacterSheet;
  updated_at: string;
  user?: { id: number; name: string; email?: string };
}

export type Difficulty = 'facil' | 'media' | 'dificil' | 'mortal';
export type MissionStatus = 'abierta' | 'en_curso' | 'completada';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil', media: 'Media', dificil: 'Difícil', mortal: 'Mortal',
};
export const STATUS_LABELS: Record<MissionStatus, string> = {
  abierta: 'Abierta', en_curso: 'En curso', completada: 'Completada',
};

export interface Mission {
  id: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  status: MissionStatus;
  min_level: number;
  reward: string | null;
  created_by: number;
  creator?: { id: number; name: string };
  created_at: string;
}

/** Datos públicos de un personaje para la Galería de héroes. */
export type GalleryCharacter = Pick<
  Character,
  | 'id' | 'user_id' | 'name' | 'race' | 'class' | 'level' | 'alignment' | 'background'
  | 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
  | 'hit_points' | 'armor_class' | 'avatar_url' | 'user'
>;
