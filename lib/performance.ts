export type WebVitalName = 'LCP' | 'CLS' | 'INP'

export interface WebVitalMetric {
  name: WebVitalName
  value: number
  delta?: number
  id?: string
}

export interface PerformanceBudget {
  lcpMs: number
  cls: number
  inpMs: number
}

export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200,
}

export function isWithinPerformanceBudget(
  metric: WebVitalMetric,
  budget: PerformanceBudget = DEFAULT_PERFORMANCE_BUDGET,
) {
  switch (metric.name) {
    case 'LCP':
      return metric.value < budget.lcpMs

    case 'CLS':
      return metric.value < budget.cls

    case 'INP':
      return metric.value < budget.inpMs

    default:
      return false
  }
}

export function createPerformanceReporter(
  onMetric: (metric: WebVitalMetric) => void,
) {
  return (metric: WebVitalMetric) => {
    onMetric(metric)
  }
}

export function observeLargestContentfulPaint(
  callback: (value: number) => void,
) {
  if (
    typeof window === 'undefined' ||
    typeof PerformanceObserver === 'undefined'
  ) {
    return () => undefined
  }

  if (
    !PerformanceObserver.supportedEntryTypes?.includes(
      'largest-contentful-paint',
    )
  ) {
    return () => undefined
  }

  let observer: PerformanceObserver | null = null

  try {
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      const latest = entries.at(-1)

      if (latest) {
        callback(latest.startTime)
      }
    })

    observer.observe({
      type: 'largest-contentful-paint',
      buffered: true,
    })
  } catch {
    return () => undefined
  }

  return () => {
    observer?.disconnect()
  }
}

export function observeCumulativeLayoutShift(
  callback: (value: number) => void,
) {
  if (
    typeof window === 'undefined' ||
    typeof PerformanceObserver === 'undefined'
  ) {
    return () => undefined
  }

  if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
    return () => undefined
  }

  let observer: PerformanceObserver | null = null
  let clsValue = 0

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          hadRecentInput?: boolean
          value?: number
        }

        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value ?? 0
        }
      }

      callback(clsValue)
    })

    observer.observe({
      type: 'layout-shift',
      buffered: true,
    })
  } catch {
    return () => undefined
  }

  return () => {
    observer?.disconnect()
  }
}

export function reserveAspectRatio(ratio: number | string) {
  return {
    aspectRatio: typeof ratio === 'number' ? ratio : ratio,
  }
}
