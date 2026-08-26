import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  CognitiveContext,
  CognitionStats,
  ConsolidationResult,
  MemoryQuery,
  MemoryAuditResult,
  MemoryRecordInput,
  MemorySummary,
  ObservationInput
} from '../shared/cognition'
import type {
  Goal,
  GoalInput,
  GoalPlanInput,
  GoalQuery,
  GoalStatus,
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

export type KnownService = 'livekit' | 'openai' | 'google' | 'sarvam'

export type ProviderConfig = {
  llm: string
  stt: string
  tts: string
}

export type FridayUser = {
  id: string
  email: string
  name: string
  picture?: string
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

export type FridayAPI = {
  ping: () => void
  log: (scope: string, message: string) => void
  completeOnboarding: () => Promise<void>
  realtime: {
    mintEphemeralKey: () => Promise<{ value: string; model: string }>
  }
  cognition: {
    remember: (input: MemoryRecordInput) => Promise<MemorySummary>
    observe: (input: ObservationInput) => Promise<MemorySummary | null>
    recall: (query: MemoryQuery) => Promise<MemorySummary[]>
    context: (query: MemoryQuery) => Promise<CognitiveContext>
    audit: (claim: string) => Promise<MemoryAuditResult>
    stats: () => Promise<CognitionStats>
    consolidate: () => Promise<ConsolidationResult>
    clear: () => Promise<void>
  }
  knowledge: {
    learn: (input: BeliefInput) => Promise<BeliefFact>
    query: (query: KnowledgeQuery) => Promise<KnowledgeQueryResult>
    inspectEntity: (entityId: string) => Promise<KnowledgeQueryResult>
    stats: () => Promise<KnowledgeStats>
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
  }
  getAgentConfig: () => Promise<AgentConfig>
  captureScreen: () => Promise<{ image: string }>
  describeScreen: (question: string) => Promise<string>
  webSearch: (query: string) => Promise<{ started: boolean; busy?: boolean }>
  computerAction: (action: ComputerAction) => Promise<{ ok: boolean; error?: string }>
  controlComputer: (task: string) => Promise<string>
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
  auth: {
    signInWithGoogle: () => Promise<FridayUser>
    getUser: () => Promise<FridayUser | null>
    signOut: () => Promise<void>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: FridayAPI
  }
}

export {}
