'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Realtime } from 'ably'
import type { ComposerConnectionState } from '@/components/chat'
import { resolveComposerConnectionState } from '@/lib/chat/connection'
import {
  isReactionEvent,
  isTypingEvent,
  type ReactionPayload,
} from '@/lib/chat/realtime'
import { getAblyTokenAction } from '@/app/actions/chat'

interface AblyClientRef {
  // The concrete Ably Realtime instance — its `connection.on/off` overloads
  // (event names + callbacks) must be preserved, so a hand-rolled structural
  // type would be narrower than reality and fail to accept it.
  client: Realtime
  matchId: string
}

const clientCache = new Map<string, AblyClientRef>()

const TYPING_EVENT = 'typing'
const REACTION_EVENT = 'reaction'

export interface ChatConnectionOptions {
  /** Local user id — used to ignore this client's own typing/reaction echoes. */
  myId?: string
  /** Fired for every inbound reaction envelope (delivery accelerator). */
  onReaction?: (payload: ReactionPayload) => void
}

export interface ChatRealtimeState {
  state: ComposerConnectionState
  /** True while the peer's typing presence is active (S032). */
  isPeerTyping: boolean
}

interface ChannelMessage {
  data?: unknown
}

export function useChatConnection(
  matchId: string,
  options?: ChatConnectionOptions,
): ChatRealtimeState {
  const [state, setState] = useState<ComposerConnectionState>('connecting')
  const [isPeerTyping, setIsPeerTyping] = useState(false)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const initializing = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const cleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (initializing.current) return
    initializing.current = true

    let mounted = true

    async function init() {
      try {
        const result = await getAblyTokenAction({ matchId })
        if (!mounted) return

        setState(
          resolveComposerConnectionState({
            hasToken: true,
            isConnected: false,
          }),
        )

        const Ably = (await import('ably')).default
        const client = new Ably.Realtime({ token: result.token })
        const conn = client.connection as unknown as {
          on: (event: string, listener: () => void) => void
          off: (event: string, listener: () => void) => void
        }

        clientCache.set(matchId, { client, matchId })

        const handleTyping = (message: ChannelMessage) => {
          const envelope = message.data
          if (!isTypingEvent(envelope)) return
          const myId = optionsRef.current?.myId
          if (myId && envelope.actorId === myId) return
          setIsPeerTyping(envelope.payload.isTyping)
        }
        const handleReaction = (message: ChannelMessage) => {
          const envelope = message.data
          if (!isReactionEvent(envelope)) return
          optionsRef.current?.onReaction?.(envelope.payload)
        }

        const channel = client.channels.get(`match:${matchId}`)
        void channel
          .subscribe(TYPING_EVENT, handleTyping)
          .catch(() => undefined)
        void channel
          .subscribe(REACTION_EVENT, handleReaction)
          .catch(() => undefined)

        const handleConnected = () => {
          if (mounted)
            setState(
              resolveComposerConnectionState({
                hasToken: true,
                isConnected: true,
              }),
            )
        }
        const handleDisconnected = () => {
          if (mounted)
            setState(
              resolveComposerConnectionState({
                hasToken: true,
                isConnected: false,
              }),
            )
        }
        const handleSuspended = () => {
          if (mounted)
            setState(
              resolveComposerConnectionState({
                hasToken: true,
                isConnected: false,
              }),
            )
        }
        const handleFailed = () => {
          if (mounted)
            setState(
              resolveComposerConnectionState({
                hasToken: false,
                isConnected: false,
              }),
            )
        }

        conn.on('connected', handleConnected)
        conn.on('disconnected', handleDisconnected)
        conn.on('suspended', handleSuspended)
        conn.on('failed', handleFailed)

        cleanupRef.current = () => {
          conn.off('connected', handleConnected)
          conn.off('disconnected', handleDisconnected)
          conn.off('suspended', handleSuspended)
          conn.off('failed', handleFailed)
          channel.unsubscribe(TYPING_EVENT, handleTyping)
          channel.unsubscribe(REACTION_EVENT, handleReaction)
          client.close()
          clientCache.delete(matchId)
        }
      } catch {
        if (mounted) setState('connecting')
      } finally {
        initializing.current = false
      }
    }

    init()

    return () => {
      mounted = false
      cleanup()
    }
  }, [matchId, cleanup])

  return { state, isPeerTyping }
}
