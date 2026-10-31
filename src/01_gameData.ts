// 01｜遊戲資料與平衡參數：角色作息、狀態範圍、互動選項集中管理。
export type Room = 'living' | 'bedroom' | 'kitchen' | 'pool'
export type Outfit = 'casual' | 'home' | 'training' | 'swim' | 'sleep' | 'shark'
export type Mood = '平靜' | '開心' | '疲倦' | '煩躁' | '低落' | '想撒嬌'
export type Activity = '休息' | '晨訓' | '下午訓練' | '早餐' | '午餐' | '晚餐' | '睡眠' | '自由活動'

export interface GameState {
  schema: 1
  updatedAt: number
  room: Room
  outfit: Outfit
  mood: Mood
  activity: Activity
  hunger: number
  cleanliness: number
  energy: number
  intimacy: number
  swimSkill: number
  sharkPlush: boolean
  unlockedMemories: string[]
  lastInteraction: string
}

export const STORAGE_KEY = 'pocket-shensu-save-v1'
export const ROOMS: { id: Room; name: string; icon: string }[] = [
  { id: 'living', name: '客廳', icon: '⌂' }, { id: 'bedroom', name: '臥室', icon: '☾' },
  { id: 'kitchen', name: '廚房', icon: '◈' }, { id: 'pool', name: '曜川泳池', icon: '≈' },
]
export const SCHEDULE = [
  { start: 6, end: 7, activity: '早餐' as Activity, room: 'kitchen' as Room },
  { start: 7, end: 9.5, activity: '晨訓' as Activity, room: 'pool' as Room },
  { start: 9.5, end: 11.5, activity: '休息' as Activity, room: 'living' as Room },
  { start: 11.5, end: 13.5, activity: '午餐' as Activity, room: 'kitchen' as Room },
  { start: 13.5, end: 17, activity: '下午訓練' as Activity, room: 'pool' as Room },
  { start: 17, end: 19, activity: '晚餐' as Activity, room: 'kitchen' as Room },
  { start: 19, end: 22.5, activity: '自由活動' as Activity, room: 'living' as Room },
  { start: 22.5, end: 30, activity: '睡眠' as Activity, room: 'bedroom' as Room },
]

export function freshState(now = Date.now()): GameState {
  return { schema: 1, updatedAt: now, room: 'living', outfit: 'home', mood: '平靜', activity: '自由活動', hunger: 78, cleanliness: 84, energy: 76, intimacy: 0, swimSkill: 12, sharkPlush: true, unlockedMemories: [], lastInteraction: '沈溯剛訓練完，坐在沙發邊擦頭髮。' }
}

export function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))) }
export function relationship(value: number) {
  if (value >= 80) return '心動中'
  if (value >= 60) return '信任'
  if (value >= 40) return '熟悉'
  if (value >= 20) return '認識'
  return '初識'
}
