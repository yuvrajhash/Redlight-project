import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  CognitiveContext,
  CognitionStats,
  ConsolidationResult,
  MemoryQuery,
  MemoryAuditResult,
  MemoryDetail,
  MemoryListQuery,
  MemoryRecordInput,
  MemorySummary,
  MemoryUpdate,
  ObservationInput
} from '../shared/cognition'
import type {
  Goal,
  GoalInput,
  GoalPlanInput,
  GoalQuery,
  GoalStatus,
  GoalUpdate,
  NextAction,
  PlanStep,
  PlanningStats,
  StepResolution
} from '../shared/planning'
import type {
  BeliefFact,
  BeliefInput,
  KnowledgeQuery,
  KnowledgeQueryResult,
  KnowledgeStats
} from '../shared/knowledge'
import type {
  CapabilityInput,
  CapabilityRecord,
  CognitiveCycleResult,
  PerceptionEvent,
  PerceptionEventInput,
  ReasoningAudit,
  ReasoningAuditInput,
  RuntimeStats,
  SkillInput,
  SkillMatch,
  SkillOutcome,
  SkillRecord,
  SleepReport,
  WorldEntityInput,
  WorldSnapshot
} from '../shared/runtime'
import type { ActionAuditEntry } from '../shared/runtime'
import type { CognitiveControlSnapshot, PrivacySettings } from '../shared/control-centre'

export type { PrivacySettings } from '../shared/control-centre'

export type KnownService = 'livekit' | 'openai' | 'google' | 'sarvam'

export type ProviderConfig = {
  llm: string
  stt: string
  tts: string
}

export type DisplayChoice = {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
  selected: boolean
}

export type ComputerAction = {
  action: 'move' | 'click' | 'double_click' | 'right_click' | 'type' | 'key' | 'scroll' | 'drag'
  x?: number
  y?: number
  text?: string
  keys?: string
  direction?: 'up' | 'down'
  amount?: number
  path?: Array<{ x: number; y: number }>
}

export type VisionMode = 'subagent' | 'direct'
export type ControlBrain = 'openai-cua' | 'realtime'

export type AgentConfig = {
  systemPrompt: string
  visionMode: VisionMode
  controlBrain: ControlBrain
  voice: string
}

export type YUVAPI = {
  ping: () => void
  log: (scope: string, message: string) => void
  completeOnboarding: () => Promise<void>
  realtime: {
    mintEphemeralKey: () => Promise<{ value: string; model: string }>
  }
  cognition: {
    remember: (input: MemoryRecordInput) => Promise<MemorySummary | null>
    observe: (input: ObservationInput) => Promise<MemorySummary | null>
    recall: (query: MemoryQuery) => Promise<MemorySummary[]>
    context: (query: MemoryQuery) => Promise<CognitiveContext>
    audit: (claim: string) => Promise<MemoryAuditResult>
    stats: () => Promise<CognitionStats>
    list: (query?: MemoryListQuery) => Promise<MemoryDetail[]>
    update: (id: string, update: MemoryUpdate) => Promise<MemoryDetail>
    delete: (id: string) => Promise<boolean>
    consolidate: () => Promise<ConsolidationResult>
    clear: () => Promise<void>
  }
  knowledge: {
    learn: (input: BeliefInput) => Promise<BeliefFact>
    query: (query: KnowledgeQuery) => Promise<KnowledgeQueryResult>
    inspectEntity: (entityId: string) => Promise<KnowledgeQueryResult>
    stats: () => Promise<KnowledgeStats>
    list: (limit?: number) => Promise<KnowledgeQueryResult>
    deleteBelief: (id: string) => Promise<boolean>
    deleteEntity: (id: string) => Promise<boolean>
  }
  planning: {
    createGoal: (input: GoalInput) => Promise<Goal>
    setPlan: (input: GoalPlanInput) => Promise<Goal>
    listGoals: (query?: GoalQuery) => Promise<Goal[]>
    nextActions: (limit?: number) => Promise<NextAction[]>
    approveStep: (goalId: string, stepId: string, userConfirmed: boolean) => Promise<PlanStep>
    beginStep: (goalId: string, stepId: string) => Promise<PlanStep>
    resolveStep: (
      goalId: string,
      stepId: string,
      outcome: string,
      succeeded: boolean
    ) => Promise<StepResolution>
    setGoalStatus: (goalId: string, status: GoalStatus) => Promise<Goal>
    stats: () => Promise<PlanningStats>
    updateGoal: (id: string, update: GoalUpdate) => Promise<Goal>
    deleteGoal: (id: string) => Promise<boolean>
  }
  runtime: {
    ingest: (input: PerceptionEventInput) => Promise<PerceptionEvent | null>
    cycle: () => Promise<CognitiveCycleResult>
    sleep: () => Promise<SleepReport>
    stats: () => Promise<RuntimeStats>
    updateWorld: (input: WorldEntityInput) => Promise<unknown>
    worldSnapshot: () => Promise<WorldSnapshot>
    learnSkill: (input: SkillInput) => Promise<SkillRecord>
    matchSkills: (query: string, limit?: number) => Promise<SkillMatch[]>
    recordSkillOutcome: (input: SkillOutcome) => Promise<SkillRecord>
    updateCapability: (input: CapabilityInput) => Promise<CapabilityRecord>
    auditReasoning: (input: ReasoningAuditInput) => Promise<ReasoningAudit>
    selfSnapshot: () => Promise<{
      capabilities: CapabilityRecord[]
      recentAudits: ReasoningAudit[]
    }>
    emergencyStop: () => Promise<void>
    resetEmergencyStop: (userConfirmed: boolean) => Promise<void>
  }
  getAgentConfig: () => Promise<AgentConfig>
  captureScreen: () => Promise<{ image: string }>
  describeScreen: (question: string) => Promise<string>
  webSearch: (query: string) => Promise<{ started: boolean; busy?: boolean }>
  computerAction: (action: ComputerAction) => Promise<{ ok: boolean; error?: string }>
  controlComputer: (task: string, approved?: boolean) => Promise<string>
  skills: {
    list: () => Promise<SkillRecord[]>
    setStatus: (id: string, status: SkillRecord['status']) => Promise<SkillRecord>
    delete: (id: string) => Promise<boolean>
  }
  actions: {
    list: (limit?: number) => Promise<ActionAuditEntry[]>
    delete: (id: string) => Promise<boolean>
  }
  controlCenter: {
    open: () => Promise<void>
    snapshot: () => Promise<CognitiveControlSnapshot>
    export: () => Promise<{ exported: boolean; filePath?: string }>
  }
  displays: {
    list: () => Promise<DisplayChoice[]>
    select: (displayId: number | null) => Promise<void>
  }
  store: {
    initialOnboardingComplete: boolean
    isOnboardingComplete: () => Promise<boolean>
    setOnboardingComplete: (value: boolean) => Promise<void>
    saveApiKey: (service: KnownService, key: string) => Promise<void>
    deleteApiKey: (service: KnownService) => Promise<void>
    validateGoogleKey: (key: string) => Promise<boolean>
    validateOpenAiKey: (key: string) => Promise<boolean>
    getProviderConfig: () => Promise<ProviderConfig>
    setProviderConfig: (config: ProviderConfig) => Promise<void>
    getPrivacySettings: () => Promise<PrivacySettings>
    setPrivacySettings: (settings: PrivacySettings) => Promise<void>
    resetStore: () => Promise<void>
  }
  permissions: {
    getMicStatus: () => Promise<string>
    requestMicAccess: () => Promise<boolean>
    openMicSettings: () => Promise<void>
    getScreenStatus: () => Promise<string>
    openScreenSettings: () => Promise<void>
    getAccessibilityStatus: (prompt?: boolean) => Promise<boolean>
    openAccessibilitySettings: () => Promise<void>
    triggerInputMonitoringPrompt: () => Promise<void>
    openInputMonitoringSettings: () => Promise<void>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: YUVAPI
  }
}

export {}
