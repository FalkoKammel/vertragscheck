export interface AddsBudget {
  add: (cost: number) => Promise<void>;
}
