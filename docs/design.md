# NhipSang — Design Document

> Music-reactive ambient lighting, tích hợp native trên MHU VinFast.
> Tài liệu này mô tả kiến trúc, lập luận an toàn, và con đường lên phần cứng thật. Bản demo (simulator + eval-as-code) hiện thực hóa các quyết định ở đây; phần "trên xe thật" là thiết kế, đánh dấu rõ.

---

## Bối cảnh & định vị

Xe VinFast đã có ambient lighting từ nhà máy nhưng cơ bản (vài mode, đặt sâu trong khe nên tối). Chủ xe đang mua kit aftermarket "nháy theo nhạc" (2–5 triệu, điều khiển qua app điện thoại, **không kết nối gì với xe**). NhipSang đưa trải nghiệm đó vào trong: native trên MHU, an toàn theo chuẩn ô tô, cộng sinh với hệ đèn/cảnh báo sẵn có, và đóng gói được như một feature OTA/add-on. Định vị không phải "làm đèn nháy" mà là **giành lại trải nghiệm + doanh thu đang chảy ra tiệm độ, và làm nó an toàn hơn aftermarket**.

Khác biệt cốt lõi so với kit aftermarket: kit chạy **mù** — không biết xe đang lái hay đỗ, không nhường cảnh báo an toàn. NhipSang biết, và đó là toàn bộ giá trị kỹ thuật.

---

## 1. Kiến trúc hệ thống

Pipeline: `audio tap → FFT/onset → pattern engine → Lighting Arbiter → transport → Policy Gate → render LED`.

Ba trụ phân biệt thiết kế automotive với một hiệu ứng tay ngang:

**Lighting Arbiter** (trên MHU) — nhiều nguồn cùng muốn điều khiển đèn (cảnh báo an toàn, phản hồi HVAC, music, theme tĩnh). Arbiter giải quyết theo độ ưu tiên tuyệt đối `Safety > HVAC > Music > Theme`, deterministic, trong ≤1 frame. Kit aftermarket không có tầng này.

**Distributed rendering** — MHU **không** đẩy giá trị từng LED ở 60fps xuống bus (sẽ gây nghẽn). MHU chỉ gửi **tham số cấp cao** (màu 6 zone đã qua policy, beat trigger, band level, preset id) ở ~25 Hz; ECU/BCM **tự nội suy và render animation cục bộ** bằng PWM ở tần số cao. Đây là ràng buộc vật lý của mạng xe, không phải lựa chọn thẩm mỹ.

**Policy Gate** (ở BCM/ECU) — enforce an toàn theo trạng thái xe trước khi cấp điện cho LED. Nguyên tắc chủ đạo của toàn hệ: **MHU đề xuất, ECU quyết.** MHU (Android, không phải nguồn tin cậy cho quyết định an toàn) gửi *mong muốn*; ECU áp chính sách an toàn rồi mới drive đèn.

```
              Music                         Vehicle signals
                │                    (gear, speed, seatbelt, HVAC, ADAS)
                ▼                                   │
   ┌──────────── MHU (Android IVI) ────────────────┼────────┐
   │ audio tap → FFT/onset → pattern engine        │        │
   │                          │                     ▼        │
   │                          └──► LIGHTING ARBITER ◄────────┤
   │                                   │ (priority resolve)  │
   └───────────────────────────────────┼─────────────────────┘
                       SOME-IP/Ethernet │  (param cấp cao, ~25Hz)
                                        ▼
                              zonal/body gateway
                                        │ CAN-FD
                                        ▼
                          BCM/Ambient ECU — POLICY GATE
                          + render animation cục bộ (PWM)
                                        ▼
                                RGB strips — 6 zone
```

---

## 2. Signal schema (thiết kế thật, theo chặng)

Đặc tả thật từng chặng — đây là phần chống câu vặn "LED driver của em có cổng Ethernet à?". **Protocol đổi theo chặng** vì node lá là MCU nhỏ, không có Ethernet:

| Chặng | Protocol | Nội dung | Tần số |
|-------|----------|----------|--------|
| MHU → zonal/body gateway | SOME-IP / Automotive Ethernet | `LightingCommand` (6-zone color đã policy + beat + band + preset) | ~25 Hz (throttled) |
| gateway → BCM/Ambient ECU | CAN-FD (ID ví dụ `0x3A0`, cycle 20ms) | payload nhỏ, priority thấp hơn frame an toàn | 20ms |
| BCM → LED strip | PWM cục bộ | ECU tự render animation từ param | tần số cao cục bộ |

`LightingCommand` mang **per-zone resolved color** (6 zone) — vẫn là "high-level" (per-zone, không per-LED): ECU nhận màu mục tiêu mỗi zone rồi tự nội suy/animate/PWM. Đây là điểm cân bằng giữa "đủ điều khiển để enforce policy theo zone" và "không làm nghẽn bus".

Lưu ý audio tap (đường lên target thật): tap ở **mixed/post-mix output dưới audio HAL** (post-processing effect của AAOS), **không** phải luồng app-specific. Với nội dung DRM (Spotify…), hệ **không giải mã/không tái tạo audio** — chỉ lấy **spectral envelope** (3-band energy + onset) để drive ánh sáng = phân tích đặc trưng, không sao chép nội dung. Fallback nếu policy DRM chặn tap sau mixer: tap ở **DSP của amplifier** (vùng tin cậy nội bộ sau khi đã giải mã).

---

## 3. Phân rã an toàn (functional safety)

Đèn cabin music-reactive là tính năng giải trí (QM), nhưng nó **chia sẻ tài nguyên với chức năng an toàn** (cảnh báo, đèn telltale) nên phải được gate đúng. Cách phân rã:

- **MHU (pattern/arbiter) = QM**, không phải nguồn tin cậy cho quyết định an toàn.
- **Policy Gate ở ECU** = nơi enforce ràng buộc an toàn theo trạng thái xe; ECU là thành phần đáng tin hơn cho việc này.
- **6 bất biến an toàn** được hiện thực thành pure-function và **assert bằng eval-as-code trong CI (tier Critical)**:

| ID | Bất biến | Ngưỡng |
|----|----------|--------|
| INV-1 | Không đỏ/xanh dương bão hòa ở vùng tài xế khi `gear≠P` | màu cấm theo state |
| INV-2 | Flash-rate cap | ≤3 Hz khi đỗ · không nháy beat khi lái (≤0.5 Hz/tĩnh) |
| INV-3 | Brightness cap vùng tài xế khi `speed>5` | ≤35% (full chỉ khi P) |
| INV-4 | Music nhường safety event | ≤100 ms |
| INV-5 | Fail-safe khi fault | về safe state, không kẹt nháy |
| INV-6 | Arbiter resolve đúng ưu tiên | safety-first, deterministic |

**Phân biệt then chốt — ambient vs safety telltale:** restriction INV-1/2/3 áp cho **nguồn ambient** (music/theme/hvac). **Cảnh báo an toàn được miễn** — đèn telltale dây an toàn/ADAS dùng màu đỏ/amber, nhấp nháy, độ sáng đầy đủ là **chức năng cảnh báo hợp lệ**; bóp nó đi mới là sai. Arbiter cho safety thắng tuyệt đối; Policy Gate không can thiệp trình bày của safety.

**Fail-safe (INV-5):** khi có fault thật (mất tín hiệu audio, transport timeout, ECU/node disconnect) → hệ về trạng thái tĩnh an toàn (màu trung tính, độ sáng thấp), **không bao giờ kẹt ở trạng thái nháy/ngẫu nhiên**. Fault được tách bạch với idle (không nhạc → hiện theme wash, không phải failsafe).

**Latency budget (sync):** `FFT/onset ≤15ms · pattern ≤5ms · transport ≤30ms · render ≤20ms` → end-to-end ≤80ms. Nút cổ chai là transport/bus, không phải FFT — nên kiến trúc gửi param cấp cao + render cục bộ.

---

## 4. OTA & mô hình đưa ra thị trường

NhipSang đóng gói được như **feature phần mềm OTA** trên MHU: cập nhật preset/pattern qua OTA mà không đụng phần cứng; bật/bán như **add-on** (gói cá nhân hóa). Đây là cách VinFast giữ trải nghiệm (và doanh thu phụ kiện) in-house thay vì để chảy ra aftermarket. Versioning preset + rollback an toàn (preset mới phải qua Critical gate trước khi ship — chính bộ eval-as-code này là cổng release).

---

## 5. Cộng sinh với hệ đèn factory

Music mode **không thay thế** hệ đèn factory mà **cộng sinh**: nó là một nguồn ưu tiên thấp trong Arbiter. Khi có cảnh báo an toàn hay phản hồi HVAC, music nhường ngay. Theme tĩnh là baseline nền (khi không nhạc). Trật tự sống thực tế: `safety → (hvac overlay tạm) → music → theme → [fault]→failsafe`. Việc này đảm bảo tính năng giải trí không bao giờ lấn chức năng phản hồi/cảnh báo sẵn có của xe.

---

## 6. Homologation & ràng buộc pháp lý

Ánh sáng động trong cabin bị soi ở ba góc — Policy Gate tồn tại để xử cả ba:

1. **UNECE R48** (lắp đặt thiết bị chiếu sáng): ánh sáng đỏ không được thấy từ phía trước, không đèn nhấp nháy trừ chỉ báo hợp lệ → INV-1 (cấm đỏ/xanh vùng tài xế), giới hạn ánh sáng hắt ra ngoài.
2. **Driver distraction** (NHTSA guidelines / EU GSR): độ sáng/nhấp nháy gây mất tập trung khi lái → INV-2 (không nháy beat khi lái), INV-3 (cap độ sáng).
3. **Photosensitive epilepsy**: ngưỡng an toàn ~3 nháy/giây → INV-2 hard-cap flash-rate, và đây là một bất biến assert bằng eval-as-code (test fail nếu bất kỳ preset nào vượt ngưỡng).

Thị trường: VN làm chính, có chú thích EU (R48/GSR) + US (NHTSA) để Policy Gate trích đúng khung. *Lưu ý nói khi phỏng vấn: dẫn "nhóm R48 + hướng dẫn driver-distraction" thay vì đọc vẹt số điều khoản chính xác.*

*Hardening (D-004):* `isRestrictedHue` hiện dùng heuristic RGB (backstop, preset không phụ thuộc). Hướng chặt hơn: định nghĩa HSV-based (hue ∈ dải đỏ/xanh ∧ saturation/value cao) — một chỗ sửa trong `policyGate` nếu cần định nghĩa "legal-hue" chính xác.

---

## Phụ lục A — Q&A phòng thủ (chuẩn bị phỏng vấn)

**Q: Spotify mã hóa DRM, lấy raw PCM ở HAL kiểu gì mà không vi phạm?**
Không giải mã/không chạm nội dung — chỉ lấy spectral envelope (3-band + onset) sau mixer để drive đèn, không lưu/không tái tạo audio = phân tích đặc trưng. Nếu DRM chặn tap sau mixer → fallback tap ở DSP của amplifier (vùng tin cậy nội bộ).

**Q: Dùng bus gì xuống đèn? CAN hay LIN? Bao nhiêu msg/s?**
Lai theo chặng: MHU→gateway SOME-IP/Ethernet (~25Hz); gateway→BCM CAN-FD (payload nhỏ, priority thấp hơn frame an toàn); BCM→LED PWM cục bộ. Không SOME-IP thẳng tới LED — node lá là MCU nhỏ, không Ethernet. Gửi param cấp cao, ECU render cục bộ → không nghẽn bus.

**Q: Xử lý động kinh nhạy sáng thế nào?**
Policy Gate hard-cap flash-rate dưới ngưỡng an toàn (~3Hz), và đó là một bất biến assert bằng eval-as-code — CI fail nếu preset vượt ngưỡng.

**Q: Đèn nháy có làm xao nhãng / phạm luật không?**
Có rủi ro thật → đó là lý do Policy Gate tồn tại: khi lái thì cap brightness, tắt nháy beta, cấm đỏ/xanh; full effect chỉ khi P. Cộng sinh (không lấn) với cảnh báo an toàn.

---

## Phụ lục B — Decisions Log

| ID | Quyết định |
|----|-----------|
| D-001 | Git/repo: cân nhắc `nhipsang/` làm repo root cho front-door sạch (D-009) |
| D-002 | Band level: named (audio) ↔ packed tuple (wire); convert ở Arbiter/transport |
| D-003 | Band level là **perceptual/relative** (cross-band floor); absolute để dành cho ML path |
| D-004 | `isRestrictedHue` heuristic RGB cho v1; HSV-based là hướng hardening |
| D-005 | HVAC = transient overlay (~2.5s sau đổi nhiệt), không thường trực |
| D-006 | Theme = baseline thường trực; idle → theme wash |
| D-007 | Failsafe chỉ trigger khi FAULT thật (không phải idle) |
| D-008 | Chỉ transport `'error'` mới fault; `'disconnected'` (chưa cấu hình) thì lành |
| D-009 | Khuyến nghị `nhipsang/` làm repo root trước khi publish (front-door REQ-034) |

---

## Phụ lục C — Phạm vi bản demo

**MUST (đã build, chạy trên laptop):** simulator (cabin VF8 6 zone + vehicle-state panel + Trace panel), audio DSP tự code, core 6 bất biến, transport Supabase Broadcast, scenario runner, eval-as-code tiered CI + gate-bites demo.
**SHOULD:** demo vật lý ESP32 + WS2812B (chỉ khi có phần cứng).
**WON'T (v1):** tích hợp SA8295/AAOS thật, OTA thật, ML mood/genre classifier (chỉ nằm trong tài liệu này).

*Mọi phần "trên xe thật" trong tài liệu là thiết kế; bản demo mô phỏng trung thực ranh giới đó (HAL interface swappable, schema thật, latency ghi rõ phần đo / phần target).*
