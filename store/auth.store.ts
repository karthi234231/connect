import { createStore, useStore } from '@/store/create-store'
import type { SessionUser } from '@/types/user'

export type AuthStatus = 'idle' | 'authenticated' | 'guest'

export interface AuthState {
  user: SessionUser | null
  status: AuthStatus
}

export const authStore = createStore<AuthState>({
  user: null,
  status: 'idle',
})

export const authActions = {
  setUser: (user: SessionUser | null) =>
    authStore.setState({
      user,
      status: user ? 'authenticated' : 'guest',
    }),
  setStatus: (status: AuthStatus) => authStore.setState({ status }),
}

export function useAuth(): AuthState {
  return useStore(authStore, (state) => state)
}
