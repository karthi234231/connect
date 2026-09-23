import { useEffect, useRef, useState } from 'react'

export interface UseInViewOptions extends IntersectionObserverInit {
  enabled?: boolean
}

export function useInView<T extends Element>(
  options: UseInViewOptions = {},
): readonly [React.RefObject<T | null>, boolean] {
  const { enabled = true, root, rootMargin, threshold } = options
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!enabled || !node) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { root, rootMargin, threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, root, rootMargin, threshold])

  return [ref, inView] as const
}
