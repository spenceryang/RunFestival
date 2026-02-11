# 🏃‍♂️🎉 RunFestival

**You run alone. You never run alone.**

RunFestival turns every solo run into a shared experience with real-time AI voice coaching and live community presence. Built for the Claude Code Hackathon — Track: Amplify Human Judgment.

## What It Does

Open the app, hit go, and you're immediately running with hundreds of people worldwide. Your AI coach:

- **Coaches your pace** — announces splits, detects pace drift, helps you decide strategy
- **Motivates through community** — "342 people running with you right now across 12 cities"
- **Tells stories** — when you're in a groove, it tells fascinating stories from topics you choose
- **Suggests routes** — optimal elevation for your goals, scenic detours, real-time navigation
- **Amplifies YOUR judgment** — presents options, never commands. You decide. Coach informs.

Think Peloton energy, but for the open road.

## Tech Stack

- **Next.js 14** (App Router, TypeScript, PWA)
- **Supabase** (Auth, PostgreSQL, Realtime presence, Edge Functions)
- **Claude API** (Sonnet 4.5 — streaming coaching intelligence)
- **ElevenLabs** (Streaming text-to-speech with multiple voice personas)
- **Mapbox** (Maps, Directions, Elevation)
- **Vercel** (Hosting)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Documentation

- **[PRD.md](docs/PRD.md)** — Full product requirements
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System architecture and data flows
- **[CLAUDE.md](docs/CLAUDE.md)** — Build instructions for Claude Code
- **[PROMPTS.md](docs/PROMPTS.md)** — All coaching persona system prompts

## Coaching Personas

| Persona | Vibe | Best For |
|---------|------|----------|
| 🔥 Hype Coach | Peloton instructor energy | Race day, PRs, motivation |
| 🧘 Calm Guide | Zen, mindful, grounding | Recovery runs, mindfulness |
| 📊 Data Nerd | Analytical, strategic | Training, pacing strategy |
| 📖 Storyteller | Fascinating stories | Long runs, easy miles |

## The Boris Principles

This project follows two key principles from the hackathon kickoff:

1. **Build for the model 6 months from now.** Real-time streaming voice with context awareness is borderline today. In 6 months, it'll be seamless. We're building the product that clicks when the model catches up.

2. **Think in terms of latent demand.** Runners already wear earbuds. Already listen to something. Already wish they had a running buddy. We're making the existing behavior 10x better.

## Hackathon Track: Amplify Human Judgment

RunFestival never runs for you. It presents choices:
- "You're ahead of pace — bank it or ease off?"
- "Hill coming up — power through or steady pace?"
- "You've been going 20 minutes — want a story or keep the silence?"

You decide. We amplify.

---

Built with ❤️ and Claude Code for the Anthropic Hackathon 2026.
