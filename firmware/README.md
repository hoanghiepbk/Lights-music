# NhipSang firmware (ESP32)

ESP32 + WS2812B renderer cho demo vật lý 6 zone, nhận param cấp cao từ bridge node
(Supabase Broadcast → serial). Render PWM cục bộ — **không** nhận chuỗi màu per-LED.

> **Quan trọng:** thư mục này **KHÔNG** thuộc pnpm workspace. Đây là project
> PlatformIO (C++), build bằng PlatformIO chứ không phải `pnpm`. Nó cố tình bị
> loại khỏi `pnpm-workspace.yaml`.

## Build (sau TIP-008)

```bash
pio run                 # build
pio run -t upload       # nạp vào ESP32
```

Hiện tại `src/main.cpp` chỉ là stub — renderer thật + bridge node sẽ làm ở TIP-008.
