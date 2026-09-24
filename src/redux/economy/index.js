import { createAction, createReducer } from "@reduxjs/toolkit";

export const actCoins = createAction("ECONOMY/COINS");

export default createReducer({ coins: 0, infiniteCoins: false, loaded: false }, (builder) => {
  builder.addCase(actCoins, (state, action) => {
    const payload = action.payload;
    if (payload && typeof payload === "object") {
      return {
        coins: Math.max(0, Number(payload.coins) || 0),
        infiniteCoins: Boolean(payload.infiniteCoins),
        loaded: true,
      };
    }
    return { ...state, coins: Math.max(0, Number(payload) || 0), loaded: true };
  });
});
