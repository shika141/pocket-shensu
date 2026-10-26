// 04｜Supabase 雲端登入／同步：僅使用前端公開 anon key；不含 service role。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { GameState } from './01_gameData'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase: SupabaseClient | null = url && key && !url.includes('your-project') && !key.includes('your-public') ? createClient(url, key) : null

export interface CloudSave { state: GameState; revision: number; updated_at: string }
export async function readCloud(userId: string): Promise<CloudSave | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('game_saves').select('state, revision, updated_at').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as CloudSave | null
}
export async function writeCloud(userId: string, state: GameState, expectedRevision: number): Promise<CloudSave> {
  if (!supabase) throw new Error('Supabase 尚未設定')
  const { data, error } = await supabase.rpc('save_game_state', { p_user_id: userId, p_expected_revision: expectedRevision, p_state: state })
  if (error) throw error
  if (data?.conflict) throw new Error('REVISION_CONFLICT')
  return data as CloudSave
}
