import { createStore, useStore } from '@/store/create-store'

export interface UIState {
  mobileNavOpen: boolean
  notificationsOpen: boolean
}

export const uiStore = createStore<UIState>({
  mobileNavOpen: false,
  notificationsOpen: false,
})

export const uiActions = {
  openMobileNav: () => uiStore.setState({ mobileNavOpen: true }),
  closeMobileNav: () => uiStore.setState({ mobileNavOpen: false }),
  toggleNotifications: () =>
    uiStore.setState((prev) => ({
      notificationsOpen: !prev.notificationsOpen,
    })),
}

export function useMobileNavOpen(): boolean {
  return useStore(uiStore, (state) => state.mobileNavOpen)
}

export function useNotificationsOpen(): boolean {
  return useStore(uiStore, (state) => state.notificationsOpen)
}
