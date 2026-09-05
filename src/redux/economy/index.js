import { createAction, createReducer } from "@reduxjs/toolkit";

export const actCoins = createAction("ECONOMY/COINS");

export default createReducer({ coins: 0, loaded: false }, (builder) => {
  builder.addCase(actCoins, (state, action) => ({ coins: Math.max(0, Number(action.payload) || 0), loaded: true }));
});
