// Next generates no types for the `[locale]` root param yet ("No root params detected").
declare module 'next/root-params' {
  export function locale(): Promise<string | undefined>;
}
