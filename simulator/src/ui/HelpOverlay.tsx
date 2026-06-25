import type * as React from 'react';
import { useEffect } from 'react';

// In-app guide overlay (onboarding): explains each UI area, the demo scenario
// timeline, and a quick test recipe. Pure presentational — toggled from App.
export function HelpOverlay({ onClose }: { onClose: () => void }): React.JSX.Element {
  // Esc closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[88vh] w-full max-w-3xl flex-col gap-5 overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Hướng dẫn · how to use</span>
            <h2 className="text-lg font-semibold tracking-tight">NhipSang — bảng điều khiển demo</h2>
          </div>
          <button
            onClick={onClose}
            title="Đóng hướng dẫn (Esc)"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Đóng ✕
          </button>
        </div>

        <Section title="Cabin (khung lớn bên trái)">
          Sơ đồ VF8 nhìn từ trên, <b>6 zone đèn</b> (taplo, 2 cửa trước, 2 cửa sau, bệ giữa). Màu + độ sáng mỗi
          zone là kết quả cuối sau Policy Gate. Khi phát nhạc, mỗi zone đổi <b>màu theo dải tần</b> (cửa trước ngả
          bass/ấm · taplo ngả mid/lục-teal · cửa sau ngả high/lạnh) và <b>nhấp theo beat</b> khi đỗ.
        </Section>

        <Section title="Track (góc dưới trái) — nguồn nhạc">
          <b>Choose file</b> chọn file nhạc trong máy, hoặc dán <b>URL audio</b> rồi bấm <b>Load</b>. Bấm{' '}
          <b>Play</b> để phân tích nhạc thật (FFT + onset) và lái đèn; <b>Stop</b> để dừng. Mẹo: chọn bài có
          <b> bass-drop rõ</b> để cảnh sync đẹp.
        </Section>

        <Section title="Mood preset — 3 gu màu">
          <b>calm</b>: lạnh, ít bão hòa, nhịp chậm. <b>energetic</b>: bão hòa cao (cam–lục–tím), beat nhanh.{' '}
          <b>warm</b>: tông vàng–cam ấm. Đổi preset khi đang phát để thấy khác biệt ngay.
        </Section>

        <Section title="Vehicle state — giả lập tín hiệu xe">
          <b>Gear</b> (P/R/N/D), <b>Speed</b> (0–120 km/h), <b>Cabin temp</b> (16–30°C, kích hoạt overlay HVAC ~2.5s
          khi đổi), <b>Seatbelt</b> / <b>ADAS</b> (bật cảnh báo an toàn). Đây là các tín hiệu mà đèn music phải
          nhường/né — điểm khác biệt cốt lõi so với kit aftermarket.
        </Section>

        <Section title="Trace · observability — bằng chứng logic an toàn">
          <b>Pipeline compute</b>: thời gian xử lý thật một frame (FFT/onset/AGC + pattern + arbiter + policy);{' '}
          <b>resolve (safety core)</b>: phần lõi an toàn — gần như free. <b>Arbiter winner</b>: nguồn nào đang
          thắng (music/theme/hvac/<b>safety</b>/failsafe) + priority. <b>Transport</b>: trạng thái kênh Supabase.{' '}
          <b>Policy gate</b> (các pip sáng lên): driving · brightness cap · flash gated · safety exempt · INV-1
          recolour · fault → failsafe.
        </Section>

        <Section title="Chạy kịch bản — demo tự động ~30 giây (hands-free)">
          Bấm một lần, không cần chạm gì thêm; banner caption hiện từng mốc. Timeline:
          <ul className="mt-2 flex flex-col gap-1.5 pl-1">
            <Step t="0s">Đỗ (P) — full effect, đèn sync nhạc mạnh nhất.</Step>
            <Step t="10s">Chuyển P→D — hiệu ứng tự dịu, tắt nháy beat ở vùng tài xế (INV-2).</Step>
            <Step t="11–13s">Tăng tốc 20→40→60 km/h — vùng tài xế bị cap độ sáng ≤35% (INV-3).</Step>
            <Step t="20s">Cảnh báo dây an toàn — music nhường, winner=SAFETY, telltale bật (được miễn cấm màu).</Step>
            <Step t="25s">Trở lại đỗ (P) — full effect quay lại.</Step>
            <Step t="30s">Hết kịch bản, tự dừng.</Step>
          </ul>
          <p className="mt-2 text-[var(--muted)]">
            Lưu ý: kịch bản chỉ di chuyển trạng thái xe — hãy <b>bấm Play nhạc trước</b> rồi chạy kịch bản để thấy
            đèn vừa sync nhạc vừa phản ứng tín hiệu xe.
          </p>
        </Section>

        <Section title="Cách test nhanh (3 phút)">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Đỗ (P) → Play nhạc → xem 6 zone <b>nhiều màu</b> đổi theo nhạc; Trace winner=MUSIC, compute ≠ 0.</li>
            <li>Đổi <b>preset</b> calm/energetic/warm → thấy đổi gu màu + tốc độ nháy ngay.</li>
            <li>Gear <b>D</b> + Speed <b>&gt; 5</b> → vùng tài xế dịu lại, hết nháy (pip driving/cap/flash sáng).</li>
            <li>Bật <b>Seatbelt</b> → winner=SAFETY, telltale; tắt đi để trả về ambient.</li>
            <li>Nhập <b>URL audio hỏng</b> rồi Play → fault → cabin failsafe dim, pip “fault → failsafe”.</li>
            <li>Stop nhạc → cabin về <b>theme wash</b> dịu (không phải failsafe).</li>
            <li>Hoặc bấm <b>Chạy kịch bản</b> để chạy toàn bộ tự động.</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0">
      <span className="eyebrow">{title}</span>
      <p className="text-[13px] leading-relaxed text-[var(--text)]">{children}</p>
    </div>
  );
}

function Step({ t, children }: { t: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <li className="flex gap-3 text-[13px] leading-relaxed text-[var(--text)]">
      <span className="telemetry shrink-0 text-[var(--teal)]">{t}</span>
      <span>{children}</span>
    </li>
  );
}
