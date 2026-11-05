export const RENTAL_CATEGORY_IDS = [
  'rent',
  'operating_costs',
  'deposit',
  'cosmetic_repairs',
  'minor_repairs',
  'term_termination',
  'use_subletting',
  'pets',
  'alterations',
  'other',
] as const;

export const EMPLOYMENT_CATEGORY_IDS = [
  'probation',
  'working_time',
  'compensation',
  'vacation',
  'termination',
  'non_compete',
  'exclusion_periods',
  'repayment',
  'penalty',
  'side_jobs',
  'place_of_work',
  'other',
] as const;

export type RentalCategoryId = (typeof RENTAL_CATEGORY_IDS)[number];
export type EmploymentCategoryId = (typeof EMPLOYMENT_CATEGORY_IDS)[number];

export interface CategoryInfo {
  name: string;
  focus: string;
}

export const RENTAL_CATEGORIES: Record<RentalCategoryId, CategoryInfo> = {
  rent: {
    name: 'Miete und Mieterhöhung',
    focus: 'Staffel- oder Indexmiete richtig vereinbart? Mietpreisbremse',
  },
  operating_costs: {
    name: 'Nebenkosten',
    focus: 'nur umlagefähige Betriebskosten, klare Vereinbarung, Vorauszahlung realistisch',
  },
  deposit: {
    name: 'Kaution',
    focus: 'höchstens 3 Nettokaltmieten, Zahlung in Raten muss möglich sein',
  },
  cosmetic_repairs: {
    name: 'Schönheitsreparaturen',
    focus: 'starre Fristen, Endrenovierung unabhängig vom Zustand, unrenoviert übergebene Wohnung',
  },
  minor_repairs: {
    name: 'Kleinreparaturen',
    focus: 'Obergrenze pro Fall und pro Jahr nötig',
  },
  term_termination: {
    name: 'Laufzeit und Kündigung',
    focus: 'Kündigungsverzicht über 4 Jahre, abweichende Fristen, Befristung ohne Grund',
  },
  use_subletting: {
    name: 'Nutzung und Untervermietung',
    focus: 'pauschales Verbot von Untervermietung oder Besuch',
  },
  pets: {
    name: 'Tierhaltung',
    focus: 'generelles Verbot jeder Tierhaltung',
  },
  alterations: {
    name: 'Umbauten und Rückbau',
    focus: 'Rückbaupflichten, Zustimmungsvorbehalte',
  },
  other: {
    name: 'Sonstiges',
    focus: 'alles Übrige',
  },
};

export const EMPLOYMENT_CATEGORIES: Record<EmploymentCategoryId, CategoryInfo> = {
  probation: {
    name: 'Probezeit',
    focus: 'länger als 6 Monate, Kündigungsfrist in der Probezeit',
  },
  working_time: {
    name: 'Arbeitszeit und Überstunden',
    focus: 'Überstunden pauschal "mit dem Gehalt abgegolten" ohne Grenze',
  },
  compensation: {
    name: 'Vergütung und Bonus',
    focus: 'Freiwilligkeits- und Widerrufsvorbehalte, unklare Bonusregeln',
  },
  vacation: {
    name: 'Urlaub',
    focus: 'unter dem gesetzlichen Minimum (20 Tage bei 5-Tage-Woche), Verfallsregeln',
  },
  termination: {
    name: 'Kündigungsfristen',
    focus: 'längere Fristen nur für den Arbeitnehmer',
  },
  non_compete: {
    name: 'Wettbewerbsverbot',
    focus: 'nach Vertragsende ohne Entschädigung von mind. 50 % oder länger als 2 Jahre',
  },
  exclusion_periods: {
    name: 'Ausschlussfristen',
    focus: 'kürzer als 3 Monate, Mindestlohn nicht ausgenommen',
  },
  repayment: {
    name: 'Rückzahlungsklauseln',
    focus: 'Fortbildungskosten, zu lange Bindung, keine Staffelung',
  },
  penalty: {
    name: 'Vertragsstrafe',
    focus: 'in der Regel höher als ein Bruttomonatsgehalt',
  },
  side_jobs: {
    name: 'Nebentätigkeit',
    focus: 'generelles Verbot ohne berechtigtes Interesse',
  },
  place_of_work: {
    name: 'Arbeitsort und Versetzung',
    focus: 'weite Versetzungsklauseln, Homeoffice-Regeln',
  },
  other: {
    name: 'Sonstiges',
    focus: 'alles Übrige',
  },
};
