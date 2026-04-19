import { createAuthClient } from "better-auth/react"

// No baseURL: defaults to same-origin, which is what we want. The Better-Auth
// handler is mounted at /api/auth on this app.
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession, getSession } = authClient
