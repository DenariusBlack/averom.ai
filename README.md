# Averom — AI Supplier Intelligence Platform

Built for Amazon FBA sellers and B2B operators who need to verify suppliers before placing purchase orders.

## Problem

Counterfeit suppliers and sourcing fraud cost importers millions every year. Manual vetting is slow, expensive, and unreliable.

## Solution

Averom uses Claude AI to autonomously research suppliers, score risk across 7 weighted categories, and generate structured intelligence reports in seconds.

## Features

- AI Supplier Verification Agent
- Deal Profitability Analyzer
- Sourcing Engine with AI-powered matching
- Multi-turn AI Copilot with live data context
- Communication Hub for context-aware outreach
- Deal Pipeline with RAG-grounded responses

## Tech Stack

- Frontend: Next.js, TypeScript
- Backend: Vercel Serverless Functions
- Database: Supabase (PostgreSQL + pgvector)
- AI: Claude API (Anthropic) with web search tool
- Payments: Stripe
- Deployment: Vercel

## Architecture

User Input → Next.js Frontend → Vercel API Route → Claude API (with Supabase context injected) → Structured Output → Supabase Storage → Dashboard

## Live Demo

- Platform: https://averom-v2.vercel.app
- Supplier Verification: https://averom.co
