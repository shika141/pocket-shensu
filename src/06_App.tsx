// 06｜MVP 遊戲主畫面：人物場景、狀態欄、情境互動、登入與同步狀態。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, KeyRound, LogOut, Wifi, WifiOff } from 'lucide-react'
import { freshState, relationship, ROOMS, type GameState, type Outfit, type Room } from './01_gameData'
import { simulate } from './02_simulation'
import { loadLocal, saveLocal, type LocalEnvelope } from './03_storage'
import { readCloud, supabase, writeCloud } from './04_supabase'
import { interact, setOutfit, setRoom, type Action } from './05_interactions'

type Page = 'interaction' | 'outing' | 'outfit' | 'memories'
type InteractionKind = 'companion' | 'care'
const pages: Page[] = ['interaction', 'outing', 'outfit', 'memories']
const pageLabels: Record<Page, string> = { interaction: '互動', outing: '出門', outfit: '服裝', memories: '回憶' }
const actionItems: Record<Room, Record<InteractionKind, { id: Action; label: string; hint: string; icon: string }[]>> = {
  living: {
    companion: [{ id: 'comfort', label: '陪他坐一會兒', hint: '親密 +2', icon: '♡' }, { id: 'headpat', label: '摸摸頭', hint: '親密 +1', icon: '⌁' }, { id: 'plush', label: '一起抱鯊魚娃娃', hint: '看看他的反應', icon: '🦈' }],
    care: [{ id: 'feed', label: '準備餐點', hint: '飽足 +30', icon: '＋' }, { id: 'rest', label: '邀請休息', hint: '體力 +24', icon: '☾' }, { id: 'watch', label: '陪他看比賽錄影', hint: '熟練 +1・親密 +2', icon: '≈' }, { id: 'clean', label: '提醒洗澡', hint: '清潔 +35', icon: '◌' }],
  },
  bedroom: {
    companion: [{ id: 'comfort', label: '安靜陪在身邊', hint: '親密 +2', icon: '♡' }, { id: 'headpat', label: '摸摸頭', hint: '親密 +1', icon: '⌁' }, { id: 'plush', label: '把鯊魚娃娃遞給他', hint: '看看他的反應', icon: '🦈' }],
    care: [{ id: 'rest', label: '讓他好好休息', hint: '體力 +24', icon: '☾' }, { id: 'clean', label: '提醒洗澡', hint: '清潔 +35', icon: '◌' }],
  },
  kitchen: {
    companion: [{ id: 'comfort', label: '陪他吃飯', hint: '親密 +2', icon: '♡' }, { id: 'headpat', label: '摸摸頭', hint: '親密 +1', icon: '⌁' }],
    care: [{ id: 'feed', label: '準備餐點', hint: '飽足 +30', icon: '＋' }, { id: 'rest', label: '吃完休息一下', hint: '體力 +24', icon: '☾' }],
  },
  pool: {
    companion: [{ id: 'watch', label: '在池邊看他訓練', hint: '熟練 +1・親密 +2', icon: '≈' }, { id: 'comfort', label: '訓練後陪他聊聊', hint: '親密 +2', icon: '♡' }],
    care: [{ id: 'rest', label: '提醒他補充體力', hint: '體力 +24', icon: '☾' }, { id: 'feed', label: '遞上訓練餐點', hint: '飽足 +30', icon: '＋' }],
  },
}
const outfitItems: Record<Room, Outfit[]> = { living: ['home', 'shark'], bedroom: ['home', 'shark'], kitchen: ['home', 'shark'], pool: ['training'] }
const roomNames: Record<Room, string> = { living: '高樓公寓・客廳', bedroom: '高樓公寓・臥室', kitchen: '高樓公寓・廚房', pool: '曜川競技泳池' }

export default function App() {
  const [envelope, setEnvelope] = useState<LocalEnvelope>(() => loadLocal() ?? { state: freshState(), revision: 0, pending: false })
  const [page, setPage] = useState<Page>('interaction')
  const [interactionKind, setInteractionKind] = useState<InteractionKind>('companion')
  const [selected, setSelected] = useState(0)
  const [clock, setClock] = useState(new Date())
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [syncText, setSyncText] = useState(supabase ? '尚未登入' : '本機存檔')
  const [busy, setBusy] = useState(false)
  const state = envelope.state
  const currentActions = actionItems[state.room][interactionKind]
  const currentOutfits = outfitItems[state.room]

  const commit = useCallback((next: GameState) => {
    const updated = { ...next, updatedAt: Date.now() }
    const pending = Boolean(supabase && userId)
    const nextEnvelope = { ...envelope, state: updated, pending }
    saveLocal(nextEnvelope, userId)
    setEnvelope(nextEnvelope)
    if (pending) setSyncText('待同步')
  }, [envelope, userId])

  useEffect(() => {
    const tick = () => {
      const current = loadLocal(userId) ?? { state: freshState(), revision: 0, pending: false }
      const simulated = simulate(current.state)
      const next = { ...current, state: simulated }
      saveLocal(next, userId); setEnvelope(next); setClock(new Date())
    }
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
    // Seed the first local snapshot and refresh the real-time clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session?.user) {
        setEnvelope(loadLocal(session.user.id) ?? { state: freshState(), revision: 0, pending: false })
        setUserId(session.user.id); setUserEmail(session.user.email ?? '玩家')
        void hydrateCloud(session.user.id)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEnvelope(loadLocal(session.user.id) ?? { state: freshState(), revision: 0, pending: false })
        setUserId(session.user.id); setUserEmail(session.user.email ?? '玩家')
        window.setTimeout(() => { void hydrateCloud(session.user.id) }, 0)
      } else {
        setUserId(null); setUserEmail(null); setSyncText('尚未登入')
        setEnvelope(loadLocal() ?? { state: freshState(), revision: 0, pending: false })
      }
    })
    return () => listener.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hydrateCloud = async (id: string) => {
    if (!supabase) return
    setSyncText('讀取雲端…')
    const persist = (next: LocalEnvelope) => { saveLocal(next, id); setEnvelope(next) }
    const useCloud = (cloud: NonNullable<Awaited<ReturnType<typeof readCloud>>>, previous: LocalEnvelope) => {
      const differs = JSON.stringify(previous.state) !== JSON.stringify(cloud.state)
      const preserveOffline = previous.pending && differs ? previous.state : previous.conflictState
      const next: LocalEnvelope = {
        state: cloud.state,
        revision: cloud.revision,
        pending: false,
        ...(preserveOffline ? { conflictState: preserveOffline } : {}),
      }
      persist(next)
      setSyncText(previous.pending && differs ? '已載入雲端較新存檔；本機分支已保留' : '已同步')
    }
    try {
      const cloud = await readCloud(id)
      const local = loadLocal(id) ?? { state: freshState(), revision: 0, pending: false }
      if (!cloud) {
        if (local.pending || local.revision > 0) {
          const result = await writeCloud(id, local.state, 0)
          if (result.status === 'saved') useCloud(result.save, local)
          else if (result.save) useCloud(result.save, local)
          else {
            const retained = { ...local, pending: false, conflictState: local.state }
            persist(retained); setSyncText('雲端存檔狀態不明；本機版本已保留')
          }
        } else {
          persist({ ...local, pending: false })
          setSyncText('尚無雲端存檔；互動後開始同步')
        }
      } else if (local.pending && local.revision >= cloud.revision) {
        const result = await writeCloud(id, local.state, cloud.revision)
        if (result.status === 'saved') useCloud(result.save, local)
        else if (result.save) useCloud(result.save, local)
        else {
          const retained = { ...local, revision: 0, pending: true, conflictState: local.state }
          persist(retained); setSyncText('雲端存檔已不存在；正在安全恢復本機版本')
        }
      } else {
        useCloud(cloud, local)
      }
    } catch (error) { setSyncText(error instanceof Error ? error.message : '同步失敗') }
  }

  useEffect(() => {
    if (!userId || !supabase || !envelope.pending) return
    const timer = window.setTimeout(async () => {
      try {
        const result = await writeCloud(userId, envelope.state, envelope.revision)
        if (result.status === 'saved') {
          const clean = { ...envelope, state: result.save.state, revision: result.save.revision, pending: false }
          saveLocal(clean, userId); setEnvelope(clean); setSyncText('已同步')
        } else if (result.save) {
          const differs = JSON.stringify(envelope.state) !== JSON.stringify(result.save.state)
          const clean: LocalEnvelope = {
            state: result.save.state,
            revision: result.save.revision,
            pending: false,
            ...(differs ? { conflictState: envelope.state } : envelope.conflictState ? { conflictState: envelope.conflictState } : {}),
          }
          saveLocal(clean, userId); setEnvelope(clean)
          setSyncText(differs ? '已採用較新雲端存檔；本機分支已保留' : '存檔已同步')
        } else {
          const retry = { ...envelope, revision: 0, pending: true }
          saveLocal(retry, userId); setEnvelope(retry)
          setSyncText('雲端存檔已不存在，安全重建中…')
        }
      } catch (error) {
        setSyncText(error instanceof Error ? `同步失敗，已保留本機存檔：${error.message}` : '同步失敗，已保留本機存檔')
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [envelope, userId])

  useEffect(() => {
    const retryPendingSave = () => setEnvelope((current) => current.pending ? { ...current } : current)
    window.addEventListener('online', retryPendingSave)
    return () => window.removeEventListener('online', retryPendingSave)
  }, [])

  const doAction = (id: Action) => {
    if (busy) return
    setBusy(true); commit(interact(state, id)); window.setTimeout(() => setBusy(false), 420)
  }
  const changePage = (direction: number) => {
    const index = pages.indexOf(page)
    setPage(pages[(index + direction + pages.length) % pages.length]); setSelected(0)
  }
  const confirm = () => {
    if (page === 'interaction') doAction(currentActions[selected % currentActions.length].id)
    else if (page === 'outing') changeRoom(ROOMS[selected % ROOMS.length].id)
    else if (page === 'outfit') commit(setOutfit(state, currentOutfits[selected % currentOutfits.length]))
  }
  const changeRoom = (room: Room) => {
    const outfit: Outfit = room === 'pool' ? 'training' : state.outfit === 'training' ? 'home' : state.outfit
    commit(setOutfit(setRoom(state, room), outfit))
    setSelected(0)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); changePage(-1) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); changePage(1) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((v) => Math.max(0, v - 1)) }
      else if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((v) => v + 1) }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); confirm() }
      else if (event.key === 'Escape') setSelected(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const timeLabel = useMemo(() => new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', weekday: 'short' }).format(clock), [clock])
  const signin = async (event: React.FormEvent) => {
    event.preventDefault(); if (!supabase) return; setBusy(true)
    try {
      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
      if (result.error) throw result.error
      if (result.data.user && !result.data.session) setSyncText('註冊成功，請先確認信箱再登入')
      else setSyncText('登入成功，同步中…')
    } catch (error) { setSyncText(error instanceof Error ? error.message : '登入失敗') }
    finally { setBusy(false) }
  }
  const downloadConflictCopy = () => {
    if (!envelope.conflictState) return
    const blob = new Blob([JSON.stringify({ format: 'pocket-shensu-local-conflict-v1', state: envelope.conflictState }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'pocket-shensu-local-conflict.json'; link.click()
    URL.revokeObjectURL(url)
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">S</span><div><strong>口袋沈溯</strong><small>POCKET SHENSU · MVP 0.5</small></div></div>
      <button className="account-chip" onClick={() => setAuthOpen(!authOpen)} disabled={!supabase} title={supabase ? '帳號與雲端同步' : '請先設定 Supabase'}>
        {userEmail ? <><Wifi size={15}/><span>{userEmail}</span></> : <><WifiOff size={15}/><span>{supabase ? '登入同步' : '本機模式'}</span></>}
      </button>
    </header>
    <section className="game-layout">
      <section className={`game-scene room-${state.room}`} aria-label="沈溯目前所在場景">
        <Scene room={state.room}/>
        <div className="scene-heading"><div><span className="eyebrow">現在的位置</span><strong>{roomNames[state.room]}</strong></div><time>{timeLabel}</time></div>
        <Character outfit={state.outfit} mood={state.mood}/>
        {state.sharkPlush && state.room !== 'pool' && <div className="plush">🦈</div>}
        <div className="scene-dialogue"><span>沈溯 · {state.activity}</span><p>{state.lastInteraction || speech(state.mood, state.activity)}</p></div>
        <aside className="scene-status" aria-label="沈溯狀態">
          <div className="scene-status-title"><span>SHENSU · 24</span><span className="status-dot" title={syncText}/></div>
          <div className="relationship"><div><Heart size={15}/><span>{relationship(state.intimacy)}</span></div><strong>{state.intimacy}/100</strong><div className="heart-meter"><i style={{ width: `${state.intimacy}%` }}/></div><small>親密度</small></div>
          <Stat label="飽足" value={state.hunger} color="blue"/><Stat label="體力" value={state.energy} color="silver"/><Stat label="清潔" value={state.cleanliness} color="teal"/>
          <div className="scene-facts"><span>心情 <b>{state.mood}</b></span><span>蝶泳熟練 <b>{state.swimSkill}</b></span></div>
        </aside>
      </section>
      <section className="control-panel" aria-label="遊戲選單">
        <nav className="category-tabs" role="tablist" aria-label="遊戲分類">{pages.map((item) => <button role="tab" aria-selected={page === item} key={item} className={page === item ? 'active' : ''} onClick={() => { setPage(item); setSelected(0) }}><span>{pageLabels[item]}</span></button>)}</nav>
        <div className="panel-header"><div><div className="eyebrow">{state.lastInteraction}</div><h2>{pageLabels[page]}<span className="current-place">{roomNames[state.room]}</span></h2></div></div>
        {page === 'interaction' && <>
          <div className="sub-tabs" role="tablist" aria-label="互動類型"><button role="tab" aria-selected={interactionKind === 'companion'} className={interactionKind === 'companion' ? 'active' : ''} onClick={() => { setInteractionKind('companion'); setSelected(0) }}>陪伴</button><button role="tab" aria-selected={interactionKind === 'care'} className={interactionKind === 'care' ? 'active' : ''} onClick={() => { setInteractionKind('care'); setSelected(0) }}>照顧</button></div>
          <div className="menu-list">{currentActions.map((row, index) => <button key={row.id} className={`menu-row ${selected % currentActions.length === index ? 'selected' : ''}`} onMouseEnter={() => setSelected(index)} onClick={() => doAction(row.id)}><span className="row-icon">{row.icon}</span><span className="row-copy"><b>{row.label}</b><small>{row.hint}</small></span><span className="row-arrow">›</span></button>)}</div>
        </>}
        {page === 'outing' && <div className="menu-list room-list">{ROOMS.map((room, index) => <button key={room.id} className={`menu-row ${state.room === room.id ? 'selected' : ''}`} onMouseEnter={() => setSelected(index)} onClick={() => changeRoom(room.id)}><span className="row-icon">{room.icon}</span><span className="row-copy"><b>{room.name}</b><small>{state.room === room.id ? '沈溯目前在這裡' : room.id === 'pool' ? '前往曜川競技游泳隊' : '回到沈溯的公寓'}</small></span><span className="row-arrow">›</span></button>)}</div>}
        {page === 'outfit' && <div className="closet-grid">{currentOutfits.map((outfit, index) => <button className={`outfit-card ${state.outfit === outfit ? 'selected' : ''}`} key={outfit} onMouseEnter={() => setSelected(index)} onClick={() => commit(setOutfit(state, outfit))}><span>{outfit === 'shark' ? '🦈' : outfit === 'training' ? '🏊' : '◒'}</span><b>{outfitName(outfit)}</b><small>{state.outfit === outfit ? '穿著中' : '換上這套'}</small></button>)}</div>}
        {page === 'memories' && <div className="memory-view">{state.unlockedMemories.length ? <div className="memory-card"><div className="memory-art">🦈<span>✦</span></div><b>安靜等你</b><p>沈溯穿著灰藍鯊魚裝，抱著娃娃坐在沙發上。</p><small>特別事件 · 已收錄</small></div> : <div className="empty-memory"><div>✧</div><b>回憶還是空白的</b><p>陪伴沈溯、參與日常，重要時刻會慢慢留在這裡。</p><button onClick={() => { setPage('interaction'); setInteractionKind('companion'); setSelected(0) }}>陪他待一會兒</button></div>}</div>}
        <div className="panel-footer"><span>{syncText}</span><span>← → 分類 · ↑ ↓ 選擇 · Enter 確認</span></div>
      </section>
    </section>
    <footer className="footnote"><span>沈溯不會因為你離線而消失。</span><span>本機存檔 {envelope.pending ? '· 有待同步資料' : '· 已保存'} </span></footer>
    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)}>×</button><div className="eyebrow">CLOUD SAVE</div><h2>{userEmail ? '雲端存檔已連結' : authMode === 'login' ? '登入你的帳號' : '建立遊戲帳號'}</h2>
      {userEmail ? <><p className="auth-description">登入後，這個帳號的親密度、服裝、收藏、劇情進度和沈溯狀態會在裝置間同步。</p>{envelope.conflictState && <div className="conflict-copy"><b>本機離線分支已保留</b><span>雲端較新版本目前正在使用；可下載這台裝置的離線狀態備份。</span><button className="secondary-button" onClick={downloadConflictCopy}>下載本機分支 JSON</button></div>}<button className="primary-button" onClick={() => supabase?.auth.signOut()}><LogOut size={16}/> 登出 {userEmail}</button></> : <form onSubmit={signin}><p className="auth-description">使用 Supabase 帳號在不同裝置延續同一份存檔。</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required/></label><button className="primary-button" disabled={busy}><KeyRound size={16}/>{authMode === 'login' ? '登入並同步' : '建立帳號'}</button><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? '還沒有帳號？建立帳號' : '已有帳號？返回登入'}</button></form>}
      <small className="auth-status">{syncText}</small></section></div>}
  </main>
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) { return <div className="stat-row"><div><span>{label}</span><b>{value}%</b></div><div className="bar"><i className={color} style={{ width: `${value}%` }}/></div></div> }
function outfitName(outfit: Outfit) { return outfit === 'training' ? '競技訓練服' : outfit === 'shark' ? '灰藍鯊魚裝' : '居家服' }
function speech(mood: GameState['mood'], activity: GameState['activity']) {
  if (mood === '低落' || mood === '煩躁') return '……'
  if (activity === '晨訓' || activity === '下午訓練') return '再一趟。'
  if (activity === '睡眠') return 'Z z…'
  if (mood === '想撒嬌') return '……過來。'
  return '嗯。'
}
function Scene({ room }: { room: Room }) { return <div className={`scene scene-${room}`}><div className="window"><div className="skyline"><i/><i/><i/><i/><i/></div></div>{room === 'pool' ? <><div className="pool-water"><i/><i/><i/></div><div className="starting-block">04</div></> : room === 'bedroom' ? <><div className="bed"><i/></div><div className="lamp"/></> : room === 'kitchen' ? <><div className="counter"/><div className="table"/></> : <><div className="sofa"><i/></div><div className="coffee-table"/></>}</div> }
function Character({ outfit, mood }: { outfit: Outfit; mood: GameState['mood'] }) { return <div className={`character character-${outfit} ${mood === '疲倦' ? 'tired' : ''}`}><div className="hair"><i/><i/><i/></div><div className="head"><i className="eye eye-left"/><i className="eye eye-right"/><i className="mole"/><i className="mouth"/></div><div className="neck"/><div className="body"><i className="arm arm-left"/><i className="arm arm-right"/><i className="leg leg-left"/><i className="leg leg-right"/></div>{outfit === 'shark' && <div className="shark-hood">⌃</div>}</div> }
