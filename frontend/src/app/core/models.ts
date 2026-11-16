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
