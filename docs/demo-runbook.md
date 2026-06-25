# NhipSang — Demo Runbook (kịch bản quay video 2–3 phút)

> Kịch bản quay từng bước, theo đúng thứ tự. Mỗi bước ghi: **thao tác** · **cái cần thấy trên màn** · **lời thoại 1 câu**. Bám sát tính năng đã build (scenario runner, gate-bites, Trace panel, failsafe) — không hứa cái chưa có.

> **Bản deploy (production):** https://lights-music-git-main-hoanghiepbks-projects.vercel.app — tự build lại mỗi lần push lên `main`.

## Chuẩn bị trước khi bấm REC
- `pnpm install` (1 lần) → `pnpm dev` mở sẵn `localhost:5173`.
- Mở sẵn 2 thứ: **(a)** trình duyệt ở simulator, **(b)** terminal thứ hai cho bước 5.
- **Track nhạc nên có bass-drop rõ** để cảnh sync đẹp (kick mạnh → onset bắt rõ).
- **Bật Trace panel suốt video** — đó là nơi logic an toàn hiện thành số, là điểm bán hàng kỹ thuật.
- (Tùy chọn) mở tab GitHub Actions sẵn cho bước 6 — **chỉ khi đã git re-root + push** (xem `verification.md §6`); chưa re-root thì bỏ bước 6 hoặc quay sau.
- Tổng thời lượng mục tiêu: **~2 phút 20s**.

---

## Bước 1 — Mở đầu / front-door (10s)
- **Thao tác:** mở `README.md` trên GitHub (hoặc IDE preview) → lướt badge CI + sơ đồ Mermaid.
- **Cần thấy:** tên **NhipSang**, badge **CI xanh**, sơ đồ kiến trúc `Music → MHU → gateway → BCM → 6-zone RGB`.
- **Lời thoại:** *"NhipSang — đèn ambient nháy theo nhạc, native trên MHU VinFast, an toàn theo chuẩn ô tô. MHU đề xuất, ECU quyết."*

## Bước 2 — Cabin sync (30s)
- **Thao tác:** ở simulator, để xe **đỗ (gear P)** → chọn preset (vd `energetic`) → **play track** qua audio picker.
- **Cần thấy:** 6 zone cabin **nháy/đổi màu theo nhạc**; beat ripple bật trên kick. Trace: **`computeMs`** hiện số (vài ms), **winner = `music`**, các pip policy-gate sáng theo nhịp.
- **Lời thoại:** *"Đỗ xe thì full effect — 6 zone phản ứng nhạc thật, FFT + onset tự code. Trace bên phải cho thấy arbiter đang chọn music và độ trễ tính toán."*

## Bước 3 — Scenario runner (40s) — hands-free
- **Thao tác:** bấm **"Chạy kịch bản"** một lần, không chạm gì thêm (~30s timeline tự chạy).
- **Cần thấy, theo mốc:**
  - **P → D** (xe chuyển sang lái): Trace **`driving = on`**, dashboard **dịu xuống** (brightness cap ≤35% — INV-3), **beat tắt** ở vùng tài xế (INV-2).
  - **speed → 60**: hiệu ứng giữ trạng thái lái.
  - **seatbelt warn**: Trace **winner = `safety`**, cabin bật **telltale** (đỏ/amber cảnh báo — được miễn restriction vì là cảnh báo hợp lệ).
  - **về P**: full effect quay lại.
- **Lời thoại:** *"Khác kit aftermarket — NhipSang biết xe đang lái hay đỗ. Vào D thì tự dịu và tắt nháy; cảnh báo dây an toàn thì music nhường ngay cho safety. Toàn bộ hands-free."*

## Bước 4 — Idle & failsafe (20s)
- **Thao tác:** (a) **stop nhạc** → quan sát; (b) tạo **fault** — nhập **URL audio hỏng** vào picker (hoặc ngắt transport).
- **Cần thấy:**
  - Stop nhạc → cabin về **theme wash** dịu (D-006), **không** phải failsafe — Trace winner = `theme`.
  - Fault → cabin về **failsafe dim** (màu trung tính, sáng thấp — INV-5), Trace **winner = `FAILSAFE`** + pip `fault → failsafe`.
- **Lời thoại:** *"Không nhạc thì về theme nền — không chết đèn. Nhưng khi có lỗi thật, hệ về failsafe an toàn, không bao giờ kẹt ở trạng thái nháy."*

## Bước 5 — Gate cắn thật (30s) — điểm nhấn kỹ thuật
- **Thao tác:** ở terminal, chạy cạnh nhau:
  ```bash
  pnpm test:critical        # 18 passed — xanh
  pnpm test:demo:violation  # 2 failed — đỏ CÓ CHỦ ĐÍCH
  ```
- **Cần thấy:** `test:critical` **18 passed (xanh)**; `test:demo:violation` in **đỏ** + tên INV vỡ:
  `× INV-1 is VIOLATED on raw output: saturated red persists in a driver zone` và `× INV-2 ... parked flash exceeds 3 Hz (expected 10 ≤ 3)`.
- **Lời thoại:** *"6 bất biến an toàn không phải slide — chúng là test chặn merge. Bỏ Policy Gate đi thì đỏ ngay. Gate chính là thứ biến đỏ thành xanh."*

## Bước 6 — CI (10s) — *chỉ khi đã re-root + push*
- **Thao tác:** mở tab **GitHub → Actions**, chỉ vào run mới nhất.
- **Cần thấy:** job CI **xanh**, step **Critical gate (required)** pass.
- **Lời thoại:** *"Cùng bộ eval chạy trên CI — Critical là required check, preset mới phải qua cổng này mới được ship. Eval-as-code chính là cổng release."*
- **Nếu chưa re-root:** bỏ bước này, hoặc thay bằng cảnh quay `.github/workflows/ci.yml` trong IDE + 1 câu *"CI đã viết sẵn, kích hoạt khi publish"*.

---

## Câu chốt (5s)
*"Demo chạy trên laptop nhưng mô phỏng trung thực ranh giới lên xe thật — HAL swappable, schema thật, latency ghi rõ. Đây là cách VinFast giữ trải nghiệm và doanh thu phụ kiện in-house, an toàn hơn aftermarket."*

---

### Ghi chú quay
- Quay **Trace panel** rõ nét ở mọi cảnh cabin — số `computeMs` + winner + pips là bằng chứng "logic an toàn đang chạy", không phải hiệu ứng trang trí.
- Bước 5 nên **zoom terminal** đủ to để đọc tên INV vỡ — đó là khoảnh khắc thuyết phục nhất.
- Nếu thiếu Supabase env, transport hiện `disconnected` (bình thường) — **không** ảnh hưởng bước 2–5; chỉ trạng thái `connected` ở Trace là env-gated.
- Tổng: B1 10s · B2 30s · B3 40s · B4 20s · B5 30s · B6 10s + chốt 5s ≈ **2 phút 25s**.
