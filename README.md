# Receiver

An AM receiver that holds six recordings. Turn the knob slowly — the band answers
back with static, and the songs only exist at the exact frequencies where they were
put.

The dial is not decoration. Six of the transmissions are hidden in the band between
the printed numbers, and once the band is mapped there is one more frequency that was
never printed on the scale.

## Contents

Everything personal lives in one file:

    src/data/set.ts

| Field | What it does |
| --- | --- |
| `STATIONS[].name` | Printed on the dial once that frequency is found |
| `STATIONS[].kHz` | Where on the band the recording sits |
| `STATIONS[].audio` | Filename inside `public/tracks/` |
| `BAND.min` / `BAND.max` | Endpoints of the sweep |
| `REACH` | How wide each transmission bleeds, in kHz. Higher is easier to find |
| `LOCK_LEVEL` | Signal strength needed to lock on. Higher is fussier |
| `FINALE` | Lines that appear on the dial at the unmarked frequency |
| `PLATE` | Engraved text on the top deck |

## Audio

Drop the files in `public/tracks/`. Match `one.mp3` … `six.mp3`, or point `audio` at
whatever you like. Mono at 64 kbps is enough — the signal chain rolls off above 5 kHz
anyway, so anything higher is wasted bytes on a phone connection.

A missing file is not fatal: that frequency still resolves, and its name prints with a
strike through it.

## Running it

    npm install
    npm run dev

## Controls

The knob and the dial glass both tune. Holding a drag past a moment drops into fine
tuning. Double-tap the knob to latch fine tuning on. Arrow keys work when the knob has
focus; space is the power switch. Holding RESET wipes what has been found.
