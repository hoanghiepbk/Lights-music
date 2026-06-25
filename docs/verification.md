# NhipSang — Verification (nghiệm thu ngược)

> Bước VERIFY (TIP-010) của Vibecode Kit. Đối chiếu toàn hệ đã build với Blueprint + 6 bất biến an toàn + Decisions Log, gắn **bằng chứng thật** (file / test) cho từng dòng. Mọi kết quả dưới đây chạy thật ngày 2026-06-25, không tô hồng.

---

## 1. Kết quả full verify (chạy thật)

| Gate | Lệnh | Kết quả | Thời gian |
|------|------|---------|-----------|
| Typecheck | `pnpm typecheck` | ✅ 0 lỗi (schema · simulator · eval — strict + `noUncheckedIndexedAccess`) | ~1.7s |
| Lint | `pnpm lint` | ✅ 0 lỗi (eslint flat, core-purity rule active) | ~1.4s |
| Test (mặc định) | `pnpm test` | ✅ **43 passed** / 9 files (critical + quality, demo **không** chạy) | ~1.7s |
| Critical tier | `pnpm test:critical` | ✅ **18 passed** / 2 files (invariants 14 + faultInjection 4) | ~1.6s |
| Quality tier | `pnpm test:quality` | ✅ **25 passed** / 7 files | ~1.6s |
| Demo "gate cắn" | `pnpm test:demo:violation` | ❌ **2 failed — ĐỎ CÓ CHỦ ĐÍCH** (exit 1): INV-1 raw red leak · INV-2 raw 10 onset/s > 3 Hz | ~1.5s |
| Build | `pnpm build` | ✅ OK — `tsc --noEmit && vite build`, **101 modules**, `built in 1.09s` (js 376.87 kB / gzip 108.73 kB) | ~2.8s |

`test:demo:violation` đỏ là **đúng kỳ vọng**: nó assert trên output RAW (chưa qua Policy Gate) để chứng minh gate thật sự "cắn". Output đỏ in rõ INV nào vỡ:
- `× INV-1 is VIOLATED on raw output: saturated red persists in a driver zone` (`demo/gate-bites.demo.test.ts:23`)
- `× INV-2 is VIOLATED on raw output: parked flash exceeds 3 Hz` → `expected 10 to be less than or equal to 3` (`:31`)

---

## 2. Ma trận REQ → trạng thái + bằng chứng

> **⚠️ Lưu ý nguồn (RULE 7 — minh bạch):** RRI gốc của Chủ thầu (`.vibecode/02-rri-report.md` chứa REQ-001…REQ-035) **không có trong repo của Builder** — repo chỉ chứa `reports/` (TIP-001…009). Vì vậy:
> - **4 REQ-ID được xác nhận tường minh** trong code/report: **REQ-019** (`audio/fft.ts:3`), **REQ-029** (`reports/TIP-005`), **REQ-031** (`App.tsx:152`, `scenarioRunner.ts:1`), **REQ-034** (`reports/TIP-009`). Các ID này neo chắc.
> - Các dòng còn lại liệt kê theo **năng lực MUST thật đã build** (từ `design.md` Phụ lục C + 7 completion reports), mỗi dòng gắn bằng chứng file/test. Cột "RRI-ID" để trống (`—`) khi chưa đối chiếu được — **cần Chủ thầu map về REQ-ID chính tắc** từ RRI gốc. Đây là gap đã ghi ở §6.
> - "#" là chỉ số liệt kê của Builder, **không phải** REQ-ID chính tắc.

### A. Audio pipeline
| # | RRI-ID | Năng lực (MUST) | Trạng thái | Bằng chứng |
|---|--------|-----------------|-----------|-----------|
| 01 | **REQ-019** | FFT tự code, không lib DSP nặng | ✅ | `simulator/src/audio/fft.ts`; `eval/quality/audio.test.ts` (band response 100Hz→bass, 8kHz→high) |
| 02 | — | Onset detection (energy + spectral flux, refractory, warmup) | ✅ | `audio/featureExtractor.ts`; `audio.test.ts` (onset: silence→impulse→silence) |
| 03 | — | 3-band energy + AGC + attack/release smoothing | ✅ | `featureExtractor.ts`; `audio.test.ts` (AGC bounded & alive, smoothing decay) |
| 04 | — | Extractor pure & deterministic (no `Date.now`/random) | ✅ | `eval/quality/determinism.test.ts`; `audio.test.ts` (determinism `toEqual`) |
| 05 | — | Audio source import-safe trong node (browser API cô lập) | ✅ | `audio/webAudioSource.ts`; `audio.test.ts` (imports without throwing in node) |
| 06 | — | Audio tap post-mix spectral envelope (đường lên xe thật) | ⏳ N-A (design) | `design.md §2` — thiết kế target; sim dùng file/URL qua WebAudioSource |

### B. Schema & HAL contracts
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 07 | — | `LightingCommand` 6-zone resolved color + beat + band + preset | ✅ | `schema/src/wire.ts`; `eval/quality/contracts.test.ts` |
| 08 | — | `VehicleState` (gear · speed · seatbelt · HVAC · ADAS) | ✅ | `schema/src/vehicle.ts`; `contracts.test.ts` |
| 09 | — | HAL interfaces swappable (AudioSource / LightingTransport / VehicleStateSource) | ✅ | `schema/src/hal.ts` (interface-only); impl ở simulator |
| 10 | — | Band named ↔ packed tuple, convert ở arbiter/transport (**D-002**) | ✅ | `schema/src/audio.ts` (named) + `wire.ts` (tuple) |

### C. Pattern engine + Lighting Arbiter
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 11 | — | Pattern engine: features → per-zone `ZoneColor` + `flashHz` | ✅ | `core/patternEngine.ts` |
| 12 | — | 3 mood preset (calm / energetic / warm), không đỏ/xanh bão hòa mặc định | ✅ | `core/presets.ts` |
| 13 | — | Lighting Arbiter ưu tiên `Safety>HVAC>Music>Theme`, deterministic (INV-6) | ✅ | `core/arbiter.ts`; `critical/invariants.test.ts` (arbiter ordering) |
| 14 | — | Đa nguồn (safety / hvac / music / theme requests) | ✅ | `core/sources.ts` |

### D. Distributed rendering + Transport
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 15 | — | Gửi **param cấp cao** (6-zone), không per-LED 60fps | ✅ | `wire.ts`; `design.md §1–2` |
| 16 | — | Throttle ≤ 25 Hz (chống nghẽn bus) | ✅ | `transport/supabaseTransport.ts` (`createThrottledTransport`, 40ms); `quality/transport.test.ts` (100 sends/100ms → 3) |
| 17 | — | Transport Supabase Broadcast (channel `nhipsang-lighting`) | ✅ | `supabaseTransport.ts` (`createSupabaseTransport`) |
| 18 | — | Transport import-safe node + no-env → `disconnected` (không crash) | ✅ | `transport.test.ts` (no-env → disconnected, import-safe) |

### E. Policy Gate & an toàn (chi tiết INV ở §3)
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 19 | — | Policy Gate enforce INV-1/2/3 trên nguồn ambient | ✅ | `core/policyGate.ts` (`applyPolicy`); `critical/invariants.test.ts` |
| 20 | — | Safety telltale **miễn** restriction (cảnh báo hợp lệ) | ✅ | `policyGate.ts` (exempt pass-through); `invariants.test.ts` (INV-1/3 exempt) |
| 21 | — | Fail-safe khi fault (không phải idle) — **D-007/D-008** | ✅ | `core/resolver.ts` (fault short-circuit); `critical/faultInjection.test.ts` |
| 22 | — | Ngưỡng = hằng số đặt tên (no magic number), test import lại | ✅ | `policyGate.ts`/`flashLimiter.ts`; `invariants.test.ts` import `BRIGHTNESS_CAP_DRIVING`… |

### F. Simulator UI
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 23 | — | Cabin VF8 6-zone live glow + beat ripple | ✅ | `simulator/src/ui/CabinView.tsx` |
| 24 | **REQ-031** | Vehicle-state panel (gear/speed/temp/seatbelt/ADAS) điều khiển live | ✅ | `ui/VehicleStatePanel.tsx`; `App.tsx:152` |
| 25 | **REQ-029** | Trace panel: `computeMs` + arbiter winner + Policy-Gate pips (logic an toàn **nhìn thấy được**) | ✅ | `ui/TracePanel.tsx`; `reports/TIP-005` |
| 26 | — | Preset selector + audio picker (file/URL) | ✅ | `ui/PresetSelector.tsx`, `ui/AudioPicker.tsx` |
| 27 | — | Idle (không nhạc) → theme wash (**D-006**), không failsafe | ✅ | `engine/localLoop.ts`; `quality/localLoop.test.ts` (idle → winner theme) |
| 28 | — | HVAC = transient overlay ~2.5s (**D-005**) | ✅ | `localLoop.ts` (`HVAC_OVERLAY_MS=2500`) |

### G. Scenario runner (hands-free demo)
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 29 | **REQ-031** | Timeline 30s P→D→speed 60→seatbelt→P + captions, hands-free | ✅ | `engine/scenarioRunner.ts:1`; `quality/transport.test.ts` (fake-timer timeline) |

### H. Eval-as-code & CI
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 30 | — | 6 INV assert ở tier **Critical** (chặn merge) | ✅ | `eval/critical/invariants.test.ts` (14 tests) |
| 31 | — | Fault injection suite (audio loss / transport error / ECU disconnect / recovery) | ✅ | `eval/critical/faultInjection.test.ts` (4 tests) |
| 32 | — | Tiered split Critical / Quality (2 config) | ✅ | `eval/vitest.config.ts`, `eval/vitest.demo.config.ts` |
| 33 | — | "Gate cắn thật" — gate-bites demo đỏ có chủ đích | ✅ | `eval/demo/gate-bites.demo.test.ts`; `pnpm test:demo:violation` (exit 1) |
| 34 | — | `core/` purity machine-enforced (no React/DOM trong core) | ✅ | `eslint.config.js` (override); `reports/TIP-002` (demo rule bites) |
| 35 | — | CI GitHub Actions (Critical required, Quality informational) | ✅ workflow / ⏳ active | `.github/workflows/ci.yml`; **dormant tới khi re-root** (xem §6) |
| 36 | — | Latency `computeMs` đo thật + budget ghi trung thực | ✅ | `eval/quality/latency.test.ts` (median < 16ms); `TracePanel.tsx` |

### I. Front-door & docs
| # | RRI-ID | Năng lực | Trạng thái | Bằng chứng |
|---|--------|----------|-----------|-----------|
| 37 | **REQ-034** | README front-door + Mermaid + badge CI | ✅ | `README.md`; `reports/TIP-009` |
| 38 | — | Design doc 6 mục (kiến trúc / safety / signal schema / OTA / homologation / Q&A) | ✅ | `docs/design.md` |
| 39 | — | Verification matrix + demo runbook (TIP-010) | ✅ | `docs/verification.md` (file này), `docs/demo-runbook.md` |

---

## 3. Ma trận 6 bất biến an toàn (INV) → test Critical

Mọi INV được hiện thực là **pure function** và assert trong tier **Critical** (`eval/critical/`, 18 tests). Ngưỡng = hằng số đặt tên trong `core`, test **import lại** (drift ngưỡng ⇒ test đỏ).

| ID | Bất biến | Ngưỡng (design.md §3) | Test Critical assert | Bằng chứng nguồn | Trạng thái |
|----|----------|----------------------|----------------------|------------------|-----------|
| **INV-1** | Không đỏ/xanh dương bão hòa vùng tài xế khi `gear≠P` (safety **miễn**) | màu cấm theo state | `invariants.test.ts`: driving+red dashboard → recolour `SAFE_AMBER`; safety red → **giữ đỏ** | `policyGate.ts` (`isRestrictedHue`, `applyPolicy`, `SAFE_AMBER`) | ✅ |
| **INV-2** | Flash-rate cap | ≤3 Hz khi đỗ · không nháy beat khi lái | `invariants.test.ts`: driving+20 onset → mọi `beat=false`; parked 10Hz/1s → 3 beats | `flashLimiter.ts` (`FLASH_MAX_HZ_PARKED=3`) + `policyGate` driving | ✅ |
| **INV-3** | Brightness cap vùng tài xế khi `speed>5` (safety **miễn**) | ≤35% (full chỉ khi P) | `invariants.test.ts`: speed 60 → ≤0.35; parked → 1.0; safety → 1.0 uncapped | `policyGate.ts` (`BRIGHTNESS_CAP_DRIVING=0.35`) | ✅ |
| **INV-4** | Music nhường safety event | ≤100 ms (resolve ≤1 frame) | `invariants.test.ts`: `[theme,music,hvac,safety]` → safety thắng | `arbiter.ts`; `computeMs` đo < 16ms (`latency.test.ts`) | ✅ |
| **INV-5** | Fail-safe khi fault → safe state, không kẹt nháy | màu trung tính, sáng thấp | `invariants.test.ts` (empty → failsafe) + `faultInjection.test.ts` (audio/transport/ECU → `failSafe()`; recovery) | `policyGate.ts` (`failSafe`, `FAILSAFE_BRIGHTNESS=0.15`, `FAILSAFE_NEUTRAL_RGB`) + `resolver.ts` D-007 | ✅ |
| **INV-6** | Arbiter resolve đúng ưu tiên, deterministic | safety-first | `invariants.test.ts` (ordering) + `determinism.test.ts` (`toEqual`) | `arbiter.ts` (`PRIORITY_ORDER`) | ✅ |

**6/6 INV xanh trong Critical.** Mặt đối chứng: `test:demo:violation` cố tình bỏ qua gate → INV-1 & INV-2 đỏ, chứng minh gate là thứ giữ chúng xanh.

---

## 4. Ma trận Decisions (D-001…D-009) → phản ánh ở đâu

| ID | Quyết định (design.md Phụ lục B) | Phản ánh ở | Trạng thái |
|----|----------------------------------|-----------|-----------|
| **D-001** | Cân nhắc `nhipsang/` làm repo root cho front-door sạch | Layout `nhipsang/` (README + docs/ + .github/) — TIP-009 | ⏳ chờ git re-root (Hiệp) |
| **D-002** | Band: named (audio) ↔ packed tuple (wire), convert ở arbiter/transport | `schema/src/audio.ts` + `wire.ts`; `reports/TIP-002/004` | ✅ |
| **D-003** | Band level perceptual/relative (cross-band floor) | `featureExtractor.ts` (`relativeFloor=0.1`); `audio.test.ts` AGC | ✅ |
| **D-004** | `isRestrictedHue` heuristic RGB v1; HSV là hướng hardening | `policyGate.ts` (`RESTRICTED_HUE_DOMINANT/SUPPRESSED`); `invariants.test.ts` INV-1 | ✅ (hardening path ghi rõ) |
| **D-005** | HVAC = transient overlay ~2.5s, không thường trực | `localLoop.ts` (`HVAC_OVERLAY_MS=2500`) | ✅ |
| **D-006** | Theme = baseline thường trực; idle → theme wash | `localLoop.ts` (themeRequest always added); `localLoop.test.ts` | ✅ |
| **D-007** | Failsafe chỉ khi FAULT thật (không phải idle) | `resolver.ts` (`fault` param); `core.test.ts` + `faultInjection.test.ts` | ✅ |
| **D-008** | Chỉ transport `'error'` mới fault; `'disconnected'` thì lành | App fault aggregation; `transport.test.ts` | ✅ |
| **D-009** | Khuyến nghị `nhipsang/` làm repo root trước publish (front-door REQ-034) | TIP-009 layout + hand-off; Hiệp đã chốt nhipsang-as-root | ⏳ chờ git re-root (Hiệp) |

7/9 quyết định đã hiện thực + có bằng chứng. **D-001 & D-009** (cùng là quyết định repo-root) đã chốt hướng + layout sẵn sàng, chỉ chờ thao tác `git` re-root của Hiệp (đối ngoại/phá hủy — Builder không tự làm).

---

## 5. Phạm vi (Scope)

| Lớp | Nội dung | Trạng thái |
|-----|----------|-----------|
| **MUST** ✅ | Simulator (cabin VF8 6 zone + vehicle-state panel + Trace panel) · audio DSP tự code · core 6 bất biến · transport Supabase Broadcast · scenario runner · eval-as-code tiered CI + gate-bites demo | **Đã build & verify** (43 test xanh, build OK) |
| **SHOULD** ⏳ | Demo vật lý ESP32 + WS2812B (TIP-008) | **Chưa làm — cần phần cứng.** `firmware/` mới có stub PlatformIO (TIP-001), ngoài pnpm workspace |
| **WON'T (v1)** | Tích hợp SA8295/AAOS thật · OTA thật · ML mood/genre classifier | **Đúng phạm vi** — chỉ là thiết kế trong `design.md` |

Mọi phần "trên xe thật" trong design.md là thiết kế, đánh dấu rõ; bản demo mô phỏng trung thực ranh giới đó (HAL interface swappable, schema thật, latency ghi rõ phần đo / phần target).

---

## 6. Gap check — còn lại trước khi nộp VinFast

**Phụ thuộc Hiệp (không phải lỗi code):**
1. **Git re-root + push (D-009)** — đưa `nhipsang/` thành repo root. Tới khi xong: `docs/` còn bị `.gitignore` gốc loại, `ci.yml` chưa được GitHub chạy, badge chưa "sống". Cần Hiệp chốt: (a) repo đích `hoanghiepbk/nhipsang` hay giữ `Lights-music`, (b) đồng ý force-push. Chi tiết: `reports/TIP-009-completion.md`.
2. **Deploy Vercel** → điền link live demo vào README (placeholder `_<Vercel link — Thợ điền>_`).
3. **Quay video** → điền link vào README. Kịch bản: `docs/demo-runbook.md`.
4. **Bật branch protection "ci required"** trên GitHub để Critical thật sự chặn merge.
5. **Tạo Supabase project** (URL + anon key vào `simulator/.env`) để demo transport ở trạng thái `connected`; thiếu env app vẫn chạy local bình thường.

**AC thủ công còn treo (cần mắt người qua `pnpm dev`):**
6. TIP-003 AC5 — nhạc thật → features (band tracking + onset trên kick).
7. TIP-005 AC4 — cabin phản ứng track thật, Trace pips/dimming trên màn.
8. TIP-006 AC4 — Supabase connected (env-gated), scenario chạy ~30s, theme wash khi stop nhạc.
   → Logic của 6–8 đã được test tự động phủ; chỉ phần visual/interaction cần xác nhận bằng mắt.

**SHOULD chưa làm:**
9. TIP-008 firmware ESP32 + WS2812B — cần phần cứng.

**Đối chiếu tài liệu (RULE 7):**
10. **RRI gốc (`02-rri-report.md`) không có trong repo Builder** → REQ-ID chính tắc cho các dòng `—` ở §2 cần Chủ thầu map lại từ RRI. 4 ID đã neo (019/029/031/034). Năng lực thì đã verify đầy đủ; chỉ thiếu nhãn ID.

---

*Verify chạy 2026-06-25 trên Windows/Node 24 local. CI target Node 20. Số liệu = output thật, không chỉnh.*
