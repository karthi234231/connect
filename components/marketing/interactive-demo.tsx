'use client'

import { useState } from 'react'
import {
  Sparkles,
  Heart,
  X,
  RotateCcw,
  CheckCircle2,
  Building2,
  MapPin,
  Briefcase,
  Zap,
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'

interface DemoCandidate {
  id: string
  name: string
  headline: string
  city: string
  offering: string[]
  lookingFor: string[]
  matchScore: number
}

const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: 'demo-1',
    name: 'Dr. Elena Rostova',
    headline: 'AI Research Scientist & Co-founder @ NeuralLab',
    city: 'San Francisco, CA',
    offering: ['LLM Orchestration', 'PyTorch', 'Distributed Training'],
    lookingFor: ['Lead Fullstack Engineer', 'Product Strategist'],
    matchScore: 96,
  },
  {
    id: 'demo-2',
    name: 'Marcus Vance',
    headline: 'Principal Systems Architect & Open Source Maintainer',
    city: 'Seattle, WA',
    offering: ['Rust', 'Distributed Databases', 'High-Throughput APIs'],
    lookingFor: ['AI/ML Co-founder', 'Technical Advisor'],
    matchScore: 92,
  },
  {
    id: 'demo-3',
    name: 'Sophia Chen',
    headline: 'Head of Product Design @ Craft Studio',
    city: 'New York, NY',
    offering: ['Design Systems', 'Design Tokens', 'User Research'],
    lookingFor: ['Frontend Engineer (React/Next.js)', 'Seed Founder'],
    matchScore: 89,
  },
]

export function InteractiveDemoDeck() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchedCandidate, setMatchedCandidate] = useState<DemoCandidate | null>(null)
  const [animatingDirection, setAnimatingDirection] = useState<'left' | 'right' | null>(null)

  const candidate = DEMO_CANDIDATES[currentIndex]

  const handleSwipe = (direction: 'left' | 'right') => {
    setAnimatingDirection(direction)
    setTimeout(() => {
      if (direction === 'right' && candidate) {
        setMatchedCandidate(candidate)
      }
      setCurrentIndex((prev) => (prev + 1) % DEMO_CANDIDATES.length)
      setAnimatingDirection(null)
    }, 250)
  }

  const handleReset = () => {
    setCurrentIndex(0)
    setMatchedCandidate(null)
  }

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* Glass Container */}
      <Card
        glass
        className="relative overflow-hidden rounded-[28px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-6 shadow-2xl transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
      >
        {/* Header Badge */}
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="brand" className="gap-1.5 px-3 py-1 font-mono text-xs uppercase tracking-wider">
            <Sparkles className="size-3.5" aria-hidden /> Live Demo Deck
          </Badge>

          {candidate && (
            <Badge variant="success" className="gap-1 font-mono text-xs">
              <Zap className="size-3 fill-emerald-500 text-emerald-500" aria-hidden />
              {candidate.matchScore}% Match
            </Badge>
          )}
        </div>

        {/* Card Content Stack */}
        {candidate ? (
          <div
            className={`transition-all duration-300 ${
              animatingDirection === 'left'
                ? '-translate-x-12 opacity-0 rotate-[-8deg]'
                : animatingDirection === 'right'
                  ? 'translate-x-12 opacity-0 rotate-[8deg]'
                  : 'translate-x-0 opacity-100 rotate-0'
            }`}
          >
            {/* Avatar & Name */}
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--cx-brand)] to-amber-600 font-display text-xl font-bold text-white shadow-lg">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-display text-lg font-bold tracking-tight text-[var(--cx-text-1)]">
                  {candidate.name}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--cx-text-2)] flex items-center gap-1">
                  <MapPin className="size-3 text-[var(--cx-text-3)]" /> {candidate.city}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--cx-text-2)] font-medium">
                  {candidate.headline}
                </p>
              </div>
            </div>

            {/* Offerings & Intent */}
            <div className="mt-5 space-y-3 rounded-xl border border-[var(--cx-border-2)] bg-[var(--cx-surface-2)] p-3.5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cx-text-3)] flex items-center gap-1">
                  <Briefcase className="size-3" /> Offering
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.offering.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2 py-0.5 text-[11px] font-medium text-[var(--cx-brand-strong)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cx-text-3)] flex items-center gap-1">
                  <Building2 className="size-3" /> Looking For
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.lookingFor.map((need) => (
                    <span
                      key={need}
                      className="rounded-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2 py-0.5 text-[11px] font-medium text-[var(--cx-text-2)]"
                    >
                      {need}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleSwipe('left')}
                className="flex size-12 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-400 transition hover:scale-105 hover:bg-rose-500/20 active:scale-95"
                title="Pass"
              >
                <X className="size-5" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)]"
                title="Reset Deck"
              >
                <RotateCcw className="size-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSwipe('right')}
                className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition hover:scale-105 hover:brightness-110 active:scale-95"
                title="Connect"
              >
                <Heart className="size-5 fill-white" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Completed Demo State */
          <div className="py-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <h4 className="mt-3 font-display text-base font-bold text-[var(--cx-text-1)]">
              Demo Deck Complete!
            </h4>
            <p className="mt-1 text-xs text-[var(--cx-text-2)]">
              Sign in with LinkedIn to unlock your personalized recommendation queue.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReset}
              className="mt-4 gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Replay Demo
            </Button>
          </div>
        )}
      </Card>

      {/* Match Alert Modal */}
      {matchedCandidate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] border border-emerald-500/30 bg-[var(--cx-surface-1)]/95 p-6 backdrop-blur-md cx-scale-up">
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xl shadow-emerald-500/30">
              <Sparkles className="size-7 animate-pulse" />
            </div>
            <h3 className="mt-3 font-display text-xl font-extrabold text-[var(--cx-text-1)]">
              It&apos;s a Match!
            </h3>
            <p className="mt-1 text-xs text-[var(--cx-text-2)]">
              You and <strong className="text-[var(--cx-text-1)]">{matchedCandidate.name}</strong> share high skill alignment.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => setMatchedCandidate(null)}
              >
                Continue Demo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
