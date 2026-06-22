import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useProgressStore } from '@/store/progressStore';

/**
 * 수익화 레이어 (설계 06 — IAA + IAP 하이브리드).
 * 프로토타입: 광고/결제 모두 스텁. 실제 연동 시 이 파일의 액션 내부만 교체
 * (광고 = react-native-google-mobile-ads, 결제 = RevenueCat/expo-iap 예정).
 */

/** 광고 보상 종류 (설계 06 IAA 표) */
export type AdRewardKind =
  | 'doubleReward' // 스테이지 보상 2배
  | 'cardReroll' // 카드 재선택
  | 'speedX4' // 4배속 (세션 해금)
  | 'freeDiamonds' // 무료 다이아
  | 'retry'; // 실패 재도전

/**
 * IAP 상품 정의 (가격은 출시 전 확정 — 설계 06).
 * 다이아 현금팩 x1/x10/x100: 묶음일수록 보너스 다이아↑ (x10 +10%, x100 +20%).
 * diamonds 값에 보너스가 이미 포함됨 (1,000→1,100 / 10,000→12,000).
 * 골드는 현금이 아닌 다이아로 구매 (progressStore.buyGoldPack).
 */
export const IAP_PRODUCTS = {
  // 획득 다이아 ×2.5 (비용 동결 — 넉넉한 경제, 피드백). 묶음 보너스 +10%/+20% 구조 유지
  diamonds_x1: { name: '다이아 250', diamonds: 250, priceLabel: '$0.99', bonusLabel: '' },
  diamonds_x10: { name: '다이아 2,750', diamonds: 2750, priceLabel: '$9.99', bonusLabel: '+10% 보너스' },
  diamonds_x100: { name: '다이아 30,000', diamonds: 30000, priceLabel: '$99.99', bonusLabel: '+20% 보너스' },
  // 프리미엄 패스(평생 1회): 광고 제거 + x4 영구 + 리롤 무료(픽당 1회) + 정산 골드 2배
  // 가격: 분석 권장 ₩19,000~29,000 (다이아 미지급 QoL 번들 — 고래팩가 회피, 전환율 확보)
  adFree: { name: '프리미엄 패스', priceLabel: '₩29,000', bonusLabel: '' },
} as const;

export type IapProductId = keyof typeof IAP_PRODUCTS;

/** 다이아 현금팩 묶음 (UI 표시 순서) */
export const DIAMOND_PACK_IDS = ['diamonds_x1', 'diamonds_x10', 'diamonds_x100'] as const;

/** 무료 다이아 광고 보상량 (×2.5 — 넉넉한 경제, 피드백) */
export const AD_FREE_DIAMONDS = 50;
/** 일일 리워드 광고 한도 (설계 06 권장 10~20회) */
export const DAILY_AD_LIMIT = 15;

interface MonetizationState {
  /** 광고 제거 buyout (평생 1회 결제) — 인터스티셜 제거 + x4 영구 해금 */
  adFree: boolean;
  /** 오늘 시청한 리워드 광고 수 */
  dailyAdCount: number;
  /** dailyAdCount 기준 날짜 (YYYY-MM-DD) */
  dailyAdDate: string;

  /** 리워드 광고 시청 가능 여부 (일일 한도) */
  canWatchAd: () => boolean;
  /** 광고 시청 완료 처리 — AdStubModal 종료 시 호출. 한도 초과 시 false */
  consumeAd: () => boolean;
  /** IAP 구매 (스텁: 즉시 지급). 실제 연동 시 스토어 결제 플로우로 교체 */
  purchase: (productId: IapProductId) => boolean;

  _reset: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useMonetizationStore = create<MonetizationState>()(
  persist(
    (set, get) => ({
      adFree: false,
      dailyAdCount: 0,
      dailyAdDate: today(),

      canWatchAd: () => {
        const s = get();
        if (s.dailyAdDate !== today()) return true; // 날짜 바뀜 — 리셋 예정
        return s.dailyAdCount < DAILY_AD_LIMIT;
      },

      consumeAd: () => {
        const s = get();
        const isToday = s.dailyAdDate === today();
        const count = isToday ? s.dailyAdCount : 0;
        if (count >= DAILY_AD_LIMIT) return false;
        set({ dailyAdCount: count + 1, dailyAdDate: today() });
        return true;
      },

      purchase: (productId) => {
        // 스텁: 결제 성공 가정 후 즉시 지급
        const progress = useProgressStore.getState();
        switch (productId) {
          case 'diamonds_x1':
          case 'diamonds_x10':
          case 'diamonds_x100':
            progress.addDiamonds(IAP_PRODUCTS[productId].diamonds);
            return true;
          case 'adFree':
            if (get().adFree) return false; // 중복 구매 방지
            set({ adFree: true });
            return true;
        }
      },

      _reset: () => set({ adFree: false, dailyAdCount: 0, dailyAdDate: today() }),
    }),
    {
      name: 'tower-offense-monetization',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
