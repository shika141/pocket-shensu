// 02｜現實時間與離線恢復：重算目前作息並按經過時間結算自然狀態變化。
import { clamp, freshState, SCHEDULE, type Activity, type GameState, type Room } from './01_gameData'

export function activityAt(date: Date): { activity: Activity; room: Room } {
  const rawHour = date.getHours() + date.getMinutes() / 60
  // The sleep block crosses midnight (22:30–06:00), so map 00:00–05:59 to 24:00–29:59.
  const hour = rawHour < 6 ? rawHour + 24 : rawHour
  const row = SCHEDULE.find((item) => hour >= item.start && hour < item.end)
  if (row) return { activity: row.activity, room: row.room }
  if (hour < 6) return { activity: '睡眠', room: 'bedroom' }
  return { activity: '自由活動', room: 'living' }
}

export function simulate(state: GameState | null, now = Date.now()): GameState {
  const next = state ? { ...state, unlockedMemories: [...state.unlockedMemories] } : freshState(now)
  const elapsedHours = Math.max(0, Math.min((now - next.updatedAt) / 3_600_000, 24 * 30))
  const hungerDrop = elapsedHours * 2.3
  const sleepHours = sleepingHours(next.updatedAt, now)
  next.hunger = clamp(next.hunger - hungerDrop)
  next.cleanliness = clamp(next.cleanliness - elapsedHours * 1.2)
  next.energy = clamp(next.energy - Math.max(0, elapsedHours - sleepHours) * 2.1 + sleepHours * 2.8)
  const { activity, room } = activityAt(new Date(now))
  next.activity = activity
  // 訓練和用餐採固定行程；玩家切換房間不會改變角色行程。
  next.room = activity === '晨訓' || activity === '下午訓練' || activity === '睡眠' || activity === '早餐' || activity === '午餐' || activity === '晚餐' ? room : next.room
  next.outfit = activity === '晨訓' || activity === '下午訓練' ? 'training' : activity === '睡眠' ? 'home' : next.outfit === 'training' ? 'home' : next.outfit
  if (next.energy < 30) next.mood = '疲倦'
  else if (next.hunger < 25) next.mood = '煩躁'
  else if (next.mood === '疲倦' || next.mood === '煩躁') next.mood = '平靜'
  next.updatedAt = now
  return next
}

function sleepingHours(from: number, to: number): number {
  if (to <= from) return 0
  const start = new Date(from)
  const end = new Date(to)
  let total = 0
  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day <= end; day.setDate(day.getDate() + 1)) {
    const sleepStart = new Date(day); sleepStart.setHours(22, 30, 0, 0)
    const sleepEnd = new Date(day); sleepEnd.setDate(sleepEnd.getDate() + 1); sleepEnd.setHours(6, 0, 0, 0)
    total += Math.max(0, Math.min(to, sleepEnd.getTime()) - Math.max(from, sleepStart.getTime())) / 3_600_000
  }
  return total
}
