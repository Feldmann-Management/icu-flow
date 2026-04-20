import * as userRepo from "./user.repository"

/** Returns true if at least one user row exists on this instance. */
export async function hasAnyUser(): Promise<boolean> {
  return userRepo.existsAny()
}

/** First visitor becomes admin; after that, sign-ups are blocked. */
export async function isSignupClosed(): Promise<boolean> {
  return userRepo.existsAny()
}
