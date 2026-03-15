# NexChat Frontend Design SKILL

This file is the authoritative design reference for the NexChat coding agent.
It defines the visual language, component library, themes, and integration instructions for all frontend work.
**Always consult this file before writing any UI code.**

---

## Project Stack Requirements

Every component must be compatible with:
- **Next.js 14+** (App Router, `"use client"` where needed)
- **TypeScript** (strict mode)
- **Tailwind CSS** (utility-first, no inline style objects unless required by shader libs)
- **shadcn/ui** project structure — components live in `/components/ui/`
- **framer-motion** for animations
- **lucide-react** for all icons and SVGs unless a custom SVG is explicitly provided

### shadcn Setup (if not already initialised)
```bash
npx shadcn-ui@latest init
```
Choose: TypeScript → Yes, Tailwind → Yes, App Router → Yes, components path → `/components/ui`

### Why `/components/ui` matters
shadcn resolves all component imports from `@/components/ui`. If components are placed elsewhere, all shadcn primitives (Button, Dialog, Sheet, etc.) will break. Always place custom UI components in `/components/ui/` alongside shadcn primitives.

---

## Global Design Language

### Aesthetic Direction
**Dual-mode. Soft light surfaces with dark cinematic accents.**

NexChat has two tonal contexts that must coexist cleanly:

- **Landing / Marketing pages**: Dark-first. Cinematic. Shader backgrounds, glowing accents, glass-morphic surfaces. Think: Linear meets Discord meets a luxury product site.
- **App / Chat UI**: Light-first. Soft and airy. Sky blue, cream, and off-white surfaces with bold black text for maximum readability and a pleasing, trustworthy feel. Think: iMessage meets Notion meets a premium productivity tool.

**Rule**: Never mix the two tonal contexts on the same screen. Dark = landing/hero. Light-soft = app interior (chat, settings, groups, video UI).

---

### Color Palette — Dark Mode (Landing / Hero pages)
```css
--background:        #000000
--surface:           #0A0A0A
--surface-raised:    #111111
--surface-overlay:   rgba(255,255,255,0.04)
--text-primary:      #FFFFFF
--text-secondary:    rgba(255,255,255,0.7)
--text-muted:        rgba(255,255,255,0.4)
--accent-primary:    #1ABC9C        /* teal — CTAs, active states */
--accent-secondary:  #2E6DA4        /* blue — links, info */
--accent-glow:       rgba(26,188,156,0.15)
--border:            rgba(255,255,255,0.08)
--border-active:     rgba(255,255,255,0.2)
```

### Color Palette — Light Mode (App / Chat UI)
```css
/* PRIORITY RULE: Soft colours with bold black text everywhere in app interior */

--app-bg:            #F0F8FF        /* Alice Blue — main app background */
--app-surface:       #FFFFFF        /* pure white — panels, cards */
--app-surface-alt:   #F5F9FF        /* very light sky blue — sidebar, secondary panels */
--app-cream:         #FFFDF5        /* cream — sent message bubbles, modal backgrounds */
--app-sky:           #E1F0FF        /* light sky blue — received bubbles, hover states */
--app-sky-mid:       #BAD9F5        /* mid sky blue — active nav, selected states */
--app-border:        #D6E8F5        /* soft blue-grey border */

/* Text — always bold/dark on light surfaces */
--app-text-primary:  #0A0A0A        /* near-black — headings, usernames, primary labels */
--app-text-body:     #1A1A2E        /* dark navy — body text, message content */
--app-text-muted:    #6B7A99        /* muted blue-grey — timestamps, secondary labels */
--app-text-link:     #2563EB        /* blue — links, mentions */

/* Accent */
--app-accent:        #1ABC9C        /* teal — badges, online dots, CTA buttons */
--app-accent-soft:   #D0F5EE        /* pale teal — accent backgrounds, pill badges */
```

### Soft Colour Rules (MUST FOLLOW in app UI)
1. **Background**: Always `#F0F8FF` (Alice Blue) or `#FFFDF5` (Cream) — never pure white as outermost bg.
2. **Text on light surfaces**: Always `font-semibold` to `font-bold` in `#0A0A0A` or `#1A1A2E`. Never grey text on white — use dark navy instead.
3. **Interactive elements**: Hover states use `bg-[#E1F0FF]` (sky blue), not grey.
4. **Borders**: Use `#D6E8F5` — soft, barely visible. Never hard grey borders in app UI.
5. **Shadows**: `shadow-sm` with `shadow-blue-100/50` — soft blue-tinted shadows only.
6. **Accents**: Teal `#1ABC9C` for all CTAs. Avoid red/orange/yellow in the app interior.
7. **Chat bubbles**: Sent = cream `#FFFDF5`, Received = sky blue `#E1F0FF` — non-negotiable.

---

### Typography
- **Display headings (dark pages)**: `font-light` to `font-medium`, large tracking, white
- **Headings (light app UI)**: `font-bold text-[#0A0A0A]`, tight tracking
- **Body (light app UI)**: `text-sm font-medium text-[#1A1A2E]`
- **Timestamps / Labels**: `text-xs font-medium text-[#6B7A99]`
- **Message text**: `text-sm font-medium` — never `font-light` in chat
- Avoid Inter/Roboto/Arial on landing pages. System sans is acceptable in app UI for readability.

### Motion Principles
- Page transitions: fade + slight upward translate (y: 8px → 0)
- Hover states: `transition-all duration-200`
- Modals/sheets: slide in from bottom or right
- New message arrive: slide up from below + fade in
- Real-time events (notification, badge): subtle pulse
- Use `framer-motion` for all complex animations

### Spacing & Layout
- Sidebar: fixed left, `w-64`, `bg-[#F5F9FF]`, `border-r border-[#D6E8F5]`
- Main content: flexible, `bg-[#F0F8FF]`
- Chat area: flex column, messages bottom-anchored
- Modals: centered, `max-w-md`, `bg-white`, `rounded-2xl`, `shadow-xl shadow-blue-100/40`
- Rounded corners: `rounded-2xl` for chat bubbles and cards, `rounded-full` for avatars/pills, `rounded-xl` for inputs

---

### Chatbox Design Rules (CRITICAL — read before building any chat UI)

The chatbox is the core of NexChat. It must feel **modular, modern, and sleek** while following the soft light palette.

#### Chat Layout Structure
```
┌─────────────────────────────────────────┐
│  Chat Header (name, status, actions)    │  bg-white border-b border-[#D6E8F5]
├─────────────────────────────────────────┤
│                                         │
│  Messages Area (scrollable)             │  bg-[#F0F8FF]
│                                         │
│  [Received bubble — sky blue]           │  align left
│                  [Sent bubble — cream]  │  align right
│                                         │
├─────────────────────────────────────────┤
│  Input Bar                              │  bg-white border-t border-[#D6E8F5]
└─────────────────────────────────────────┘
```

#### Chat Bubble Rules
```
Received:  bg-[#E1F0FF] text-[#1A1A2E] rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs
Sent:      bg-[#FFFDF5] text-[#0A0A0A] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs border border-[#D6E8F5]
Ephemeral: add clock icon + text-[#6B7A99] text-xs TTL countdown below bubble
File:      bg-white rounded-xl border border-[#D6E8F5] p-3 inside the bubble
Text:      always text-sm font-medium — never font-light
```

#### Input Bar Rules
```
Container:         bg-white border-t border-[#D6E8F5] px-4 py-3
Input field:       bg-[#F0F8FF] rounded-xl border border-[#D6E8F5] px-4 py-2.5
                   text-sm font-medium text-[#0A0A0A] placeholder:text-[#6B7A99]
                   focus:border-[#BAD9F5] focus:ring-2 focus:ring-[#E1F0FF]
Send button:       bg-[#1ABC9C] hover:bg-[#17a589] text-white rounded-xl px-4 py-2.5
Ephemeral toggle:  bg-[#F0F8FF] border border-[#D6E8F5] rounded-full text-xs font-semibold text-[#0A0A0A]
                   active: bg-[#D0F5EE] border-[#1ABC9C] text-[#0A7A65]
Attachment btn:    text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF] rounded-lg p-2
```

#### Chat Header Rules
```
Container:    bg-white border-b border-[#D6E8F5] px-4 py-3 flex items-center justify-between
Username:     text-base font-bold text-[#0A0A0A]
Subtitle:     text-xs font-medium text-[#6B7A99]
Online dot:   w-2 h-2 rounded-full bg-[#1ABC9C]
Action icons: text-[#6B7A99] hover:text-[#0A0A0A] hover:bg-[#E1F0FF] rounded-lg p-2
```

#### Sidebar Conversation List Rules
```
Container:          bg-[#F5F9FF] border-r border-[#D6E8F5] w-64
Item (default):     hover:bg-[#E1F0FF] rounded-xl mx-2 px-3 py-3
Item (active):      bg-[#BAD9F5] rounded-xl mx-2 px-3 py-3
Name:               text-sm font-bold text-[#0A0A0A]
Preview:            text-xs font-medium text-[#6B7A99] truncate
Unread badge:       bg-[#1ABC9C] text-white text-xs font-bold rounded-full px-1.5 py-0.5
Timestamp:          text-xs font-medium text-[#6B7A99]
```

---

## Theme 1 — Shader Hero Backgrounds

**Install**:
```bash
npm install @paper-design/shaders-react framer-motion
```

### Component: MeshGradient + PulsingBorder Hero
**File**: `/components/ui/shaders-hero-section.tsx`

**Use when**: Landing page hero, onboarding screen, splash/loading screen.

**What it does**:
- Animated mesh gradient background (dark browns/blacks/whites)
- Wireframe mesh overlay at 60% opacity
- Pulsing border circle with rotating text (bottom-right)
- Glass-effect badge, hero heading, CTA buttons (bottom-left)
- Header with gooey animated login button

**Key implementation details**:
- Requires `"use client"` — uses `useRef`, `useState`, `useEffect`
- SVG filters (`glass-effect`, `gooey-filter`) defined inline
- `MeshGradient` colors: `["#000000", "#8B4513", "#ffffff", "#3E2723", "#5D4037"]`
- Second `MeshGradient`: `opacity-60` + `wireframe="true"`
- `PulsingBorder` colors: `["#BEECFF", "#E77EDC", "#FF4C3E", "#00FF88", "#FFD700", "#FF6B35", "#8A2BE2"]`
- Gooey button: CSS filter `url(#gooey-filter)`

**Exports**: `ShaderBackground`, `Header`, `HeroContent`, `PulsingCircle`

**Demo**:
```tsx
"use client"
import { Header, HeroContent, PulsingCircle, ShaderBackground } from "@/components/ui/shaders-hero-section"
export default function Page() {
  return (
    <ShaderBackground>
      <Header /><HeroContent /><PulsingCircle />
    </ShaderBackground>
  )
}
```

**NexChat customisation**:
- Colors: `["#000000", "#0A2A2A", "#1ABC9C", "#000000"]`
- PulsingCircle text: `NexChat • Secure • Private •`
- Nav links: Features, Security, Download

---

### Component: Warp Shader Hero
**File**: `/components/ui/wrap-shader.tsx`

**Use when**: Alternative hero, feature section backgrounds, full-bleed dividers.

**Key props**: `proportion=0.45`, `softness=1`, `distortion=0.25`, `swirl=0.8`, `swirlIterations=10`, `shape="checks"`, `shapeScale=0.1`, `speed=1`

**Colors**: `["hsl(200,100%,20%)", "hsl(160,100%,75%)", "hsl(180,90%,30%)", "hsl(170,100%,80%)"]`

**NexChat customisation**: Colors → `["hsl(170,100%,8%)", "hsl(160,100%,40%)", "hsl(180,80%,20%)", "hsl(170,100%,60%)"]`

---

## Theme 2 — Animated Text Reveal

**Install**: `npm install framer-motion`

### Component: AnimatedText
**File**: `/components/ui/animated-text.tsx`

**Use when**: Section headings, feature titles, onboarding screens, empty state headings. Works on both dark landing pages and light app screens.

**What it does**:
- Splits text into characters, animates each letter up with spring physics
- Gradient underline expands from center outward after letters finish
- Fully configurable: tag type, speed, underline gradient/height/offset

**Props**:
```tsx
text: string                     // required
duration?: number                // stagger per letter (default: 0.5)
delay?: number                   // delay between letters (default: 0.1)
replay?: boolean                 // re-trigger animation (default: true)
as?: "h1"|"h2"|"h3"|...|"span"  // HTML tag (default: "h1")
textClassName?: string
underlineGradient?: string       // default: "from-blue-500 via-purple-500 to-pink-500"
underlineHeight?: string         // default: "h-1"
underlineOffset?: string         // default: "-bottom-2"
underlineClassName?: string
```

**NexChat usage**:
```tsx
// Dark landing page
<AnimatedText
  text="Secure by Design"
  as="h1"
  textClassName="text-7xl font-light text-white"
  underlineGradient="from-[#1ABC9C] via-white to-[#1ABC9C]"
  underlineHeight="h-0.5"
/>

// Light app screen
<AnimatedText
  text="Your Conversations"
  as="h2"
  textClassName="text-4xl font-bold text-[#0A0A0A]"
  underlineGradient="from-[#BAD9F5] via-[#1ABC9C] to-[#2563EB]"
  underlineHeight="h-1"
/>
```

**Best use in NexChat**: Landing hero heading, onboarding welcome, feature section titles, empty state headings ("No Messages Yet"), group name reveals.

---

## Theme 3 — Liquid Glass UI

**Install**: No extra packages needed.

**CSS** — add to `globals.css`:
```css
@keyframes moveBackground {
  from { background-position: 0% 0%; }
  to   { background-position: 0% -1000%; }
}
```

### Component: Liquid Glass Effect System
**File**: `/components/ui/liquid-glass.tsx`

**Use when**: Floating video call controls, waiting room overlay cards, reaction pickers, premium floating action buttons, any UI element overlaid on a video/image background.

**What it does**:
- SVG fractal noise + displacement filter creates realistic glass refraction
- Three layered divs: backdrop blur → white rgba fill → inset specular highlight
- `GlassEffect`: generic glass wrapper for any children
- `GlassDock`: horizontal icon dock with glass wrap + hover scale on icons
- `GlassButton`: glass pill button with padding-expand hover animation
- `GlassFilter`: hidden SVG filter definition — **render once per page**

**Exports**: `GlassEffect`, `GlassDock`, `GlassButton`, `GlassFilter`, `Component`

**Critical rules**:
- `GlassFilter` must be rendered ONCE in the component tree before any `GlassEffect`
- Do not use on more than 3–4 elements per screen (GPU intensive)
- Hover animation: `transition-all duration-700` + `cubic-bezier(0.175, 0.885, 0.32, 2.2)` (elastic overshoot)

**NexChat usage**:
```tsx
"use client"
import { GlassFilter, GlassEffect } from "@/components/ui/liquid-glass"

// Video call floating controls bar
export function VideoCallControls() {
  return (
    <>
      <GlassFilter />
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <GlassEffect className="rounded-3xl px-6 py-3">
          <div className="flex items-center gap-4 text-white">
            {/* Mic, Camera, ScreenShare, EndCall icons */}
          </div>
        </GlassEffect>
      </div>
    </>
  )
}

// Waiting room overlay card
<GlassEffect className="rounded-2xl p-8 max-w-sm text-center">
  <p className="text-white font-semibold">Waiting for the host to let you in...</p>
</GlassEffect>
```

**On light app backgrounds**: Glass over `#F0F8FF` refracts beautifully into soft sky-blue tones — no customisation needed.

---

## Theme 4 — Animated Sidebar Navigation

**Install**: `npm install framer-motion lucide-react`

### Component: Sidebar with Animated Toggle
**File**: `/components/ui/sidebar.tsx`

**Use when**: Main app navigation shell. This is the primary nav component wrapping all NexChat app pages.

**What it does**:
- Desktop: fixed left sidebar (`w-64`) — profile, nav links, collapsible sections, footer CTA
- Mobile: full-screen slide-in overlay with animated hamburger/X toggle
- `AnimatedMenuToggle`: SVG paths morph hamburger → X via framer-motion variants
- `CollapsibleSection`: accordion with `AnimatePresence` height animation

**Exports**: `Sidebar`, `AnimatedMenuToggle`, `CollapsibleSection`

**Key details**:
- Requires `"use client"`
- Mobile slide: `x: "-100%" → 0`, `duration: 0.3`
- Middle bar fades out (`opacity: 0`) when open
- Collapsible: `height: 0 → "auto"` + `opacity: 0 → 1`

**NexChat reskin — apply these class overrides**:
```tsx
// Sidebar container
"bg-[#F5F9FF] border-r border-[#D6E8F5]"

// Nav button (default)
"flex gap-2 font-semibold text-sm items-center w-full py-2.5 px-4 rounded-xl text-[#0A0A0A] hover:bg-[#E1F0FF] transition-all duration-200"

// Nav button (active)
"flex gap-2 font-semibold text-sm items-center w-full py-2.5 px-4 rounded-xl text-[#0A0A0A] bg-[#BAD9F5]"

// Profile name
"font-bold text-[#0A0A0A] text-sm"

// Profile subtitle
"text-xs font-medium text-[#6B7A99]"

// CollapsibleSection title
"w-full flex items-center justify-between py-2 px-4 rounded-xl font-bold text-[#0A0A0A] hover:bg-[#E1F0FF]"

// Footer CTA
"w-full font-semibold text-sm p-2.5 text-center bg-[#1ABC9C] text-white rounded-xl hover:bg-[#17a589] transition-colors duration-200"

// Mobile overlay background
"md:hidden fixed inset-0 z-50 bg-[#F5F9FF] text-[#0A0A0A]"
```

**NexChat nav items**:
```tsx
import { MessageSquare, Users, Video, UserPlus, Bell, Settings } from "lucide-react"

const navItems = [
  { icon: MessageSquare, label: "Messages",    href: "/messages"  },
  { icon: Users,         label: "Groups",      href: "/groups"    },
  { icon: Video,         label: "Video Calls", href: "/video"     },
  { icon: UserPlus,      label: "Connections", href: "/people"    },
  { icon: Bell,          label: "Notifications",href: "/notifs"   },
  { icon: Settings,      label: "Settings",    href: "/settings"  },
]
```

**CollapsibleSection uses**: "Direct Messages" list, "Groups" list, "Pinned Rooms"

---

## Theme 5 — Multi-Orbit Integration Visual

**Install**: No extra packages.

### Component: MultiOrbitSemiCircle
**File**: `/components/ui/multi-orbit-semi-circle.tsx`

**Use when**: Landing page "Integrations" or "Ecosystem" section. Shows NexChat's connection to external tools visually. Also usable as a decorative splash/loading animation.

**What it does**:
- Three concentric semi-circle orbits of icons (inner=6, mid=8, outer=10)
- Responsive — recalculates radii from `window.innerWidth`
- Hover tooltip per icon (flips above/below based on angle)
- Radial glow effect behind orbits

**Key details**:
- Requires `"use client"` — `useState` + `useEffect` for window dimensions
- Orbit radii: `baseWidth * 0.22`, `* 0.36`, `* 0.5`
- Icon size: scales from 24px (mobile) to `baseWidth * 0.07` (desktop)
- Glow: `radial-gradient(circle_at_center, rgba(255,255,255,0.25), transparent 70%)` + `blur-3xl`
- Tooltip: `hidden group-hover:block`, arrow flips at angle > 90°

**NexChat customisation**:
```tsx
// Replace ICONS array with NexChat-relevant platforms:
// Google Drive, Spotify, GitHub, Slack, Google Calendar, Zoom (use SVG URLs or lucide icons)

// Heading
"Connect Your World"

// Subtext
"NexChat integrates with your favourite tools. Share files, schedule calls, and collaborate — all encrypted."

// Section background (soft palette)
className="py-12 relative min-h-screen w-full overflow-hidden bg-[#F0F8FF]"

// Heading
className="my-6 text-4xl font-bold lg:text-7xl text-[#0A0A0A]"

// Subtext
className="mb-12 max-w-2xl font-medium text-[#6B7A99] lg:text-xl"

// Radial glow — change to sky blue:
// rgba(255,255,255,0.25) → rgba(186,217,245,0.4)
```

---

## Theme 6 — Sign-In / Auth Form with Animated Map

**Install**:
```bash
npm install framer-motion lucide-react tailwindcss-animate
```

**tailwind.config.js**: add full shadcn CSS variable config + `require("tailwindcss-animate")` plugin (see component source).

**globals.css**: add full shadcn CSS variable block for light + dark mode (see component source).

### Component: Sign-In Card with Dot Map
**File**: `/components/ui/travel-connect-signin-1.tsx`

**Use when**: Login page, registration page, any auth flow.

**What it does**:
- Split panel card: left = animated canvas dot-map + branding, right = sign-in form
- `DotMap`: HTML5 Canvas — world map dot grid (blue, 12px gap, 1px radius) + animated route lines between city points
- Routes animate linearly over 3s, reset every 15s; `ResizeObserver` keeps canvas responsive
- Google OAuth button, email + password inputs, show/hide password toggle
- Submit button: `whileHover` scale + shimmer sweep animation (`motion.span`, `left: "-100%" → "100%"`)
- Card entrance: `opacity: 0, scale: 0.95 → 1` on mount

**Exports**: `default Index` (full page), `SignInCard`, `DotMap`

**NexChat reskin**:
```tsx
// Left panel gradient
"bg-gradient-to-br from-[#E1F0FF] to-[#F0F8FF]"

// Canvas dot color
ctx.fillStyle = `rgba(26, 188, 156, ${dot.opacity})`  // teal dots

// Route color
color: "#1ABC9C"

// Logo gradient
"bg-gradient-to-br from-[#1ABC9C] to-[#2563EB]"

// App name heading
"NexChat"

// Tagline
"Sign in to your secure workspace — messages, calls, and files, always encrypted."

// Heading gradient
"text-transparent bg-clip-text bg-gradient-to-r from-[#0A7A65] to-[#2563EB]"

// Submit button
"bg-gradient-to-r from-[#1ABC9C] to-[#2563EB] hover:from-[#17a589] hover:to-[#1d5ea8]"

// Input fields
"bg-[#F5F9FF] border-[#D6E8F5] text-[#0A0A0A] placeholder:text-[#6B7A99]
 focus:border-[#BAD9F5] focus:ring-[#E1F0FF]"

// Labels
"text-sm font-bold text-[#0A0A0A]"

// Card
"bg-white shadow-xl shadow-blue-100/40"

// Page background
"min-h-screen bg-[#F0F8FF]"
```

**Demo**:
```tsx
import Index from "@/components/ui/travel-connect-signin-1"
export default function LoginPage() { return <Index /> }
```

---

## Global CSS Additions

Add to `globals.css` (or `index.css` for Tailwind 4):

```css
/* Liquid Glass background animation */
@keyframes moveBackground {
  from { background-position: 0% 0%; }
  to   { background-position: 0% -1000%; }
}

/* Chat message list scroll */
.chat-messages {
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: #D6E8F5 transparent;
}
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb {
  background: #D6E8F5;
  border-radius: 999px;
}
```

---

## Integration Checklist

Before using any component from this skill file, verify:

- [ ] `@paper-design/shaders-react` installed for Theme 1 shader components
- [ ] `framer-motion` installed for any `motion.*` usage
- [ ] `lucide-react` installed for all icons
- [ ] `tailwindcss-animate` installed for Theme 6 auth form
- [ ] Component file placed in `/components/ui/`
- [ ] `"use client"` present if component uses hooks or browser APIs
- [ ] `GlassFilter` rendered once per page before any `GlassEffect` (Theme 3)
- [ ] `moveBackground` keyframe added to `globals.css` for Liquid Glass background
- [ ] Tailwind config `content` glob includes `/components/**`
- [ ] **Light app screens**: bg = `#F0F8FF`, text = `font-bold text-[#0A0A0A]`
- [ ] **Dark landing screens**: bg = `#000000`, text = `text-white font-light`
- [ ] Chat bubbles: sent = cream `#FFFDF5`, received = sky blue `#E1F0FF`
- [ ] Shadows use `shadow-blue-100/40` — never grey shadows in app UI
- [ ] No hardcoded pixel values — use Tailwind spacing scale

---

## Adding New Themes

When the developer provides a new component or theme:
1. Add `## Theme N — [Name]` section
2. Document: install, file path, use case, key props/details, NexChat customisation
3. Apply soft palette overrides in the customisation block
4. Update Integration Checklist if new dependencies are introduced
5. Never remove existing themes — only append

---
*Last updated: Themes 1–6 (Shader Backgrounds, Animated Text, Liquid Glass, Sidebar Nav, Multi-Orbit, Sign-In Map)*
