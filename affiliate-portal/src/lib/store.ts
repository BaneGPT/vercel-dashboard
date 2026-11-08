'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Affiliate {
  id: string;
  username: string;
  email: string;
  walletAddress: string;
  referralCode: string;
  commissionRate: number; // percentage (e.g., 70 for 70%)
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  campaignCount: number;
  infectionCount: number;
  createdAt: string;
  lastLogin: string;
  status: 'active' | 'suspended' | 'banned';
}

interface AffiliateState {
  affiliate: Affiliate | null;
  isAuthenticated: boolean;
  setAffiliate: (affiliate: Affiliate | null) => void;
  logout: () => void;
  updateEarnings: (delta: number) => void;
}

export const useAffiliateStore = create<AffiliateState>()(
  persist(
    (set) => ({
      affiliate: null,
      isAuthenticated: false,
      setAffiliate: (affiliate) => set({ affiliate, isAuthenticated: !!affiliate }),
      logout: () => set({ affiliate: null, isAuthenticated: false }),
      updateEarnings: (delta) =>
        set((state) => ({
          affiliate: state.affiliate
            ? {
                ...state.affiliate,
                totalEarnings: state.affiliate.totalEarnings + delta,
                pendingEarnings: state.affiliate.pendingEarnings + delta,
              }
            : null,
        })),
    }),
    {
      name: 'chaos-affiliate-storage',
      partialize: (state) => ({ affiliate: state.affiliate, isAuthenticated: state.isAuthenticated }),
    }
  )
);