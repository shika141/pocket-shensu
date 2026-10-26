// 05｜遊戲互動：照顧需求、陪伴、換裝、房間及三鍵選單指令。
import { clamp, type GameState, type Mood, type Outfit, type Room } from './01_gameData'
export type Action = 'feed' | 'comfort' | 'headpat' | 'rest' | 'clean' | 'watch' | 'plush' | 'shark' | 'outfit' | 'room'
export function interact(state: GameState, action: Action, now = Date.now()): GameState {
  const s = { ...state, unlockedMemories: [...state.unlockedMemories], updatedAt: now }
  const responses: Record<Action, string> = {
    feed: '沈溯把餐盤拉近。「先吃飯。」', comfort: '沈溯安靜了一會兒，往你身邊靠近一點。',
    headpat: '他看了你一眼，沒有躲開。「……就一下。」', rest: '沈溯閉上眼休息，肩膀慢慢放鬆。',
    clean: '沈溯沖了個澡，回來時頭髮還帶著水氣。', watch: '你們並肩看完一段比賽錄影。沈溯指出了轉身時的小失誤。',
    plush: '沈溯把鯊魚娃娃抱在懷裡，表情仍然很淡。', shark: '沈溯換上灰藍鯊魚裝，把鯊魚娃娃抱緊了一點。',
    outfit: '沈溯換好衣服，順手整理了袖口。', room: '沈溯跟著你換了個地方。',
  }
  if (action === 'feed') { s.hunger = clamp(s.hunger + 30); s.mood = '開心' }
  if (action === 'comfort') { s.mood = '平靜'; s.intimacy = clamp(s.intimacy + 2); s.energy = clamp(s.energy + 2) }
  if (action === 'headpat') { s.intimacy = clamp(s.intimacy + 1); s.mood = '想撒嬌' }
  if (action === 'rest') { s.energy = clamp(s.energy + 24); s.mood = '平靜' }
  if (action === 'clean') s.cleanliness = clamp(s.cleanliness + 35)
  if (action === 'watch') { s.intimacy = clamp(s.intimacy + 2); s.swimSkill = clamp(s.swimSkill + 1) }
  if (action === 'plush') { s.sharkPlush = true; s.mood = '開心' }
  if (action === 'shark') { s.outfit = 'shark' as Outfit; s.mood = '想撒嬌'; s.intimacy = clamp(s.intimacy + 1); s.unlockedMemories = [...new Set([...s.unlockedMemories, 'shark-comfort'])] }
  s.lastInteraction = responses[action]
  return s
}
export function setRoom(state: GameState, room: Room): GameState { return { ...state, room, lastInteraction: '沈溯抬眼看了你一下。「去哪？」' } }
export function setOutfit(state: GameState, outfit: Outfit): GameState { return { ...state, outfit, lastInteraction: '沈溯換好衣服。「行。」' } }
export function moodClass(mood: Mood) { return mood === '開心' || mood === '想撒嬌' ? 'mood-warm' : mood === '低落' || mood === '煩躁' ? 'mood-low' : '' }
