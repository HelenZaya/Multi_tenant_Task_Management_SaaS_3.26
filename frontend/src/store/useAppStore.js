import { create } from "zustand";

export const useAppStore = create((set) => ({
  me: null,
  loading: true,
  boards: [],
  setMe: (me) => set({ me }),
  setLoading: (loading) => set({ loading }),
  setBoards: (boards) => set({ boards })
}));
