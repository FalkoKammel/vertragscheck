export interface GeneratedToken {
  /** Plain token, handed to the client once. */
  token: string;
  /** SHA-256 hex of the token, the only form that is stored. */
  hash: string;
}

export interface GeneratesToken {
  generate(): GeneratedToken;
}
