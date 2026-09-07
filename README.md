import pypandoc
from pathlib import Path

markdown = r'''# 🧪 MindLab

### **Virtual Experiments. Real Opportunities.**

> **Making practical science accessible beyond the walls of a physical laboratory.**

MindLab is an interactive, AI-powered virtual science laboratory designed to make **hands-on, experiential learning** accessible to students even when a physical laboratory is unavailable, expensive, or difficult to operate safely.

Built for **Smart India Hackathon 2026 — Smart Education (SIH26207)**, MindLab combines **3D simulation, computer vision, gesture-based interaction, AI guidance, and multilingual voice interaction** into a single browser-based learning environment.

---

## 🎯 The Problem

Practical science education depends heavily on access to laboratory infrastructure.

According to the UDISE+ 2024–25 figures referenced in our SIH proposal, only around **57% of schools have science-laboratory infrastructure**, leaving a substantial infrastructure gap.

Traditional physical laboratories also face challenges such as:

- 💰 High setup and equipment costs
- 🧪 Recurring costs for chemicals and consumables
- ⚠️ Safety risks during experiments
- 🏫 Limited access in under-resourced schools
- 👨‍🏫 Difficulty providing individual guidance to every student
- 🌐 Language barriers for some learners

MindLab addresses the access problem by providing a digital environment in which students can **perform, experiment, make mistakes, and learn from them**.

---

## 💡 Our Solution

MindLab is **not just another click-based virtual laboratory**.

The core idea is:

> **Don't just simulate the correct experiment. Simulate the learning process.**

Students can:

- ✋ Interact with virtual laboratory elements using hand gestures
- 🔬 Perform simulated experiments in an interactive 3D environment
- ❌ Make mistakes safely
- 💥 See the consequences of incorrect actions
- 🧠 Understand *why* the mistake happened
- 🤖 Ask an AI Lab Mentor for contextual help
- 🗣️ Interact through voice
- 🌏 Receive guidance in English and supported regional languages
- 👩‍🏫 Enable teachers to monitor experiment performance and student progress

MindLab is designed to **complement physical laboratories, not replace them**.

---

# ✨ Key Features

## ✋ Gesture-Controlled Interaction

Students can interact with virtual experiments using their hands in front of a normal webcam.

Instead of relying entirely on:

`Click → Drag → Select → Repeat`

MindLab aims for:

`Move → Grab → Pour → Mix → Experiment`

Hand tracking is used to translate natural movements into interactions with the virtual environment.

---

## 🧠 Mistake-Aware Learning

One of MindLab's core educational differentiators.

A conventional simulation may simply respond:

> ❌ Incorrect step.

MindLab aims to answer:

> **What happened because you did that? Why was it wrong? What should you do next?**

Incorrect actions can therefore become learning opportunities rather than simple failures.

### Learning loop

```text
Perform Action
      ↓
Experiment State Changes
      ↓
Mistake / Correct Action Detected
      ↓
Consequence Simulated
      ↓
Explanation Provided
      ↓
Student Understands
      ↓
Try Again
