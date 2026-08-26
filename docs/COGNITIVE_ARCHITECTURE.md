# Friday Cognitive Architecture

Friday's cognition layer turns the voice agent from a stateless session into a persistent,
evidence-aware system. This first version deliberately implements a small, inspectable cognitive
kernel instead of presenting an LLM as consciousness.

## Implemented in v1

- **Working memory**: a bounded, in-process workspace for attended observations.
- **Long-term memory**: locally persisted episodic, semantic, procedural, self, and reflection
  memories.
- **Attention**: observations are scored using source, user direction, novelty, risk, and stated
  salience. Low-value observations remain temporary.
- **Recall**: lexical relevance, recency, confidence, salience, and reinforcement determine which
  memories enter a voice session.
- **Evidence**: memories keep source, observation time, optional reference, and excerpt metadata.
- **Internal audit**: a claim can be checked for supporting and conflicting memories. This is an
  internal-consistency check, not a replacement for external verification.
- **Consolidation**: repeated memories reinforce one canonical record, expired observations are
  removed, and low-retention memories are archived when the active limit is exceeded.
- **Forgetting controls**: the settings panel exposes consolidation and explicit deletion of all
  cognitive memory.

Memory is stored in `cognition-v1.json` under Electron's per-user application-data directory. The
file is written atomically. API keys and secrets must never be stored as cognitive memories.

## Runtime flow

1. Completed user and assistant voice turns create episodic/reflection memories.
2. Screen observations expire after one day; live-search facts expire after seven days.
3. Computer-control outcomes become procedural memories.
4. At session start, Friday retrieves recent and relevant memories and labels them as fallible
   context in the system instructions.
5. During a session, `recall_memory`, `remember_this`, and `audit_memory` give the realtime agent
   explicit memory operations.
6. Consolidation runs every fifteen minutes and can also be initiated by the user.

## Safety boundaries

- Recalled memory is context, not unquestionable truth.
- Time-sensitive claims still require live verification.
- Explicit memory rejects an instruction to store secrets at the prompt/tool layer; structural
  secret detection and encrypted memory storage remain future hardening work.
- OpenAI computer-use safety checks are never acknowledged automatically. The current safe behavior
  is to stop before the action and request explicit approval. Resumable approval is planned.
- The renderer can save or delete an API key but can no longer request the decrypted key.

## Next cognitive milestones

1. Goal graph and resumable plans.
2. Model-assisted entity extraction and semantic embeddings.
3. Belief revision using evidence provenance and temporal validity.
4. Reflection jobs that compare predictions with observed outcomes.
5. Learned procedures with success/failure statistics and safe rehearsal.
6. User-visible memory browser, per-memory deletion, export, and retention policies.
7. Encrypted cognitive storage and configurable privacy modes.
8. Cross-device sync through an authenticated, end-to-end-encrypted backend.

This architecture does not claim consciousness, feelings, or biological equivalence. It provides
the testable mechanics required for persistent perception, memory, recall, audit, and learning.
