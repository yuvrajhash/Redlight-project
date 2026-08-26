import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { FridayAPI } from './types'

const onboardingArg = process.argv.find((arg) => arg.startsWith('--onboarding-complete='))
const initialOnboardingComplete = onboardingArg ? onboardingArg.split('=')[1] === 'true' : false

const api: FridayAPI = {
  ping: () => ipcRenderer.send('ping'),
  log: (scope, message) => ipcRenderer.send('app:log', scope, message),
  completeOnboarding: () => ipcRenderer.invoke('complete-onboarding'),
  realtime: {
    mintEphemeralKey: () => ipcRenderer.invoke('realtime:mintEphemeralKey')
  },
  cognition: {
    remember: (input) => ipcRenderer.invoke('cognition:remember', input),
    observe: (input) => ipcRenderer.invoke('cognition:observe', input),
    recall: (query) => ipcRenderer.invoke('cognition:recall', query),
    context: (query) => ipcRenderer.invoke('cognition:context', query),
    audit: (claim) => ipcRenderer.invoke('cognition:audit', claim),
    stats: () => ipcRenderer.invoke('cognition:stats'),
    consolidate: () => ipcRenderer.invoke('cognition:consolidate'),
    clear: () => ipcRenderer.invoke('cognition:clear')
  },
  knowledge: {
    learn: (input) => ipcRenderer.invoke('knowledge:learn', input),
    query: (query) => ipcRenderer.invoke('knowledge:query', query),
    inspectEntity: (entityId) => ipcRenderer.invoke('knowledge:inspectEntity', entityId),
    stats: () => ipcRenderer.invoke('knowledge:stats')
  },
  planning: {
    createGoal: (input) => ipcRenderer.invoke('planning:createGoal', input),
    setPlan: (input) => ipcRenderer.invoke('planning:setPlan', input),
    listGoals: (query) => ipcRenderer.invoke('planning:listGoals', query),
    nextActions: (limit) => ipcRenderer.invoke('planning:nextActions', limit),
    approveStep: (goalId, stepId, userConfirmed) =>
      ipcRenderer.invoke('planning:approveStep', goalId, stepId, userConfirmed),
    beginStep: (goalId, stepId) => ipcRenderer.invoke('planning:beginStep', goalId, stepId),
    resolveStep: (goalId, stepId, outcome, succeeded) =>
      ipcRenderer.invoke('planning:resolveStep', goalId, stepId, outcome, succeeded),
    setGoalStatus: (goalId, status) => ipcRenderer.invoke('planning:setGoalStatus', goalId, status),
    stats: () => ipcRenderer.invoke('planning:stats')
  },
  runtime: {
    ingest: (input) => ipcRenderer.invoke('runtime:ingest', input),
    cycle: () => ipcRenderer.invoke('runtime:cycle'),
    sleep: () => ipcRenderer.invoke('runtime:sleep'),
    stats: () => ipcRenderer.invoke('runtime:stats'),
    updateWorld: (input) => ipcRenderer.invoke('runtime:updateWorld', input),
    worldSnapshot: () => ipcRenderer.invoke('runtime:worldSnapshot'),
    learnSkill: (input) => ipcRenderer.invoke('runtime:learnSkill', input),
    matchSkills: (query, limit) => ipcRenderer.invoke('runtime:matchSkills', query, limit),
    recordSkillOutcome: (input) => ipcRenderer.invoke('runtime:recordSkillOutcome', input),
    updateCapability: (input) => ipcRenderer.invoke('runtime:updateCapability', input),
    auditReasoning: (input) => ipcRenderer.invoke('runtime:auditReasoning', input),
    selfSnapshot: () => ipcRenderer.invoke('runtime:selfSnapshot'),
    emergencyStop: () => ipcRenderer.invoke('runtime:emergencyStop'),
    resetEmergencyStop: (userConfirmed) =>
      ipcRenderer.invoke('runtime:resetEmergencyStop', userConfirmed)
  },
  getAgentConfig: () => ipcRenderer.invoke('get-agent-config'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  describeScreen: (question) => ipcRenderer.invoke('describe-screen', question),
  webSearch: (query) => ipcRenderer.invoke('web-search', query),
  computerAction: (action) => ipcRenderer.invoke('computer-action', action),
  controlComputer: (task, approved = false) =>
    ipcRenderer.invoke('control-computer', task, approved),
  store: {
    initialOnboardingComplete,
    isOnboardingComplete: () => ipcRenderer.invoke('store:isOnboardingComplete'),
    setOnboardingComplete: (value) => ipcRenderer.invoke('store:setOnboardingComplete', value),
    saveApiKey: (service, key) => ipcRenderer.invoke('store:saveApiKey', service, key),
    deleteApiKey: (service) => ipcRenderer.invoke('store:deleteApiKey', service),
    validateGoogleKey: (key) => ipcRenderer.invoke('store:validateGoogleKey', key),
    validateOpenAiKey: (key) => ipcRenderer.invoke('store:validateOpenAiKey', key),
    getProviderConfig: () => ipcRenderer.invoke('store:getProviderConfig'),
    setProviderConfig: (config) => ipcRenderer.invoke('store:setProviderConfig', config),
    resetStore: () => ipcRenderer.invoke('store:resetStore')
  },
  permissions: {
    getMicStatus: () => ipcRenderer.invoke('permissions:getMicStatus'),
    requestMicAccess: () => ipcRenderer.invoke('permissions:requestMicAccess'),
    openMicSettings: () => ipcRenderer.invoke('permissions:openMicSettings'),
    getScreenStatus: () => ipcRenderer.invoke('permissions:getScreenStatus'),
    openScreenSettings: () => ipcRenderer.invoke('permissions:openScreenSettings'),
    getAccessibilityStatus: (prompt = false) =>
      ipcRenderer.invoke('permissions:getAccessibilityStatus', prompt),
    openAccessibilitySettings: () => ipcRenderer.invoke('permissions:openAccessibilitySettings'),
    triggerInputMonitoringPrompt: () =>
      ipcRenderer.invoke('permissions:triggerInputMonitoringPrompt'),
    openInputMonitoringSettings: () => ipcRenderer.invoke('permissions:openInputMonitoringSettings')
  },
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke('auth:signInWithGoogle'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    signOut: () => ipcRenderer.invoke('auth:signOut')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(globalThis, { electron: electronAPI, api })
}
