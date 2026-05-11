# First Prompt for Codex

You are building a Dockerized React + TypeScript web app called Workout.

Read all Markdown files in this repository before coding:

- README.md
- PROJECT_SPEC.md
- ARCHITECTURE.md
- DATA_MODEL.md
- TIMER_LOGIC.md
- VOICE_ANNOUNCEMENTS.md
- DOCKER_REQUIREMENTS.md
- CODEX_TASKS.md
- .github/copilot-instructions.md

Build the MVP described in those files.

Hard requirements:

1. Use React + TypeScript + Vite.
2. Use localStorage through an async storage abstraction.
3. Include an exercise library with add/edit/delete.
4. Preload common exercises.
5. Include a workout builder.
6. Allow exercises to be added to a workout plan.
7. Allow workout steps to be reordered with drag and drop.
8. Support mixed step types:
   - time-based steps
   - reps-based steps
9. Time-based steps must auto-complete after countdown.
10. Reps-based steps must wait for the user to click Done.
11. Each step must support its own break duration.
12. Each step may support optional weight.
13. Workout plans must support multiple rounds.
14. Add voice announcements using the browser Web Speech API.
15. Save completed workout sessions to history.
16. Add a history page.
17. Add a settings page for voice on/off and voice rate/pitch/volume.
18. Add Docker production deployment.
19. App must run on port 8060 using docker compose.
20. Fix all TypeScript, lint, and build errors.

Implementation preference:

- Keep the first version simple but fully working.
- Do not add backend/auth/cloud sync.
- Do not integrate external AI voice APIs.
- Use templates for trainer-like voice announcements.
- Use Nginx to serve the built static app.
- Make the UI mobile-friendly and usable during workouts.

After implementation, run:

```bash
npm run build
docker compose up -d --build
curl -I http://localhost:8060
```

Then report:

- What was created
- How to run it
- Any remaining limitations
