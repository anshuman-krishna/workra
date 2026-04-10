# WORKRA — MASTER SYSTEM DOCUMENT

## core philosophy

workra is not a tool.
it is a structured workspace layer between freelancers and clients.

it replaces fragmentation:
- time trackers
- file sharing
- task systems
- reporting tools

with a single, calm, structured system.

---

## product identity

name: workra  
tagline: "clarity in every working hour"

positioning:
a client-aware operating system for freelancers and small teams.

---

## product goals

- eliminate context switching
- provide structured transparency
- reduce cognitive load
- create trust between freelancer and client
- turn work into traceable, explainable output

---

## system modes

### mode a — focused use case

freelancers managing multiple clients.

features optimized for:
- time tracking
- client deliverables
- reporting
- structured communication

---

### mode b — configurable system

expandable into:
- small teams
- agencies
- external collaborator systems

must support:
- flexible permissions
- modular features
- scalable architecture

---

## core system primitives

### 1. rooms

rooms are the foundation.

each room represents:
- a client
- a project
- a workspace

room capabilities:
- members (roles)
- files
- time logs
- tasks
- calendar
- activity timeline

access:
- invite link
- 6 digit code
- direct invite

roles:
- owner
- collaborator
- client

---

### 2. sessions (not just time logs)

a session is a unit of work.

fields:
- start_time
- end_time
- duration
- intent (required before start)
- summary (after end)
- linked_task
- linked_files
- created_by

sessions build narrative.

---

### 3. activity timeline

every action becomes an event:
- time log created
- file uploaded
- task completed
- edits made

timeline is:
- chronological
- filterable
- readable

---

## feature systems

### time tracking

- start / stop timer
- manual entry
- edit logs (with history)

enhancements:
- idle detection
- smart suggestions
- session summaries

---

### task system

lightweight but structured.

supports:
- checklist
- nested tasks
- due dates
- assignments

no over complexity.

---

### file system

- folder-based structure
- version history
- preview system

file visibility:
- private
- shared with client

---

### calendar system

- monthly / weekly view
- github-style heatmap
- event overlays

filters:
- sessions
- tasks
- deadlines
- meetings

---

### chat system

per room chat.

features:
- threaded messages
- file attachments
- references to tasks / sessions

not bloated.

---

### deliverables system

- track outputs
- states:
  - draft
  - review
  - approved

linked with time logs.

---

### reporting system

auto-generated:
- work summaries
- timelines
- time breakdown

export:
- pdf
- sharable link

---

## ai integration

ai is assistive, not dominant.

features:
- session summary generation
- daily recap
- missing time detection
- smart tagging

future:
- invoice generation
- anomaly detection

---

## admin panel

admin capabilities:

- manage users
- manage rooms
- view system metrics
- audit logs
- manage feature flags

must be separate interface.

---

## frontend architecture

framework: next.js (app router)

structure:

/app
  /(auth)
  /(dashboard)
  /(room)
  /(admin)

/components
/hooks
/lib
/styles

state:
- zustand (local state)
- react query (server state)

ui:
- tailwind
- shadcn base

---

## backend architecture (mvc)

strict separation.

structure:

/controllers
/services
/models
/routes
/middlewares
/utils

principles:
- controllers thin
- services contain logic
- models define schema

---

## database (mongodb)

collections:

users
rooms
memberships
sessions
time_logs
tasks
files
events
messages
activity_logs

---

## security

must include:

- input sanitization
- xss protection
- rate limiting
- jwt auth with refresh tokens
- role-based access control
- secure file handling

no shortcuts.

---

## file storage

use:
- aws s3 or cloudflare r2

features:
- versioning
- preview urls
- access control

---

## real-time layer

use websockets.

for:
- timer sync
- chat
- live updates

fallback:
- polling if needed

---

## ux principles

- clarity over density
- minimal clicks
- always navigable back
- no confusion

---

## layout system

### main layout

left sidebar:
- dashboard
- rooms
- calendar
- reports

top bar:
- global timer
- search

main content:
- dynamic

---

### room layout

tabs:
- overview
- tasks
- time
- files
- calendar
- chat

---

## visual design

- pastel base tones
- dark accents
- no bright or neon
- no purple / mint / sky blue

style:
- clean
- soft shadows
- rounded edges (controlled)

---

## extensibility

system must allow:

- plugins
- feature toggles
- modular additions

---

## deployment

initial:
- vercel (frontend)
- railway / render (backend)

future:
- containerized (docker)
- kubernetes

---

## scaling strategy

- stateless backend
- horizontal scaling
- queue system (future)
- caching layer (redis)

---

## coding standards

- no unnecessary comments
- lowercase comments only
- meaningful naming
- avoid repetition
- modular functions

---

## engineering mindset

claude must:

- think like a senior engineer
- question decisions
- improve architecture
- not blindly follow instructions

---

## non-goals

- not bloated
- not overly complex
- not generic

---

## success criteria

- usable daily by a freelancer
- understandable by non-technical clients
- scalable into a product

---

## final note

this is not a prototype.

this is a real system.

build it like it will be used by thousands.