## **Project: Interactive 3D Portal (Act 1 – Future Jack Launch)**

### **Objective**

Build a **real-time, shader-driven 3D vortex portal** (not a static model) that creates a cinematic “dimensional gateway” experience synced precisely to audio.

---

## **Tech Stack**

- **Frontend:** Next.js
- **3D Layer:** React Three Fiber (R3F) + Three.js
- **Audio Engine:** Howler.js (already implemented)
- **Deliverable:** Modular **R3F React component**

---

## **Core Requirements**

### **1. Visual System**

- Procedural **vortex/tunnel (true depth, not flat ring)**
- Shader-based:
  - Glow
  - Distortion
  - Depth layering

- **Particles:**
  - Inward spiral motion (NOT outward burst)
  - Acceleration during tension phase

- Multi-layer structure:
  - Outer ring field
  - Inner vortex core
  - Mid turbulence layer

---

### **2. Animation + Timeline (Audio Synced)**

**0:00 – 0:01**

- Portal already visible (no fade-in)
- Slight camera push forward

**0:01 – 0:02.5**

- Energy build-up
- Increasing depth
- Inward particle motion

**0:02.5 – 0:04**

- Pre-tension phase
- Increased vortex depth
- Subtle distortion begins

**0:04 – 0:05.8 (CORE PHASE)**

- Strong inward pull
- Deep tunnel stretch
- Particle acceleration (streaking)
- Camera acceleration (ease-in)
- “Loss of control” feeling

**0:05.8 – 0:06.3**

- Final breakthrough (WHOOOMP)
- Forward snap into portal
- Controlled flash + distortion

**0:06.3 – 0:07**

- Arrival phase
- Transition to new environment
- Motion stabilizes (no hard cut)

---

### **3. Audio Integration**

- Manual timestamp mapping (no auto-detection)
- Shader uniform exposed:
  - `uProgress` (0 → 1 timeline driver)

- All animation phases driven by this value

---

### **4. Camera Behavior**

- Continuous forward motion
- Acceleration during drag phase
- Final snap into portal
- Critical for immersion

---

### **5. Performance Constraints**

- Asset size **< 2.5MB**
- Minimal geometry
- Heavy use of **GLSL + math (procedural)**
- Optimized for **desktop + mobile**

---

## **Deliverable (Phase 1)**

- Working **real-time prototype**
- Demonstrates:
  - Depth
  - Motion
  - Pull force
  - Audio sync

- Delivered as:
  - R3F component (plug-and-play)
  - OR standalone demo (initial)

---

## **Key Success Criteria**

- Feels like **entering a portal**, not watching an effect
- Strong **depth + inward pull**
- Cinematic **build → tension → breakthrough → arrival**
- Smooth **audio-visual sync**

---

## **Future Scope**

- Part of larger narrative system (**Future Jack – Act 1**)
- Potential long-term work across all 8 Acts if successful
