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

/** IAP 상품 정의 (가격은 출시 전 확정 — 설계 06) */
export const IAP_PRODUCTS = {
  diamondsSmall: { name: '다이아 200', diamonds: 200, priceLabel: '$1.99' },
  diamondsLarge: { name: '다이아 1,200', diamonds: 1200, priceLabel: '$9.99' },
  goldPack: { name: '금화 5,000', gold: 5000, priceLabel: '$2.99' },
  adFree: { name: '광고 제거 + x4 영구', priceLabel: '$9.99' },
} as const;

export type IapProductId = keyof typeof IAP_PRODUCTS;

/** 무료 다이아 광고 보상량 */
export const AD_FREE_DIAMONDS = 20;
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
          case 'diamondsSmall':
            progress.addDiamonds(IAP_PRODUCTS.diamondsSmall.diamonds);
            return true;
          case 'diamondsLarge':
            progress.addDiamonds(IAP_PRODUCTS.diamondsLarge.diamonds);
            return true;
          case 'goldPack':
            progress.addGold(IAP_PRODUCTS.goldPack.gold);
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
