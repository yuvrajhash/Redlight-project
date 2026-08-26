# YUV cognitive runtime

YUV's cognitive runtime is a persistent, inspectable architecture around the foundation model. It is not consciousness and it does not let the model rewrite its own code.

## Cognitive cycle

The runtime processes events through a bounded cycle:

1. Language, vision, audio, application, system, and tool events enter the perception buffer.
2. Attention scoring retains user-directed, novel, urgent, or risky events and filters routine noise.
3. Attended events become evidence-backed memories and may update explicitly identified world entities.
4. The planner supplies dependency-ready candidate actions.
5. The skill library retrieves related procedures but exposes candidate and risky skills as non-autonomous.
6. Outcomes update memory, skill confidence, and the self-model.
7. Periodic sleep cycles consolidate memory, prune stale transient state, promote repeatedly verified procedures, and surface contested beliefs.

No cycle executes a candidate action by itself. Execution remains behind the existing tool and permission boundary.

## Persistent subsystems

- Episodic, semantic, procedural, self, and reflection memory
- Temporal semantic knowledge graph with contested beliefs
- Goal and dependency planner
- Current-state world model with change provenance
- Demonstration-based procedural skill library
- Capability self-model and confidence calibration
- Reasoning audits with assumptions and evidence

Data is stored under Electron's local `userData` directory. **Forget all** clears every persistent cognitive subsystem and the volatile perception queue.

## Safety boundary

- High and critical actions require fresh, action-specific user approval.
- OpenAI computer-use safety checks are never acknowledged automatically.
- Candidate procedures need two observed successes before verification.
- Verified high-risk procedures still require approval for every run.
- `Ctrl/Cmd + Shift + F12` immediately locks computer control and cancels the active computer-use loop.
- Resetting the emergency stop requires an explicit user action in Settings.
- Computer tasks retain the existing step limit and screen refresh loop.
- The selected display is matched by Electron display ID, and pointer coordinates use that display's real bounds.
- Onboarding cannot complete without the required microphone, screen-recording, and accessibility permissions on supported platforms.
- Legacy plaintext API-key entries are deleted instead of decrypted or reused.
- Update metadata targets the owner-controlled GitHub repository; installation still requires a signed release.

## Honest limits

The runtime does not establish consciousness, emotions, unrestricted general intelligence, or perfect self-learning. World state is only as current as its last observation. Natural-language risk classification is defence in depth, not a substitute for operating-system isolation. Signed installers, macOS notarization, external security review, and platform-specific native input testing still require release credentials and real target machines.
