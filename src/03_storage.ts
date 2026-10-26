// 03｜本機存檔與離線佇列：任何互動先寫入本機，網路恢復後再同步。
import { STORAGE_KEY, type GameState } from './01_gameData'
export interface LocalEnvelope { state: GameState; revision: number; pending: boolean }
export function loadLocal(): LocalEnvelope | null {
  try { const value = localStorage.getItem(STORAGE_KEY); return value ? JSON.parse(value) as LocalEnvelope : null } catch { return null }
}
export function saveLocal(envelope: LocalEnvelope) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope)); return true } catch { return false }
}
