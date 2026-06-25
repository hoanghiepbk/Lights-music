# NhipSang

Music-reactive ambient lighting — simulator native trên MHU VinFast (working codename: **NhipSang**).

> Monorepo scaffold (TIP-001). Logic nghiệp vụ (audio / pattern / arbiter / policy / transport)
> chưa được implement — chỉ là placeholder, sẽ thêm ở các TIP sau.

## Cấu trúc

```
nhipsang/
├── simulator/   # React + Vite + TS + Tailwind — UI + audio + core + transport
│   └── src/{core,audio,transport,ui}/   # skeleton, mỗi thư mục 1 TIP
├── schema/      # @nhipsang/schema — shared types/message schema (pure TS)
├── eval/        # Vitest — invariant suite (INV-1..6) + smoke
├── firmware/    # ESP32 (PlatformIO) — KHÔNG thuộc pnpm workspace
└── docs/        # design doc target
```

## Yêu cầu

- Node ≥ 20
- pnpm ≥ 9

## Cách chạy

```bash
pnpm install        # cài toàn bộ workspace
pnpm dev            # chạy simulator (Vite dev server)
pnpm build          # build simulator production
pnpm typecheck      # tsc --noEmit mọi package TS (strict)
pnpm test           # Vitest suite (package eval)
```

`firmware/` build riêng bằng PlatformIO — xem `firmware/README.md`.
