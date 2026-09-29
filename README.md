MindLab

Virtual Experiments. Real Opportunities.

MindLab is an interactive, AI-powered virtual science laboratory
designed to make practical, experiential learning accessible to students
even when a physical laboratory is unavailable, expensive, or difficult
to operate safely.

Built for Smart India Hackathon 2026 under the Smart Education theme
(SIH26207), MindLab combines 3D simulation, computer vision,
gesture-based interaction, AI guidance, and multilingual voice
interaction in a browser-based learning environment.

The Problem

Practical science education depends heavily on access to laboratory
infrastructure.

The UDISE+ 2024--25 figures referenced in our SIH proposal indicate that
only around 57% of schools have science-laboratory infrastructure. This
leaves a substantial gap in access to practical learning.

Physical laboratories also involve challenges such as:

High setup and equipment costs

Recurring costs for chemicals and consumables

Safety concerns

Limited access in under-resourced schools

Difficulty providing individual guidance to every student

Language barriers for some learners

MindLab addresses the access problem by providing a digital environment
where students can perform experiments, make mistakes safely, and learn
from the consequences.

Our Approach

MindLab is not simply a collection of virtual simulations.

The idea is to make the experience closer to actually learning in a
laboratory.

Students can interact with virtual apparatus using hand gestures,
perform experiments in a 3D environment, make mistakes, observe what
happens as a result, and understand why the action was incorrect.

An AI Lab Mentor can guide students through the experiment, answer
questions, and provide contextual explanations in English and supported
regional languages.

MindLab is intended to complement physical laboratories rather than
replace them.

Key Features

Gesture-Controlled Interaction

Students can interact with virtual laboratory elements using their hands
in front of a normal webcam.

Instead of relying entirely on click-based interaction, the system
translates hand movements into actions within the virtual laboratory.

Mistake-Aware Learning

A key part of MindLab is what happens when a student makes a mistake.

Rather than simply displaying an "Incorrect" message, the system is
designed to show the consequence of the incorrect action and explain why
it happened.

This turns mistakes into part of the learning process.

AI Lab Mentor

The AI Lab Mentor provides guidance while the student is performing an
experiment.

Students can ask questions about procedures, scientific concepts,
mistakes, and experimental outcomes without having to leave the
laboratory environment.

The longer-term goal is to make the mentor aware of the experiment and
the student's current state so that its responses remain relevant to
what is happening in the simulation.

Voice Interaction

During a lab session, students can use a voice trigger such as:

"Hello MindLab"

Browser speech recognition can detect the phrase and open the AI Lab
Mentor.

This allows the student to call for assistance without interrupting the
experiment.

Interactive 3D Learning

MindLab uses interactive 3D environments to represent scientific
concepts and laboratory procedures.

The prototype includes learning experiences such as human heart and
blood circulation anatomy, with the underlying approach designed to
support additional science experiments and modules.

Technical Architecture

MindLab is designed as a browser-first platform, minimizing the need for
specialized hardware.

                         Student
                    Webcam + Microphone
                            |
             +--------------+--------------+
             |                             |
             v                             v
      Hand Tracking                 Speech Recognition
        MediaPipe                    Browser Web Speech
             |                             |
             v                             |
      Gesture / Input                      |
          Engine                            |
             |                             |
             +--------------+--------------+
                            |
                            v
                  3D Virtual Laboratory
                    Three.js / R3F
                            |
                    Experiment State
                            |
                            v
                     AI Lab Mentor
                            |
                            v
                 Guidance / Explanation
                       / Voice

Core Technologies

Component        Technology / Approach

3D environment   Three.js / React Three Fiber
Hand tracking    MediaPipe
Voice trigger    Browser Speech Recognition API
Interaction      Gesture input with touch/click fallback
AI mentor        Context-aware AI assistance
Deployment       Browser-based web application

How the Learning Loop Works

The core interaction is designed around a continuous learning loop:

Perform Action
      |
      v
Experiment State Changes
      |
      v
Correct / Incorrect Action
      |
      v
Consequence Simulated
      |
      v
Explanation Provided
      |
      v
Student Understands
      |
      v
Try Again

The important distinction is that the system is not only simulating the
correct procedure. It is also designed to simulate what can happen when
a student does something incorrectly.

Why It Is Different

The differentiation is not simply the use of AI.

It is the combination of:

Gesture interaction + 3D simulation + mistake-aware learning + AI
guidance

A conventional digital learning experience often follows:

Read -> Watch -> Answer

MindLab aims for:

Interact -> Experiment -> Make a Mistake
                       |
                       v
                See the Consequence
                       |
                       v
                 Understand Why
                       |
                       v
                     Try

The goal is to make practical science an active learning experience
rather than a passive simulation.

Scalability

MindLab is built around a reusable experiment engine.

Once the core interaction and simulation infrastructure is established,
additional experiments can be added through:

New 3D assets

Experiment procedures

Scientific rules and outcomes

Curriculum mapping

Localized content

This allows the platform to expand incrementally across subjects,
grades, and curricula without rebuilding the entire system for every
experiment.

Accessibility and Deployment

The platform is designed to be:

Browser-based

Usable on standard laptops and PCs

Suitable for low-bandwidth environments

Capable of offline caching

Expandable to regional languages

Independent of specialized laboratory hardware

Gesture tracking can be affected by camera quality and lighting. To
address this, the system can use a confidence-based fallback from
gesture interaction to touch or click controls when tracking is
unreliable.

Safety

Virtual experiments provide a controlled environment for exploring
procedures that may involve chemicals, heat, biological specimens,
fragile equipment, or other laboratory risks.

Students can experiment and make mistakes without exposing themselves or
physical laboratory equipment to those risks.

The aim is not to replace hands-on physical laboratories, but to provide
an accessible practical-learning environment where physical
infrastructure is limited.

Educational Alignment

MindLab is positioned around the broader shift toward:

Experiential learning

Inquiry-based learning

Competency-based education

Digital learning

Multilingual education

Technology-enabled access

The project is developed for the Smart Education theme of Smart India
Hackathon 2026 and is positioned in line with the experiential-learning
direction emphasized in NEP 2020.

Roadmap

Phase 1 --- Core Experience

Gesture-controlled experiments

Interactive 3D laboratory

Mistake-aware learning

AI Lab Mentor

Phase 2 --- Accessibility

Additional Indian languages

Voice-first interaction

Improved support for lower-end devices

Offline-first capabilities

Phase 3 --- Teacher Support

Student performance analytics

Experiment completion tracking

Common-mistake analysis

Competency dashboards

Phase 4 --- Scale

Additional NCERT-aligned experiments

Additional science subjects

Curriculum mapping

Partnerships with schools, NGOs, and education bodies

Example User Journey

Student opens MindLab
        |
        v
Selects an experiment
        |
        v
Enters the 3D laboratory
        |
        v
Uses hand gestures to interact
        |
        v
Performs the experiment
        |
        v
Makes an incorrect step
        |
        v
MindLab simulates the consequence
        |
        v
AI Mentor explains what happened
        |
        v
Student asks questions using voice
        |
        v
Student retries the experiment
        |
        v
Experiment completed

Smart India Hackathon 2026

Problem Statement: SIH26207
Theme: Smart Education
Category: Software
Team: MindLab

Our proposition

Practical science should not depend entirely on whether a school can
afford a laboratory.

MindLab aims to make experimentation more interactive, safe,
intelligent, multilingual, and scalable.

References

The SIH proposal references the following sources:

UDISE+ 2024--25 --- science laboratory access and school
infrastructure

CIET--NCERT --- integration of virtual labs into teaching-learning

Natural User Interfaces in Virtual Chemical Laboratories ---
research on gesture-based virtual laboratory interaction

Intelligent Virtual Laboratory Design for Science Education

Physics Teachers' Use of Generative AI and Simulations for Science
Teaching

UNESCO --- State of the Education Report for India 2022: Artificial
Intelligence in Education

Team MindLab

Built for Smart India Hackathon 2026.

Problem Statement: SIH26207
Theme: Smart Education

Virtual Experiments. Real Opportunities.

Every student should have the opportunity to learn science by doing it.
