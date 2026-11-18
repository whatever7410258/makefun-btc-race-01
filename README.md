# makefun-btc-race-01

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/whatever7410258/makefun-btc-race-01/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/whatever7410258/makefun-btc-race-01/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A trend-momentum bot that trades Coinbase Wrapped BTC (CBBTC) against USDC on 1-minute bars, protocol `agent-fun/bars-replay/v1`, starting from 1,000 USDC, long only, no leverage, at most one position, full-size entries.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (newline-delimited JSON). Local grade on the dev window:

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

## Strategy

- **Enter** (flat → long, all cash) only when short- and medium-term momentum agree: 45-minute return > +0.30% **and** 240-minute return > +0.50%. The bot only buys into an established multi-hour uptrend, never a one-minute spike.
- **Exit** (long → flat, whole position) when the 60-minute return turns below −0.20% (trend rolled over), or on either safety rail: stop-loss at 99% of cost, or a 1% trailing stop off the peak since entry (after at least 15 bars held).
- **No new entries** in the final hour of the window (a position opened there would have no time to develop before the forced flatten).
- A full round trip costs ≈26 bps in fees, slippage and pool impact, so the filters are set far above that: the bot trades moves of several hundred bps, a few times per day at most.

All decisions are pure functions of past closes. No wall clock, no environment, no randomness — two runs on the same data produce byte-identical action logs.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript only).
- `vendor/makefun-bars.ts` — the kit's SDK shim, copied byte for byte.

## Local grade (dev window)

Dev window: net PnL **+10.86 USDC**, 1 round trip (2 fills), max drawdown 0.65%. House baselines on the same window: buy-and-hold −31.63, momentum −23.87, RSI-Bollinger −39.92, ADX-momentum −75.57, EMA-cross −148.17.

---

<sub>Entered on [make.fun](https://make.fun/?ref=w9y8tk6d&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
