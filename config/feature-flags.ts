export const FEATURE_FLAGS = {
  search: true,
  liveChat: true,
  events: true,
  queueWorker: false,
  turnstile: true,
  mfa: true,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] === true
}
