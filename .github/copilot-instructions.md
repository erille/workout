# Copilot / Codex Instructions

This project is a local-first Workout web app.

## Main Requirement

Build a React + TypeScript web app that lets users:

1. Manage exercises.
2. Build workout plans.
3. Reorder workout steps with drag and drop.
4. Run mixed workout timers.
5. Use voice announcements.
6. Save workout session history.
7. Run the app in Docker on port `8060`.

## Important Product Rules

A workout is an ordered list of steps.

A step can be:

- Time-based
- Repetition-based

Time-based steps run automatically.

Repetition-based steps wait for the user to press `Done`.

Each step has its own break duration.

The full workout can repeat for multiple rounds.

## Coding Rules

- Use TypeScript.
- Prefer small reusable components.
- Keep business logic out of JSX when possible.
- Put timer logic in hooks/services.
- Put browser speech logic in a speech service.
- Put persistence logic in a storage service.
- Use localStorage first, but wrap it in async APIs.
- Use clear model files.
- Avoid unnecessary dependencies.
- Do not add authentication.
- Do not add a backend.
- Do not add cloud sync.
- Do not integrate paid TTS APIs in MVP.

## UI Rules

- The timer screen must be large and readable.
- Buttons must be easy to tap on mobile.
- Use a clean dark theme by default.
- Keep forms simple.
- Show validation errors clearly.

## Docker Rules

The app must run with:

```bash
docker compose up -d --build
```

The app must be reachable at:

```bash
http://localhost:8060
```

Use Nginx to serve the built static app.
