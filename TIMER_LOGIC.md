# Timer Logic

## Goal

The timer must support mixed workout steps.

A workout step can be:

- Time-based
- Repetition-based

Time-based steps auto-complete after countdown.

Repetition-based steps wait for the user to click `Done`.

## Timer Phases

```ts
type TimerPhase =
  | "idle"
  | "exercise_time"
  | "exercise_reps"
  | "break"
  | "paused"
  | "completed"
  | "stopped";
```

## Runtime State

```ts
type WorkoutRuntimeState = {
  phase: TimerPhase;
  previousPhase?: TimerPhase;
  currentRound: number;
  totalRounds: number;
  currentStepIndex: number;
  remainingSeconds: number;
  startedAt?: string;
  completedAt?: string;
};
```

## Start Flow

1. User clicks `Start`.
2. Set current round to `1`.
3. Set current step index to `0`.
4. Load first workout step.
5. Announce the exercise.
6. If step type is `time`, start countdown.
7. If step type is `reps`, wait for user action.

## Time-Based Step Flow

Example:

```text
Dead Bug - 45 seconds
Break - 15 seconds
```

Flow:

1. Announce: `Next, Dead Bug for 45 seconds.`
2. Start countdown at `45`.
3. Decrement every second.
4. When countdown reaches `0`, move to break.
5. Announce: `Break time, 15 seconds.`
6. Start break countdown.
7. When break reaches `0`, move to next step.

## Reps-Based Step Flow

Example:

```text
Bench Press - 20 reps
Break - 15 seconds
```

Flow:

1. Announce: `Now let's do Bench Press, 20 reps.`
2. Display target reps.
3. Show large `Done` button.
4. Wait until user clicks `Done`.
5. Move to break.
6. Announce: `Break time, 15 seconds.`
7. Start break countdown.
8. When break reaches `0`, move to next step.

## Break Flow

1. Start countdown from configured break seconds.
2. When countdown reaches `0`:
   - If there is a next step, start next step.
   - If no next step and another round exists, increment round and start first step.
   - If no next step and no round remains, complete workout.

## Pause Flow

1. User clicks `Pause`.
2. Store previous phase.
3. Set phase to `paused`.
4. Stop countdown.
5. User clicks `Resume`.
6. Restore previous phase.
7. Continue countdown if previous phase was time or break.

## Stop Flow

1. User clicks `Stop`.
2. Ask for confirmation.
3. Stop timer.
4. Mark session as incomplete unless user chooses to save partial session.

## Completion Flow

1. Set phase to `completed`.
2. Announce: `Workout complete. Great job.`
3. Save session.
4. Show session summary.

## Important Edge Cases

### Break is 0 seconds

If break duration is `0`, skip break and immediately move to next step.

### Empty workout

Do not allow starting an empty workout.

### Browser tab inactive

Timer should calculate remaining time using timestamps, not only `setInterval`.

Preferred logic:

```ts
targetEndTime = Date.now() + remainingSeconds * 1000;
remainingSeconds = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
```

This prevents timer drift.

### Speech overlap

Before speaking a new phrase, cancel the previous speech.

```ts
window.speechSynthesis.cancel();
```

Then speak the new announcement.
