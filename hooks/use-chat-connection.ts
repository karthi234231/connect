'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComposerConnectionState } from '@/lib/chat/connection'
import { resolveComposerConnectionState } from '@/lib/chat/connection'
import {
  buildTypingEnvelope,
  isMessageEvent,
  isReactionEvent,
  isReceiptEvent,
  isTypingEvent,
  type MessagePayload,
  type ReactionPayload,
  type ReceiptPayload,
} from '@/lib/chat/realtime'
import {
  createAblyClient,
  type AblyRealtimeClient,
  type ConnectionState,
  type NetworkStatus,
} from '@/client/websocket/ably-client'
import { getAblyTokenAction, publishTypingAction } from '@/app/actions/chat'
import {
  createTypingController,
  DEFAULT_TYPING_TIMEOUT_MS,
  type TypingController,
} from '@/lib/chat/typing-controller'

const CHANNEL_PREFIX = 'match:'
const TYPING_EVENT = 'typing'
const REACTION_EVENT = 'reaction'
const MESSAGE_EVENT = 'message'
const RECEIPT_EVENT = 'receipt'

/**
 * Backoff for the full-handshake retry after the engine has exhausted its own
 * internal retry budget (Ably `closed`). Small, because re-hydrating the
 * engine (fresh token + subscriptions) is cheap; capped so an unauthenticated
 * thread cannot spin forever.
 */
const HANDSHAKE_BASE_DELAY_MS = 500
const HANDSHAKE_MAX_DELAY_MS = 30000

const TYPING_EXPIRY_MS = DEFAULT_TYPING_TIMEOUT_MS
/**
 * A small grace so a real-clock timeout firing a hair early still lands inside
 * the controller's `now - lastActivityAt >= timeoutMs` expiry window.
 */
const TYPING_EXPIRY_GRACE_MS = 50

/**
 * Outbound typing throttle (µ-04): publish at most one `true` per interval
 * while the composer keeps typing. A coalesced `true` still re-arms the
 * stop-window so the single trailing `false` is always flushed.
 */
const TYPING_PUBLISH_INTERVAL_MS = 1000

export interface ChatConnectionOptions {
  /** Local user id — used to ignore this client's own realtime echoes. */
  myId?: string
  /** Fired for every inbound peer reaction envelope (delivery accelerator). */
  onReaction?: (payload: ReactionPayload) => void
  /** Fired for every inbound peer message envelope (delivery accelerator). */
  onMessage?: (payload: MessagePayload) => void
  /** Fired for every inbound peer receipt envelope. */
  onReceipt?: (payload: ReceiptPayload) => void
  /** Fired when the channel returns to connected after a gap. */
  onReconnect?: () => void
}

export interface ChatRealtimeState {
  state: ComposerConnectionState
  /** True while the peer's typing presence is active (S032) and unexpired. */
  isPeerTyping: boolean
  /** Publish local user typing signal to the peer. */
  sendTyping?: (isTyping: boolean) => void
  /** Mirrors the engine's network status (online/offline). */
  networkOnline: boolean
}

interface InboundMessage {
  data?: unknown
}

export function useChatConnection(
  matchId: string,
  options?: ChatConnectionOptions,
): ChatRealtimeState {
  const [state, setState] = useState<ComposerConnectionState>('connecting')
  // Presence is per-conversation: state is tagged with the `matchId` it was
  // observed under so a stale flag from a previous thread can never leak into
  // the current one (the derived `isPeerTyping` ignores foreign tags).
  const [peerTyping, setPeerTyping] = useState<{
    matchId: string
    visible: boolean
  }>({ matchId, visible: false })
  const isPeerTyping = peerTyping.matchId === matchId ? peerTyping.visible : false
  const [networkOnline, setNetworkOnline] = useState(true)
  const optionsRef = useRef(options)
  /**
   * The live engine instance for the current `matchId`. Owned by the effect;
   * `sendTyping` reads it so it never re-initializes anything itself.
   */
  const engineRef = useRef<AblyRealtimeClient | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingAtRef = useRef(0)
  /** Wall-clock of the last actually-published `true` (throttle window start). */
  const lastTypingTrueAtRef = useRef(0)
  /**
   * True while a local typing presence start has been presented but its stop
   * has not yet flushed. Set on ANY `sendTyping(true)` (published or
   * coalesced); cleared the one time a `sendTyping(false)` actually publishes,
   * so a stop is never emitted more than once per typing burst.
   */
  const typingFlushArmedRef = useRef(false)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (isTyping) {
        // A `true` — even a throttled one — re-arms the stop-window so the
        // trailing `false` can always flush exactly once.
        typingFlushArmedRef.current = true
        const now = Date.now()
        if (now - lastTypingTrueAtRef.current < TYPING_PUBLISH_INTERVAL_MS) {
          return
        }
        lastTypingTrueAtRef.current = now
      } else if (!typingFlushArmedRef.current) {
        // No active typing burst → nothing to stop, and never emit `false`
        // more than once per stop.
        return
      } else {
        typingFlushArmedRef.current = false
      }

      const myId = optionsRef.current?.myId
      const engine = engineRef.current
      const fallback = () =>
        void publishTypingAction({ matchId, isTyping }).catch(() => undefined)

      // Prefer the realtime engine (no HTTP round-trip per keystroke). Without
      // a connected engine — or without a local identity to stamp the envelope
      // — fall back to the authoritative action, which resolves the actor
      // server-side. The action now returns `{ ok: false, error }` instead of
      // rejecting, so failure is fire-and-forget either way.
      if (!myId || !engine || engine.state !== 'connected') {
        fallback()
        return
      }

      void engine
        .publish(
          `${CHANNEL_PREFIX}${matchId}`,
          TYPING_EVENT,
          buildTypingEnvelope({
            eventId: `typing-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 7)}`,
            actorId: myId,
            conversationId: matchId,
            isTyping,
          }),
        )
        .catch(() => fallback())
    },
    [matchId],
  )

  useEffect(() => {
    let mounted = true
    let engine: AblyRealtimeClient | null = null
    let engineUnsubs: Array<() => void> = []
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    // Whether this engine instance has authenticated at least once (auth
    // callback resolved → `connected`). Before that we post as "no token" so
    // the resolver reports `connecting`, not `reconnecting`.
    let tokenResolved = false
    let wasEverConnected = false
    // True once a connective gap (drop or permanent closure) is in progress.
    let gapActive = false
    let closedRetries = 0

    const typing: TypingController = createTypingController({
      timeoutMs: TYPING_EXPIRY_MS,
    })

    function clearTypingTimer(): void {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
    }

    function armTypingExpiry(): void {
      clearTypingTimer()
      const elapsed = Date.now() - lastTypingAtRef.current
      const delay =
        Math.max(TYPING_EXPIRY_MS - elapsed, 0) + TYPING_EXPIRY_GRACE_MS
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null
        if (!mounted) return
        if (!typing.tick(Date.now())) {
          setPeerTyping({ matchId, visible: false })
        }
      }, delay)
    }

    function handleTyping(message: InboundMessage): void {
      const envelope = message.data
      if (!isTypingEvent(envelope)) return
      const myId = optionsRef.current?.myId
      if (myId && envelope.actorId === myId) return
      const now = Date.now()
      if (envelope.payload.isTyping) {
        lastTypingAtRef.current = now
        setPeerTyping({ matchId, visible: typing.update(true, now) })
        armTypingExpiry()
      } else {
        setPeerTyping({ matchId, visible: typing.update(false, now) })
        clearTypingTimer()
      }
    }

    function handleMessage(message: InboundMessage): void {
      const envelope = message.data
      if (!isMessageEvent(envelope)) return
      const myId = optionsRef.current?.myId
      if (myId && envelope.actorId === myId) return
      // A peer message ends any in-flight typing presence.
      setPeerTyping({ matchId, visible: typing.update(false, Date.now()) })
      clearTypingTimer()
      optionsRef.current?.onMessage?.(envelope.payload)
    }

    function handleReaction(message: InboundMessage): void {
      const envelope = message.data
      if (!isReactionEvent(envelope)) return
      const myId = optionsRef.current?.myId
      if (myId && envelope.actorId === myId) return
      optionsRef.current?.onReaction?.(envelope.payload)
    }

    function handleReceipt(message: InboundMessage): void {
      const envelope = message.data
      if (!isReceiptEvent(envelope)) return
      const myId = optionsRef.current?.myId
      if (myId && envelope.actorId === myId) return
      optionsRef.current?.onReceipt?.(envelope.payload)
    }

    function handleStatus(status: {
      connectionState: ConnectionState
      networkStatus: NetworkStatus
    }): void {
      if (!mounted) return
      setNetworkOnline(status.networkStatus === 'online')

      if (status.connectionState === 'closed') {
        // The engine exhausted its internal retry budget. Reset the handshake
        // posture and retry the whole thing with backoff rather than idling at
        // `connecting` forever.
        tokenResolved = false
        gapActive = true
        setState(
          resolveComposerConnectionState({ hasToken: false, isConnected: false }),
        )
        scheduleHandshakeRetry()
        return
      }

      if (status.connectionState === 'connected') {
        const recovering = gapActive && wasEverConnected
        tokenResolved = true
        wasEverConnected = true
        gapActive = false
        setState(
          resolveComposerConnectionState({ hasToken: true, isConnected: true }),
        )
        if (recovering) optionsRef.current?.onReconnect?.()
        return
      }

      // connecting / reconnecting / idle / offline — channel down.
      if (wasEverConnected) gapActive = true
      setState(
        resolveComposerConnectionState({
          hasToken: tokenResolved,
          isConnected: false,
        }),
      )
    }

    function teardownEngine(): void {
      for (const unsub of engineUnsubs) unsub()
      engineUnsubs = []
      if (engine) {
        engine.close()
        engine = null
      }
      engineRef.current = null
    }

    function scheduleHandshakeRetry(): void {
      if (retryTimer) return
      const delay = Math.min(
        HANDSHAKE_MAX_DELAY_MS,
        HANDSHAKE_BASE_DELAY_MS * 2 ** Math.min(closedRetries, 6),
      )
      closedRetries += 1
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (mounted) mountEngine()
      }, delay)
    }

    function mountEngine(): void {
      if (!mounted) return
      teardownEngine()
      const next = createAblyClient({
        // Renew the ~60s token automatically: Ably drives this callback on
        // expiry (and it seeds the very first connection when no token is
        // passed).
        authCallback: () =>
          getAblyTokenAction({ matchId }).then((result) => result.token),
      })
      engine = next
      engineRef.current = next
      engineUnsubs.push(next.onStatusChange(handleStatus))
      engineUnsubs.push(
        next.subscribe(`${CHANNEL_PREFIX}${matchId}`, TYPING_EVENT, handleTyping),
        next.subscribe(
          `${CHANNEL_PREFIX}${matchId}`,
          REACTION_EVENT,
          handleReaction,
        ),
        next.subscribe(
          `${CHANNEL_PREFIX}${matchId}`,
          MESSAGE_EVENT,
          handleMessage,
        ),
        next.subscribe(
          `${CHANNEL_PREFIX}${matchId}`,
          RECEIPT_EVENT,
          handleReceipt,
        ),
      )
    }

    // Fresh mount (incl. a matchId change): typing presence is per-conversation.
    typing.reset()
    clearTypingTimer()
    lastTypingAtRef.current = 0
    lastTypingTrueAtRef.current = 0
    typingFlushArmedRef.current = false
    mountEngine()

    return () => {
      mounted = false
      clearTypingTimer()
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      teardownEngine()
      typing.reset()
    }
  }, [matchId])

  return { state, isPeerTyping, sendTyping, networkOnline }
}