// 03｜本機存檔與離線佇列：任何互動先寫入本機，網路恢復後再同步。
import { STORAGE_KEY, type GameState } from './01_gameData'
export interface LocalEnvelope {
  state: GameState
  revision: number
  pending: boolean
  /** A local offline branch kept when a newer cloud revision wins. */
  conflictState?: GameState
}

function keyFor(userId?: string | null) { return `${STORAGE_KEY}:${userId || 'guest'}` }

export function loadLocal(userId?: string | null): LocalEnvelope | null {
  try {
    const scoped = localStorage.getItem(keyFor(userId))
    // Migrate the old unscoped save only into guest storage. Never associate an
    // unowned browser save with whichever account happens to sign in next.
    const value = scoped ?? (!userId ? localStorage.getItem(STORAGE_KEY) : null)
    if (!value) return null
    const envelope = JSON.parse(value) as LocalEnvelope
    if (!envelope?.state || !Number.isInteger(envelope.revision) || envelope.revision < 0) return null
    if (scoped === null && !userId) saveLocal(envelope, null)
    return envelope
  } catch { return null }
}

export function saveLocal(envelope: LocalEnvelope, userId?: string | null) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(envelope))
    // Keep the prior guest key readable by old builds, but never write account
    // saves into it.
    if (!userId) localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
    return true
  } catch { return false }
}
