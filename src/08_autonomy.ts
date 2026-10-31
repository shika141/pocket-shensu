// 08｜沈溯自主行動：只管理短期展示狀態，不寫入 GameState 或雲端存檔。
import type { Activity, Mood, Outfit, Room } from './01_gameData'

export type CharacterPose = 'stand' | 'walk' | 'sit' | 'hug' | 'sleep'
export interface AutonomyState { pose: CharacterPose; x: number; targetX: number; bottom: number }
export interface AutonomyContext {
  room: Room
  outfit: Outfit
  activity: Activity
  mood: Mood
  energy: number
  sharkPlush: boolean
  mobile: boolean
}

/**
 * 素材命名：shensu-{outfit}-017-{pose}-{frame}.webp
 * 單張備用圖：shensu-{outfit}-013.png
 * 每張圖以腳底貼齊畫布底邊、保留透明背景、禁止裁切或拉伸。
 * 站立使用 013 單人圖；坐姿、抱娃娃、睡姿使用已存在的 010 單人圖。sleep 立姿暫用居家服，避免誤顯示重複的鯊魚裝素材。
 */
export const CHARACTER_ASSETS: Record<Outfit, string> = {
  casual: '/assets/character/shensu-casual-013.png',
  home: '/assets/character/shensu-home-013.png',
  training: '/assets/character/shensu-training-013.png',
  swim: '/assets/character/shensu-swim-013.png',
  sleep: '/assets/character/shensu-home-013.png',
  shark: '/assets/character/shensu-shark-013.png',
}

export const CHARACTER_POSE_ASSETS: Record<CharacterPose, string[]> = {
  stand: ['casual', 'home', 'training', 'swim', 'shark'],
  walk: [],
  sit: ['shark'],
  hug: ['home', 'shark'],
  sleep: ['sleep'],
}

interface ViewportLayout { anchor: number; waypoints: number[]; walkableBand: [number, number]; forbidden: { label: string; range: [number, number] }[]; furniture: Record<string, number>; furnitureBottom: Record<string, number> }
interface RoomLayout { desktop: ViewportLayout; mobile: ViewportLayout }

/** 行走帶避開背景中的主要家具；家具座標只供對應坐／睡姿定位。 */
export const ROOM_LAYOUTS: Record<Room, RoomLayout> = {
  living: {
    desktop: { anchor: 66, waypoints: [63, 69, 75], walkableBand: [61, 78], forbidden: [{ label: '沙發', range: [0, 50] }, { label: '茶几', range: [42, 60] }], furniture: { sofa: 39, coffeeTable: 54 }, furnitureBottom: { sofa: 12 } },
    mobile: { anchor: 72, waypoints: [68, 74, 80], walkableBand: [66, 82], forbidden: [{ label: '沙發', range: [0, 55] }, { label: '茶几', range: [45, 64] }], furniture: { sofa: 38, coffeeTable: 54 }, furnitureBottom: { sofa: 13 } },
  },
  bedroom: {
    desktop: { anchor: 69, waypoints: [65, 71, 77], walkableBand: [63, 80], forbidden: [{ label: '床', range: [0, 57] }, { label: '床頭櫃', range: [57, 63] }], furniture: { bed: 43, bedside: 76 }, furnitureBottom: { bed: 24 } },
    mobile: { anchor: 72, waypoints: [68, 74, 80], walkableBand: [66, 82], forbidden: [{ label: '床', range: [0, 58] }, { label: '床頭櫃', range: [58, 65] }], furniture: { bed: 46, bedside: 77 }, furnitureBottom: { bed: 25 } },
  },
  kitchen: {
    desktop: { anchor: 76, waypoints: [74, 79, 84], walkableBand: [73, 86], forbidden: [{ label: '中島', range: [20, 68] }, { label: '流理台', range: [68, 72] }], furniture: { island: 45, counter: 78 }, furnitureBottom: { island: 8 } },
    mobile: { anchor: 74, waypoints: [70, 76, 82], walkableBand: [68, 84], forbidden: [{ label: '中島', range: [18, 65] }, { label: '流理台', range: [65, 69] }], furniture: { island: 42, counter: 77 }, furnitureBottom: { island: 8 } },
  },
  pool: {
    desktop: { anchor: 70, waypoints: [66, 72, 78], walkableBand: [64, 80], forbidden: [{ label: '泳池水道', range: [0, 57] }, { label: '休息長椅', range: [80, 100] }], furniture: { poolLanes: 25, bench: 84 }, furnitureBottom: { bench: 12 } },
    mobile: { anchor: 72, waypoints: [68, 74, 80], walkableBand: [66, 82], forbidden: [{ label: '泳池水道', range: [0, 58] }, { label: '休息長椅', range: [82, 100] }], furniture: { poolLanes: 25, bench: 85 }, furnitureBottom: { bench: 12 } },
  },
}

export function initialAutonomy(room: Room, mobile: boolean, activity?: Activity): AutonomyState {
  const layout = ROOM_LAYOUTS[room][mobile ? 'mobile' : 'desktop']
  if (activity === '睡眠' && room === 'bedroom') {
    const x = furniturePoint(room, mobile, 'bed') ?? layout.anchor
    return { pose: 'sleep', x, targetX: x, bottom: layout.furnitureBottom.bed ?? 4 }
  }
  return { pose: 'stand', x: layout.anchor, targetX: layout.anchor, bottom: 4 }
}

export function nextAutonomy(current: AutonomyState, context: AutonomyContext, random = Math.random): AutonomyState {
  const layout = ROOM_LAYOUTS[context.room][context.mobile ? 'mobile' : 'desktop']

  // Rest and sleep take precedence over roaming. Missing pose art falls back to the outfit's standing image.
  if (context.activity === '睡眠' && context.room === 'bedroom') {
    const x = furniturePoint(context.room, context.mobile, 'bed') ?? layout.anchor
    return { pose: 'sleep', x, targetX: x, bottom: layout.furnitureBottom.bed ?? 4 }
  }
  if (context.energy < 24 || context.mood === '疲倦') {
    const sitX = context.room === 'living' ? furniturePoint(context.room, context.mobile, 'sofa') : undefined
    return { pose: context.room === 'living' && context.outfit === 'shark' && sitX ? 'sit' : 'stand', x: sitX ?? current.x, targetX: sitX ?? current.x, bottom: sitX ? layout.furnitureBottom.sofa ?? 4 : 4 }
  }
  if (context.sharkPlush && context.mood === '低落' && (context.outfit === 'shark' || context.outfit === 'home') && random() < 0.42) {
    return { pose: 'hug', x: layout.anchor, targetX: layout.anchor, bottom: 4 }
  }
  if ((context.outfit === 'shark' || context.outfit === 'home') && context.sharkPlush && random() < 0.16) return { pose: 'hug', x: layout.anchor, targetX: layout.anchor, bottom: 4 }

  const [walkMin, walkMax] = layout.walkableBand
  const safeCurrent = Math.min(walkMax, Math.max(walkMin, current.x))
  const destination = layout.waypoints.filter((point) => point >= walkMin && point <= walkMax && Math.abs(point - safeCurrent) >= 5 && !crossesForbidden(layout, safeCurrent, point))
  if (destination.length && random() < walkingChance(context)) {
    const targetX = destination[Math.floor(random() * destination.length)]
    return { pose: 'walk', x: safeCurrent, targetX, bottom: 4 }
  }
  return { pose: 'stand', x: safeCurrent, targetX: safeCurrent, bottom: 4 }
}

export function visiblePose(pose: CharacterPose, outfit: Outfit): CharacterPose {
  return CHARACTER_POSE_ASSETS[pose].includes(outfit) ? pose : 'stand'
}

export function characterAssetFor(outfit: Outfit, pose: CharacterPose): string {
  const poseAssets: Partial<Record<CharacterPose, Partial<Record<Outfit, string>>>> = {
    sit: { shark: '/assets/character/shensu-shark-010.png' },
    hug: { home: '/assets/character/shensu-home-010.png', shark: '/assets/character/shensu-shark-013.png' },
    sleep: { sleep: '/assets/character/shensu-sleep-010.png' },
  }
  return poseAssets[pose]?.[outfit] ?? CHARACTER_ASSETS[outfit]
}

export function autonomyDelay(context: AutonomyContext, pose: CharacterPose, random = Math.random): number {
  if (pose === 'walk') return 2500
  if (pose === 'hug' || pose === 'sit') return 6500 + random() * 2500
  if (pose === 'sleep') return 15_000 + random() * 10_000
  const base = context.activity === '晨訓' || context.activity === '下午訓練' ? 20_000 : 13_000
  const fatiguePause = context.energy < 45 || context.mood === '低落' ? 6_000 : 0
  return base + fatiguePause + random() * 12_000
}

export function walkingChance(context: AutonomyContext): number {
  if (context.activity === '睡眠') return 0
  if (context.energy < 35) return 0.08
  if (context.mood === '煩躁' || context.mood === '低落') return 0.18
  if (context.activity === '晨訓' || context.activity === '下午訓練') return 0.28
  return 0.38
}

function crossesForbidden(layout: ViewportLayout, from: number, to: number): boolean {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  return layout.forbidden.some(({ range: [start, end] }) => high > start && low < end)
}

export function furniturePoint(room: Room, mobile: boolean, key: string): number | undefined {
  return ROOM_LAYOUTS[room][mobile ? 'mobile' : 'desktop'].furniture[key]
}
