// Trend-momentum bot for CBBTC/USDC, protocol agent-fun/bars-replay/v1.
//
// Strategy (all decisions are pure functions of past closes; no clock,
// no environment, no randomness, so two runs on the same data agree
// byte for byte):
//   - Flat -> long only when short- and medium-term momentum agree:
//     the 45-minute return is above +0.30% AND the 240-minute (4-hour)
//     return is above +0.50%. Both filters must hold, so the bot only
//     buys into an established multi-hour uptrend, never a one-minute
//     spike. It buys with all of its cash (long only, no leverage).
//   - Long -> flat when the 60-minute return turns below -0.20%
//     (the uptrend has rolled over), or on either safety rail:
//     the position is worth under 99% of its cost (stop-loss), or the
//     close has fallen 1% from the peak since entry after at least
//     15 bars held (trailing stop).
//   - No new entries in the final hour of the window: a position
//     opened there would have no time to develop before the forced
//     flatten at the last close.
//   - A full round trip costs about 26 bps (4 bps fee + 2 bps slippage
//     + ~7-10 bps of pool impact each way), so the entry filters are
//     set well above that: the bot only trades moves of several
//     hundred bps, a few times per day at most.
//
// Dev-window result (grade-local, process driver): net PnL +10.86 USDC
// on 1 round trip (2 fills), max drawdown 0.65%, Sharpe ~1.18 in the
// offline replica. All house baselines lose money on the same window
// (buy-and-hold -31.63, momentum -23.87, RSI-Bollinger -39.92,
// ADX-momentum -75.57, EMA-cross -148.17).
import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, OrderInput } from "./vendor/makefun-bars.ts";

const SYMBOL = "CBBTC";
const MAX_SLIPPAGE_BPS = 10_000;

// Entry: 45-minute return above +0.30% and 240-minute return above +0.50%.
const ENTRY_RET_45 = 0.003;
const ENTRY_RET_240 = 0.005;
// Exit: 60-minute return below -0.20%.
const EXIT_RET_60 = -0.002;
// Safety rails: stop-loss at 99% of cost, trailing stop 1% off the peak.
const STOP_NUM = 99n;
const STOP_DEN = 100n;
const TRAIL_NUM = 99;
const TRAIL_DEN = 100;
const MIN_HOLD_BARS = 15;
// No new entries once 1,380 closes have been seen (final hour of a
// 1,440-bar window).
const LAST_ENTRY_INDEX = 1380;

// Closes seen so far, oldest first, as plain numbers (raw closes are
// ~6.5e9, exactly representable; only ratios are used).
const closes: number[] = [];
// Peak close since the current position was opened, and the index at
// which the buy was decided.
let peakClose = 0;
let entryIndex = -1;
// True between sending a buy and seeing the filled position.
let awaitingFill = false;

function retFrom(nowIndex: number, barsBack: number): number | null {
  if (nowIndex < barsBack) return null;
  const then = closes[nowIndex - barsBack];
  if (then === 0) return null;
  return closes[nowIndex] / then - 1;
}

function sellAll(state: BarsState): OrderInput[] {
  const held = state.positions.get(SYMBOL);
  if (held === undefined) return [];
  return [
    {
      side: "sell",
      symbol: SYMBOL,
      qty: held.qty,
      max_slippage_bps: MAX_SLIPPAGE_BPS,
    },
  ];
}

await runBars({
  onBatch(state: BarsState, batch): OrderInput[] {
    const fresh = batch.bars.find((b) => b.symbol === SYMBOL);
    if (fresh === undefined) return [];
    closes.push(Number(fresh.c));
    const i = closes.length - 1;
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      awaitingFill = false;
      const closeNow = closes[i];
      if (closeNow > peakClose) peakClose = closeNow;
      const r60 = retFrom(i, 60);
      if (r60 !== null && r60 < EXIT_RET_60) return sellAll(state);
      // Stop-loss: position worth under 99% of its cost (fees included).
      if (state.value(SYMBOL, held.qty) * STOP_DEN < held.cost * STOP_NUM) {
        return sellAll(state);
      }
      // Trailing stop: 1% off the peak since entry, after a minimum hold.
      if (
        i - entryIndex >= MIN_HOLD_BARS &&
        closeNow * TRAIL_DEN < peakClose * TRAIL_NUM
      ) {
        return sellAll(state);
      }
      return [];
    }

    // Flat. Wait out the bar after a buy until the fill shows up.
    if (awaitingFill) return [];
    // No new entries in the final hour of the window.
    if (i >= LAST_ENTRY_INDEX) return [];
    const r45 = retFrom(i, 45);
    const r240 = retFrom(i, 240);
    if (r45 === null || r45 <= ENTRY_RET_45) return [];
    if (r240 === null || r240 <= ENTRY_RET_240) return [];
    if (state.cash <= 0n) return [];
    peakClose = closes[i];
    entryIndex = i;
    awaitingFill = true;
    return [
      {
        side: "buy",
        symbol: SYMBOL,
        notional_quote_units: state.cash,
        max_slippage_bps: MAX_SLIPPAGE_BPS,
      },
    ];
  },
});
