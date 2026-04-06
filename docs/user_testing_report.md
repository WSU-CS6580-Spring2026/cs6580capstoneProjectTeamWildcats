# User Testing Report — Sprint 5 (CS-6580)

**Project:** Snowbasin Traffic Assistant  
**Progress Sync Milestone:** March 31, 2026  
**Testing Window:** March 29–31, 2026  
**Prepared by:** Team Wildcats (combined from individual tester reports)

## 1) Testing Overview
This report consolidates three separate user-testing sessions into one Sprint 5 testing deliverable. Each participant was asked to use the application to plan traffic conditions for Snowbasin and complete prediction-related tasks while being observed without assistance.

- **Total participants represented in this combined report:** 3
- **Observation method:** Live observation + think-aloud comments during use
- **Session evidence:** Screen recordings were captured and retained by the team for review

## 2) Participant Snapshots

### Participant EG (report by Roberto Camposeco)
- Hesitated to use Google sign-in due to trust concerns on an unknown site, then continued as guest.
- Explored dashboard controls and quick suggestions first.
- Was unclear about the difference between **Random Forest** vs **LSTM**.
- Preferred returning to the main dashboard repeatedly using “go back.”
- Suggested moving **How it works** to the top.
- Suggested moving chat input to a central location, “like ChatGPT.”

### Participant HZ Tester 1 (report by Hazem Dawahi, March 29, 2026)
- Successfully used key workflow elements but described dashboard as visually crowded.
- Reported chat responses were too long for quick decision-making.
- Recommended improved visual hierarchy/contrast in the color scheme.
- Positive notes: liked calendar date picker and quick-link cards.

### Participant MC (report by Dani)
- Did not understand model labels (**Random Forest**, **LSTM**) and initially guessed their meaning.
- Needed to scroll through dense content to find chat input and instructions.
- Encountered confusion around required query format and prediction flow (chat vs selecting date/time + clicking predict).
- Found snowflake visuals somewhat distracting and not obviously controllable.
- Reported readability issue with white text on light blue background in results.

## 3) Consolidated Findings (Across All Sessions)

### A. Information Architecture & Layout Friction (High)
Users repeatedly reported a crowded interface and unclear visual priority. Important workflow controls (chat input, instructions, predict path) were not obvious enough at first glance.

**Observed patterns:**
- “Too much at once” feeling on dashboard.
- Users had to scroll/search for primary controls.
- “How it works” and guidance content were discovered too late.

### B. Model Terminology Confusion (High)
Non-technical users did not understand **Random Forest** and **LSTM** labels, and in some cases selected defaults without confidence.

**Observed patterns:**
- Users asked or inferred incorrect meanings.
- Model choice added cognitive load before core task completion.

### C. Prediction Workflow Clarity Gaps (High)
Users expected the chat assistant alone to produce final predictions, but actual flow often required additional structured inputs (date/time selection and clicking predict).

**Observed patterns:**
- Repeated re-prompts from chat requesting more details.
- Confusion about which action actually triggers prediction output.

### D. Content Density of Responses (Medium)
At least one participant explicitly requested shorter responses; observed behavior suggests concise answers would support faster decision-making.

### E. Visual/Accessibility Issues (Medium)
Participants noted readability and contrast concerns (e.g., white text on light blue), and mild distraction from snowflake effects.

### F. Trust & Onboarding Context (Medium)
One participant hesitated at login due to perceived trust risk; participants also needed a clearer top-level statement of app purpose and usage expectations.

## 4) Positive Usability Signals
- Quick-link suggestion cards helped users start common tasks.
- Calendar date picker was positively received.
- KPI-style outputs (traffic/weather indicators) were viewed as useful.

## 5) Prioritized Refinement Backlog (Sprint 5)

| Priority | Refinement | Why |
|---|---|---|
| P0 | Add a short onboarding block at the top (“What this app does” + “How to get a prediction in 3 steps”). | Directly addresses workflow confusion and discovery issues. |
| P0 | Simplify model selection UI for non-technical users (e.g., “Standard mode” default; advanced model selector optional). | Removes confusion around Random Forest/LSTM terminology. |
| P0 | Make primary prediction controls immediately visible above the fold (chat + date/time + predict action clarity). | Reduces scrolling/search and task failure. |
| P1 | Shorten default chat responses; add “Show more details” option. | Supports quick decision-making while preserving depth. |
| P1 | Reorganize dashboard sections (group/collapse lower-priority content). | Reduces clutter and improves visual hierarchy. |
| P1 | Improve text/background contrast in results and key UI surfaces; run accessibility checks. | Fixes readability and accessibility concerns. |
| P2 | Make snowflake toggle more obvious or default snowflake animation to off. | Reduces distraction for task-focused users. |
| P2 | Improve login trust messaging (brief privacy/sign-in reassurance). | Addresses hesitation around account sign-in. |

## 6) Scope & Compliance Statement
This file fulfills the Sprint 5 requirement to provide a combined user testing report at `docs/user_testing_report.md`, based on tester observations from outside the immediate active development workflow. Session recordings are stored by the team and remain available for instructor review.

## 7) Next-Step Acceptance Criteria (for Sprint 6 carryover)
- First-time users can complete one traffic prediction without external help.
- Users can identify where to enter inputs within 10 seconds of landing on dashboard.
- Model-selection confusion is reduced via user-friendly labeling/defaults.
- Core UI passes basic contrast/accessibility checks on primary screens.
