// 04｜Supabase 雲端登入／同步：僅使用前端公開 anon key；不含 service role。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GameState } from './01_gameData'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase: SupabaseClient | null = url && key && !url.includes('your-project') && !key.includes('your-public') ? createClient(url, key) : null

export interface CloudSave { state: GameState; revision: number; updated_at: string }
export type SaveResult = { status: 'saved'; save: CloudSave } | { status: 'conflict'; save: CloudSave | null }

function parseCloudSave(value: unknown): CloudSave | null {
  if (!value || typeof value !== 'object') return null
  const save = value as Partial<CloudSave>
  if (!save.state || typeof save.state !== 'object' || !Number.isInteger(save.revision) || typeof save.updated_at !== 'string') return null
  return save as CloudSave
}

async function assertCurrentUser(userId: string) {
  if (!supabase) throw new Error('Supabase 尚未設定')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user || data.user.id !== userId) throw new Error('帳號狀態已變更，請重新同步')
}

export async function readCloud(userId: string): Promise<CloudSave | null> {
  if (!supabase) return null
  await assertCurrentUser(userId)
  const { data, error } = await supabase.from('game_saves').select('state, revision, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data === null) return null
  const save = parseCloudSave(data)
  if (!save) throw new Error('雲端存檔格式不正確，請確認已套用最新版 schema.sql')
  return save
}
export async function writeCloud(userId: string, state: GameState, expectedRevision: number): Promise<SaveResult> {
  if (!supabase) throw new Error('Supabase 尚未設定')
  await assertCurrentUser(userId)
  const { data, error } = await supabase.rpc('save_game_state', { p_user_id: userId, p_expected_revision: expectedRevision, p_state: state })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('RPC 回傳格式不正確，請確認已套用最新版 schema.sql')
  const result = data as { status?: unknown; save?: unknown }
  if (result.status === 'saved') {
    const save = parseCloudSave(result.save)
    if (!save) throw new Error('RPC 成功回傳缺少存檔資料，請確認已套用最新版 schema.sql')
    return { status: 'saved', save }
  }
  if (result.status === 'conflict') {
    const save = result.save === null ? null : parseCloudSave(result.save)
    if (result.save !== null && !save) throw new Error('RPC 衝突回傳格式不正確，請確認已套用最新版 schema.sql')
    return { status: 'conflict', save }
  }
  throw new Error('RPC 回傳未知結果，請確認已套用最新版 schema.sql')
}
