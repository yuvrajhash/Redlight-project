# YUV Cognitive Architecture

YUV's cognition layer turns the voice agent from a stateless session into a persistent,
evidence-aware system. This first version deliberately implements a small, inspectable cognitive
kernel instead of presenting an LLM as consciousness.

## Implemented cognitive layers

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
- **Goal graph (v2)**: durable goals contain a definition of success, priority, constraints, status,
  and dependency-linked plan steps.
- **Safe action state (v2)**: plan steps move through pending, approval, in-progress, and terminal
  states. High and critical risk steps require approval regardless of the model's suggestion.
- **Outcome reflection (v2)**: completing or failing a step compares the predicted result with the
  observed result and writes a linked reflection memory.
- **Entity graph (v3)**: people, organizations, products, places, projects, events, and concepts are
  represented as durable entities connected by evidence-bearing relationships.
- **Semantic association (v3)**: a dependency-free local feature-hashing vector links related wording
  and graph neighborhoods without sending private knowledge to an embedding service.
- **Temporal belief revision (v3)**: relationships carry validity windows. Stronger conflicting
  evidence supersedes weaker beliefs, similarly credible conflicts remain contested, and
  non-overlapping historical facts coexist.
- **Structural secret rejection (v3)**: common credential, private-key, OTP, and payment-card patterns
  are rejected before an entity or relationship can enter the knowledge graph.

Memory is stored under Electron's per-user application-data directory. The goal graph, knowledge,
world model, skills, and self-model use separate snapshots. Every snapshot is encrypted with the
operating system's secure storage, written atomically, and backed by the last valid snapshot for
crash recovery. Legacy plaintext snapshots migrate in place after a successful secure read.

## Runtime flow

1. Completed user and assistant voice turns create episodic/reflection memories.
2. Screen observations expire after one day; live-search facts expire after seven days.
3. Computer-control outcomes become procedural memories.
4. At session start, YUV retrieves recent and relevant memories and labels them as fallible
   context in the system instructions.
5. During a session, `recall_memory`, `remember_this`, and `audit_memory` give the realtime agent
   explicit memory operations.
6. Consolidation runs every fifteen minutes and can also be initiated by the user.
7. Explicit goals are decomposed into dependency-aware steps. YUV checks the graph before resuming
   work and records the real outcome after each attempted step.
8. A risky step cannot start until it enters `waiting_approval` and consumes a fresh user approval
   received after the approval request.
9. Stable user statements and verified results can be extracted into subject-predicate-object
   relationships. Duplicate evidence reinforces a connection; contradiction triggers belief revision.
10. Session context includes relevant graph relationships, clearly labeling contested knowledge.

## Safety boundaries

- Recalled memory is context, not unquestionable truth.
- Time-sensitive claims still require live verification.
- Explicit memory rejects secrets at the prompt/tool layer; structural secret detection protects
  graph storage and every persisted cognitive snapshot is encrypted at rest.
- OpenAI computer-use safety checks are never acknowledged automatically. The current safe behavior
  is to stop before the action and request explicit approval. Resumable approval is planned.
- A goal is intent to pursue an outcome, not blanket permission. Current user instructions, operating
  system permissions, and per-action approval gates always take precedence.
- Voice approval is short-lived, single-use, and valid only when captured after the matching step
  requested approval.
- Semantic similarity is a retrieval signal, not evidence. Graph confidence and status remain
  evidence-driven, and externally changing facts still require live verification.
- “Forget All” clears memories, goals, plans, entities, and relationships together.
- The renderer can save or delete an API key but can no longer request the decrypted key.

## Next cognitive milestones

1. Scheduled reflection jobs across related goals and outcomes.
2. Learned procedures with success/failure statistics and safe rehearsal.
3. User-visible goal, knowledge, and memory browser with granular editing and deletion.
4. Optional provider embeddings for deeper semantic recall, with explicit privacy controls.
5. Configurable per-modality retention and granular deletion.
6. Optional cross-device sync through an authenticated, end-to-end-encrypted backend.

This architecture does not claim consciousness, feelings, or biological equivalence. It provides
the testable mechanics required for persistent perception, memory, recall, audit, and learning.
