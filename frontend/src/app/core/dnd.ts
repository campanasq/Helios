/** Datos de reglas D&D 5e (SRD) en español. */

export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export const ABILITIES: { key: Ability; label: string; short: string }[] = [
  { key: 'strength', label: 'Fuerza', short: 'FUE' },
  { key: 'dexterity', label: 'Destreza', short: 'DES' },
  { key: 'constitution', label: 'Constitución', short: 'CON' },
  { key: 'intelligence', label: 'Inteligencia', short: 'INT' },
  { key: 'wisdom', label: 'Sabiduría', short: 'SAB' },
  { key: 'charisma', label: 'Carisma', short: 'CAR' },
];

export const ABILITY_SHORT: Record<Ability, string> = Object.fromEntries(ABILITIES.map((a) => [a.key, a.short])) as Record<Ability, string>;

export type Skill =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics' | 'deception' | 'history'
  | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand' | 'stealth' | 'survival';

export const SKILLS: { key: Skill; label: string; ability: Ability }[] = [
  { key: 'acrobatics', label: 'Acrobacias', ability: 'dexterity' },
  { key: 'arcana', label: 'Arcanos', ability: 'intelligence' },
  { key: 'athletics', label: 'Atletismo', ability: 'strength' },
  { key: 'deception', label: 'Engaño', ability: 'charisma' },
  { key: 'history', label: 'Historia', ability: 'intelligence' },
  { key: 'performance', label: 'Interpretación', ability: 'charisma' },
  { key: 'intimidation', label: 'Intimidación', ability: 'charisma' },
  { key: 'investigation', label: 'Investigación', ability: 'intelligence' },
  { key: 'sleight_of_hand', label: 'Juego de manos', ability: 'dexterity' },
  { key: 'medicine', label: 'Medicina', ability: 'wisdom' },
  { key: 'nature', label: 'Naturaleza', ability: 'intelligence' },
  { key: 'perception', label: 'Percepción', ability: 'wisdom' },
  { key: 'insight', label: 'Perspicacia', ability: 'wisdom' },
  { key: 'persuasion', label: 'Persuasión', ability: 'charisma' },
  { key: 'religion', label: 'Religión', ability: 'intelligence' },
  { key: 'stealth', label: 'Sigilo', ability: 'dexterity' },
  { key: 'survival', label: 'Supervivencia', ability: 'wisdom' },
  { key: 'animal_handling', label: 'Trato con animales', ability: 'wisdom' },
];

export const RACES = ['Humano', 'Elfo', 'Enano', 'Mediano', 'Gnomo', 'Semielfo', 'Semiorco', 'Tiefling', 'Dracónido'];
export const CLASSES = ['Bárbaro', 'Bardo', 'Brujo', 'Clérigo', 'Druida', 'Explorador', 'Guerrero', 'Hechicero', 'Mago', 'Monje', 'Paladín', 'Pícaro'];
export const ALIGNMENTS = [
  'Legal bueno', 'Neutral bueno', 'Caótico bueno',
  'Legal neutral', 'Neutral', 'Caótico neutral',
  'Legal malvado', 'Neutral malvado', 'Caótico malvado',
];
export const BACKGROUNDS = ['Acólito', 'Artesano gremial', 'Artista', 'Charlatán', 'Criminal', 'Ermitaño', 'Erudito', 'Forastero', 'Héroe del pueblo', 'Huérfano', 'Marinero', 'Noble', 'Soldado'];

export type CoinKey = 'pp' | 'gp' | 'sp' | 'cp';

export const COINS: { key: CoinKey; label: string; name: string; rate: number }[] = [
  { key: 'pp', label: 'PPT', name: 'Platino', rate: 1000 },
  { key: 'gp', label: 'PO', name: 'Oro', rate: 100 },
  { key: 'sp', label: 'PP', name: 'Plata', rate: 10 },
  { key: 'cp', label: 'PC', name: 'Cobre', rate: 1 },
];

export function totalCopper(money?: Partial<Record<CoinKey, number>> | null): number {
  if (!money) return 0;
  return (Number(money.pp) || 0) * 1000
    + (Number(money.gp) || 0) * 100
    + (Number(money.sp) || 0) * 10
    + (Number(money.cp) || 0);
}

export function goldTotal(money?: Partial<Record<CoinKey, number>> | null): number {
  return Math.round(totalCopper(money)) / 100;
}

export function formatGold(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const modifier = (score: number) => Math.floor((Number(score) - 10) / 2);
export const proficiencyBonus = (level: number) => Math.ceil(Math.max(1, Number(level)) / 4) + 1;
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
