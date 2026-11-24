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
  gold_total?: number;
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

export interface CharacterImage {
  id: number;
  character_id: number;
  url: string;
  caption: string | null;
  show_in_gallery: boolean;
  sort_order: number;
}

export interface GalleryImage {
  id: number | 'avatar';
  url: string;
  caption: string | null;
}

export interface GalleryVisibility {
  avatar: boolean;
  name: boolean;
  race: boolean;
  class_level: boolean;
  alignment: boolean;
  background: boolean;
  vitals: boolean;
  stats: boolean;
  owner: boolean;
  backstory: boolean;
}

export const GALLERY_VISIBILITY_FIELDS: { key: keyof GalleryVisibility; label: string }[] = [
  { key: 'avatar', label: 'Retrato principal' },
  { key: 'name', label: 'Nombre' },
  { key: 'race', label: 'Raza' },
  { key: 'class_level', label: 'Clase y nivel' },
  { key: 'alignment', label: 'Alineamiento' },
  { key: 'background', label: 'Trasfondo' },
  { key: 'vitals', label: 'CA y PG máx.' },
  { key: 'stats', label: 'Características (FUE–CAR)' },
  { key: 'owner', label: 'Jugador / DM' },
  { key: 'backstory', label: 'Historia' },
];

export function defaultGalleryVisibility(isNpc = false): GalleryVisibility {
  return isNpc
    ? { avatar: true, name: true, race: true, class_level: false, alignment: false, background: false, vitals: false, stats: false, owner: false, backstory: false }
    : { avatar: true, name: true, race: true, class_level: true, alignment: true, background: true, vitals: true, stats: true, owner: true, backstory: false };
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
  is_dead: boolean;
  died_at: string | null;
  is_npc: boolean;
  gallery_visibility: GalleryVisibility;
  images?: CharacterImage[];
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

/** Datos públicos (filtrados por visibilidad) de un personaje para la Galería de personajes. */
export interface GalleryCharacter {
  id: number;
  user_id: number;
  name: string | null;
  avatar_url: string | null;
  gallery_images: GalleryImage[];
  is_dead: boolean;
  died_at: string | null;
  is_npc: boolean;
  gallery_visibility: GalleryVisibility;
  race: string | null;
  class: string | null;
  level: number | null;
  alignment: string | null;
  background: string | null;
  strength: number | null;
  dexterity: number | null;
  constitution: number | null;
  intelligence: number | null;
  wisdom: number | null;
  charisma: number | null;
  hit_points: number | null;
  armor_class: number | null;
  backstory: string | null;
  user?: { id: number; name: string } | null;
}

// ==================== Tienda y Mercaderes ====================

export type MerchantPose = 'idle' | 'talking' | 'explaining' | 'excited' | 'angry' | 'bored';
export type MerchantVoice = 'low' | 'medium' | 'high' | 'mystic';

export const MERCHANT_POSES: { key: MerchantPose; label: string }[] = [
  { key: 'idle', label: 'Reposo (IDLE)' },
  { key: 'talking', label: 'Hablando (TALKING)' },
  { key: 'explaining', label: 'Explicando (EXPLAINING)' },
  { key: 'excited', label: 'Emocionado (EXCITED)' },
  { key: 'angry', label: 'Enojado (ANGRY)' },
  { key: 'bored', label: 'Aburrido (BORED)' },
];

export const MERCHANT_VOICES: { key: MerchantVoice; label: string }[] = [
  { key: 'low', label: 'Grave / Gruñón' },
  { key: 'medium', label: 'Medio / Comerciante' },
  { key: 'high', label: 'Agudo / Pícaro' },
  { key: 'mystic', label: 'Misterioso / Arcano' },
];

export interface MerchantDialogue {
  pose: MerchantPose;
  text: string;
}

export interface ShopItem {
  id: number;
  merchant_id: number;
  name: string;
  description: string;
  price_gp: number;
  image_url: string | null;
  inspect_pose: MerchantPose;
  sold_at: string | null;
}

export interface Merchant {
  id: number;
  name: string;
  title: string | null;
  rotation_label: string | null;
  voice_pitch: MerchantVoice;
  is_active: boolean;
  greeting: string;
  purchase_line: string;
  no_gold_line: string;
  pose_urls: Record<MerchantPose, string | null>;
  dialogues: MerchantDialogue[];
  available_items?: ShopItem[];
  items?: ShopItem[];
}

export interface ShopBuyer {
  character_id: number;
  character_name: string;
  gp: number;
  gold_total: number;
}

export interface ShopResponse {
  merchant: Merchant | null;
  buyer: ShopBuyer | null;
}

export interface ShopPurchase {
  id: number;
  merchant_name: string;
  character_name: string;
  item_name: string;
  item_description: string | null;
  price_gp: number;
  purchased_at: string;
  user?: { id: number; name: string };
}
