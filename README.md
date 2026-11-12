# Kinosync Studio

Biến truyện chữ thành **phim đọc truyện dài 60–90 phút**: giọng đọc AI, phụ đề khớp
từng câu, hình ảnh minh họa và xuất MP4 ngay trên trình duyệt.

Kinosync lấy dữ liệu từ API đọc truyện mở của [truyenok.online](https://truyenok.online/api/v1/openapi.json),
cho phép bạn chọn và **ghép nhiều chương** lại thành một video hoàn chỉnh — kèm nhạc
nền điện ảnh nhẹ, thẻ tiêu đề từng chương, hiệu ứng chuyển cảnh và phụ đề karaoke.

---

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc](#kiến-trúc)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Chạy ở máy](#chạy-ở-máy)
- [Biến môi trường](#biến-môi-trường)
- [Triển khai GitHub + Vercel](#triển-khai-github--vercel)
- [Pipeline tạo video hoạt động thế nào](#pipeline-tạo-video-hoạt-động-thế-nào)
- [Xuất video dài 60–90 phút](#xuất-video-dài-6090-phút)
- [API nội bộ](#api-nội-bộ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Scripts](#scripts)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Bản quyền nội dung](#bản-quyền-nội-dung)

---

## Tính năng

### Chế độ “Truyện → Video” (mặc định)

- **Thư viện truyện** tải trực tiếp từ truyenok.online: tìm kiếm theo tên/tác giả,
  lọc trạng thái, xem số chương và thời lượng đọc ước tính.
- **Ghép chương**: chọn khoảng chương, preset 10/14/18 chương, hoặc tick từng
  chương. Ước lượng thời lượng theo thời gian thực và cảnh báo khi phim quá ngắn
  (< 45 phút) hoặc quá dài (> 110 phút).
- **Giọng đọc AI**: 8 giọng Gemini (Kore, Charon, Puck, Fenrir, Aoede, Leda, Orus,
  Zephyr) phù hợp từng thể loại.
- **Phụ đề chính xác**: mỗi đoạn văn bản được tổng hợp giọng đọc riêng, thời gian
  phụ đề lấy từ **độ dài thật của file âm thanh** thay vì ước lượng.
- **Hình ảnh minh họa**: bìa truyện + 5 cảnh điện ảnh có sẵn, được chọn theo từ
  khóa của từng đoạn; hoặc tải lên bộ ảnh riêng và Kinosync sẽ luân phiên.
- **Thẻ tiêu đề chương**, hiệu ứng Ken Burns, 6 kiểu chuyển cảnh, vignette, hạt
  phim, thanh viền điện ảnh, tô sáng từng từ (karaoke).
- **Xem trước có tua**: player canvas + điều khiển âm thanh, tua 10 giây, nhảy
  nhanh tới từng chương.
- **Xuất MP4 H.264 + AAC** bằng WebCodecs, ghi trực tiếp xuống đĩa theo từng khối
  16 MB nên không bị giới hạn RAM.
- **Tải phụ đề `.srt`** riêng để dùng cho YouTube hoặc phần mềm dựng phim khác.

### Chế độ “Dựng thủ công”

Dành cho khi bạn đã có MP3 và bộ ảnh riêng: nhập nhạc, dán SRT hoặc văn bản, tự
khớp cảnh, chỉnh màu, chuyển cảnh và xuất MP4 (giữ nguyên từ bản gốc).

---

## Kiến trúc

```
┌────────────────────────── Trình duyệt ──────────────────────────┐
│  React 19 / Next.js 15 App Router                               │
│                                                                 │
│  /api/novels...  ──►  truyenok.online (proxy + cache)           │
│  /api/narration  ──►  Gemini TTS (khoá chỉ nằm ở server)        │
│                                                                 │
│  chunk → TTS → decode PCM → layout timeline                     │
│                       │                                         │
│                       ├─► Canvas 2D  (hình + phụ đề + thẻ chương)│
│                       └─► WebCodecs  H.264 + AAC → mp4-muxer    │
│                                        └─► File System Access   │
└─────────────────────────────────────────────────────────────────┘
```

**Vì sao render ở trình duyệt?** Vercel là serverless: function tối đa 60 giây,
không có ffmpeg, không có đĩa bền và không giữ được tiến trình 90 phút. Vì vậy
server chỉ làm hai việc (proxy dữ liệu truyện và giữ khoá API cho giọng đọc), còn
việc dựng hình – mã hoá – đóng gói do máy người dùng đảm nhiệm. Cách này cũng
khiến chi phí server gần như bằng 0 và video không phải upload lên đâu cả.

---

## Yêu cầu hệ thống

| Thành phần | Yêu cầu |
| --- | --- |
| Node.js | ≥ 20.11 (khuyến nghị 20 LTS trở lên) |
| npm | ≥ 10 |
| Phiên bản Node | Khai báo sẵn trong `.nvmrc` và `engines` (`20`) |
| Trình duyệt | Chrome / Edge 111+ để xuất MP4 dài (WebCodecs + File System Access) |
| Khoá API | `GEMINI_API_KEY` từ [Google AI Studio](https://aistudio.google.com/apikey) |

> Firefox và Safari xem trước được, nhưng chưa hỗ trợ ghi trực tiếp ra đĩa nên
> video dài sẽ bị chặn (xem [Xuất video dài](#xuất-video-dài-6090-phút)).

---

## Chạy ở máy

```bash
git clone https://github.com/thantaigocua1515-cmd/Kinosync.git
cd Kinosync
npm install

cp .env.example .env.local
# mở .env.local và điền GEMINI_API_KEY

npm run dev
```

Mở <http://localhost:3000>.

Kiểm tra nhanh trước khi deploy:

```bash
npm run typecheck   # TypeScript
npm test            # 15 unit test cho pipeline
npm run build       # build production
```

---

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | Khoá Google AI Studio cho giọng đọc (TTS) và nhận dạng lời nói. Chỉ dùng ở server. |
| `GEMINI_TTS_MODEL` | — | Model giọng đọc. Mặc định `gemini-2.5-flash-preview-tts`. |
| `GEMINI_TRANSCRIBE_MODEL` | — | Model nhận dạng lời nói cho trình dựng thủ công. Mặc định `gemini-2.5-flash`. |
| `TRUYENOK_API_BASE` | — | Đổi máy chủ nguồn truyện. Mặc định `https://truyenok.online`. |
| `NEXT_PUBLIC_TTS_CONCURRENCY` | — | Số đoạn giọng đọc xử lý song song (1–6, mặc định 3). |

Không bao giờ đặt khoá vào biến có tiền tố `NEXT_PUBLIC_` — giá trị đó sẽ bị gửi
xuống trình duyệt.

---

## Triển khai GitHub + Vercel

### 1. Đưa mã nguồn lên GitHub

```bash
git add .
git commit -m "feat: story-to-video studio"
git push origin main
```

### 2. Import vào Vercel

1. Vào [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
2. Chọn `thantaigocua1515-cmd/Kinosync` (cấp quyền GitHub nếu được hỏi).
3. Giữ nguyên cấu hình mặc định:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `next build` (đã khai báo trong `vercel.json`)
   - **Install Command**: `npm install`
   - **Node.js Version**: 20.x
4. Mở **Environment Variables**, thêm:
   - `GEMINI_API_KEY` = khoá của bạn
   - tick cả **Production**, **Preview**, **Development**
5. Bấm **Deploy**. Lần build đầu mất khoảng 1–2 phút.

`vercel.json` đã cấu hình sẵn `maxDuration: 60` cho toàn bộ route `app/api/**`, đủ
cho một đoạn giọng đọc ~420 ký tự. Nếu dùng gói Pro/Business và muốn tăng, sửa
`functions.app/api/**/*.ts.maxDuration` trong `vercel.json`.

### 3. Vòng đời deploy

| Hành động | Kết quả |
| --- | --- |
| Push/merge vào `main` | Deploy Production |
| Mở Pull Request | Deploy Preview (URL riêng, có cùng biến môi trường Preview) |
| Push commit khác | Preview cập nhật tại chỗ |

Không cần khai báo bí mật Vercel trong GitHub: Vercel tự lắng nghe repository.
`.github/workflows/ci.yml` chỉ chạy kiểm tra chất lượng (typecheck → test → build)
trên mỗi push/PR để chặn lỗi trước khi merge.

### 4. Deploy bằng CLI (tuỳ chọn)

```bash
npm i -g vercel
vercel link                     # nối thư mục với project trên Vercel
vercel env add GEMINI_API_KEY   # dán khoá, chọn cả 3 môi trường
vercel --prod
```

### 5. Gắn tên miền

Vercel → Project → **Settings → Domains** → thêm domain và trỏ DNS theo hướng dẫn.
Không cần cấu hình gì thêm trong code.

---

## Pipeline tạo video hoạt động thế nào

Toàn bộ logic thuần nằm ở `lib/story-pipeline.ts` (có unit test), phần chạy ở
trình duyệt nằm trong `components/story/story-studio.tsx`.

1. **Tải chương** — 4 request song song tới `/api/novels/{id}/chapters/{n}`,
   dữ liệu được cache ở tầng Vercel (`s-maxage=3600`).
2. **Chia đoạn đọc** — `chunkChapterText()` tách theo đoạn → câu → mảnh, gộp thành
   khối ≤ 420 ký tự, **không cắt giữa câu**. Một chương ~900 từ thường thành 9–12
   khối, tương đương 5–6 phút đọc.
3. **Tổng hợp giọng đọc** — gọi `/api/narration` song song (mặc định 3 luồng), tự
   thử lại 3 lần khi gặp 429/5xx. Server trả PCM `audio/L16;rate=24000`, trình
   duyệt bọc header WAV rồi giải mã bằng Web Audio.
4. **Đo thời lượng thật** — mỗi AudioBuffer cho biết chính xác đoạn đó dài bao
   nhiêu giây. `layoutNarration()` xếp các đoạn nối tiếp nhau, thêm 1,2 giây mở
   đầu và 0,9 giây nghỉ giữa các chương.
5. **Dựng phụ đề** — `buildSubtitlesForChunk()` chia thời lượng của khối theo độ
   dài từng câu, luôn nối liền mạch (không có khoảng trống giữa hai dòng).
6. **Chọn hình ảnh** — mỗi ~22 giây tạo một phân cảnh; `buildImagePool()` gộp bìa
   truyện + kho ảnh; `buildStoryScenes()` chấm điểm từ khóa để chọn ảnh hợp ngữ
   cảnh, tránh lặp liền kề và luân phiên hướng zoom.
7. **Xem trước** — player canvas vẽ khung hình theo thời gian thật, âm thanh được
   lên lịch theo từng cửa sổ 40 giây nên không giữ 90 phút trong bộ nhớ.
8. **Xuất MP4** — mã hoá AAC cho giọng đọc trước, sau đó mã hoá H.264 từng khung
   hình và đóng gói bằng `mp4-muxer` (xem phần dưới).

---

## Xuất video dài 60–90 phút

| Thông số | Giá trị |
| --- | --- |
| 90 phút @ 24 fps | 129.600 khung hình |
| Bitrate gợi ý | 4 Mbps (ảnh tĩnh) → ~2,7 GB cho 90 phút |
| Âm thanh | AAC 96 kbps, mono, giữ sample rate gốc của giọng đọc |
| Đóng gói | fMP4 (`fastStart: 'fragmented'`) khi ghi ra đĩa |
| Thời gian xuất thực tế | ~10–40 phút tuỳ CPU/GPU |

Cách hoạt động:

- Khi bấm **Xuất MP4**, trình duyệt mở hộp thoại chọn nơi lưu (File System Access
  API). Dữ liệu được ghi theo khối 16 MB xuống tệp đã chọn, nên bộ nhớ chỉ cần vài
  chục MB dù phim dài 90 phút.
- Nếu trình duyệt không hỗ trợ ghi ra đĩa, Kinosync dựng vào RAM và **chặn video
  dài hơn 20 phút** để tránh treo tab. Hãy dùng Chrome/Edge.
- Giữ tab mở và không để máy ngủ trong lúc xuất. Có thể bấm **Huỷ** bất cứ lúc nào;
  tệp dở sẽ bị bỏ.
- Nếu máy không mã hoá được AAC, video vẫn xuất nhưng **không có tiếng** — ứng
  dụng sẽ cảnh báo rõ và bạn vẫn tải được `.srt`.

---

## API nội bộ

| Route | Method | Mô tả |
| --- | --- | --- |
| `/api/novels` | GET | Danh sách truyện (cache 5 phút). |
| `/api/novels/{id}` | GET | Chi tiết truyện + mục lục chương. |
| `/api/novels/{id}/chapters/{n}?format=translated` | GET | Nội dung một chương (cache 1 giờ). |
| `/api/narration` | POST | Tổng hợp giọng đọc một đoạn ≤ 900 ký tự. Body: `{ text, voice }`. |
| `/api/tts` | POST | Tương thích ngược cho trình dựng thủ công. |
| `/api/transcribe` | POST | Tạo SRT từ file âm thanh (trình dựng thủ công). |
| `/api/image?url=` | GET | Proxy ảnh bìa same-origin (né hotlink, cho phép canvas vẽ). |

Tất cả route đều chạy `runtime = 'nodejs'`, `maxDuration = 60` và trả lỗi dạng
`{ error: string }` với mã HTTP phù hợp.

---

## Cấu trúc thư mục

```
app/
  layout.tsx                  # font, metadata, theme
  page.tsx                    # -> StudioApp
  globals.css                 # design tokens + base styles
  api/
    novels/...                # proxy truyenok (list, detail, chapter)
    narration/route.ts        # Gemini TTS cho pipeline truyện
    tts/route.ts              # TTS cho trình dựng thủ công
    transcribe/route.ts       # ASR -> SRT
components/
  studio-app.tsx              # chuyển giữa hai chế độ
  app-shell.tsx               # header, nav, footer
  ui/primitives.tsx           # Button, Panel, Badge, Toggle, Progress…
  story/
    story-studio.tsx          # orchestration + pipeline
    novel-library.tsx         # bước 1
    chapter-picker.tsx        # bước 2
    narration-config.tsx      # bước 3
    story-player.tsx          # player canvas + audio
    render-stage.tsx          # tiến trình + xuất MP4
  KinoSyncStudio.tsx          # trình dựng thủ công (giữ nguyên tính năng)
  ExportModal.tsx
  StudioTimeline.tsx
lib/
  truyenok.ts                 # client API truyện (server)
  story-pipeline.ts           # chia đoạn, timeline, phụ đề, phân cảnh
  story-pipeline.test.ts
  narration-timeline.ts       # PCM clips + mã hoá AAC
  longform-renderer.ts        # H.264/AAC -> MP4 (WebCodecs + mp4-muxer)
  canvas-renderer.ts          # vẽ khung hình, chuyển cảnh, thẻ chương
  video-engine.ts             # kiểu dữ liệu, SRT, khớp ảnh (trình dựng tay)
  audio-utils.ts              # PCM/WAV decode
  gemini-tts.ts               # gọi Gemini TTS (server)
  story-config.ts             # giọng đọc, preset phụ đề, cấu hình
```

---

## Scripts

```bash
npm run dev        # http://localhost:3000
npm run build      # build production
npm start          # chạy bản build
npm run typecheck  # tsc --noEmit
npm test           # node --test (15 test)
npm run lint       # eslint
```

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách khắc phục |
| --- | --- |
| `503 Máy chủ chưa có GEMINI_API_KEY` | Chưa khai báo biến trên Vercel, hoặc chưa Redeploy sau khi thêm. |
| `502 Model giọng đọc … không khả dụng` | Khoá API không có model TTS đó. Đặt `GEMINI_TTS_MODEL` sang model bạn có. |
| `429 Đã vượt hạn mức` | Chạm giới hạn quota của Google AI. Chờ vài phút hoặc giảm số chương, giảm `NEXT_PUBLIC_TTS_CONCURRENCY`. |
| Giọng đọc tạo rất chậm | Mỗi đoạn là một request; 14 chương ≈ 130–160 request. Bật 4–6 luồng nếu khoá đủ hạn mức. |
| `Trình duyệt này không hỗ trợ WebCodecs` | Dùng Chrome/Edge ≥ 111 (hoặc bản Chromium mới). |
| `Bạn đã huỷ chọn nơi lưu tệp` | Hộp thoại lưu tệp bị đóng. Bấm “Thử xuất lại” và chọn thư mục. |
| MP4 không có tiếng | Máy không hỗ trợ `AudioEncoder` AAC; dùng Chrome bản mới hoặc xuất `.srt` để lồng tiếng ở phần mềm khác. |
| `Không kết nối được máy chủ truyện` | truyenok.online không phản hồi trong 20 giây hoặc đổi domain. Thử lại, hoặc đặt `TRUYENOK_API_BASE`. |
| Ảnh bìa trắng / vỡ | Host ảnh chặn hotlink. Tải ảnh riêng lên ở bước 3. |

---

## Bản quyền nội dung

Nội dung truyện thuộc bản quyền của tác giả và đơn vị phát hành. Kinosync chỉ đọc
qua API công khai của truyenok.online; bạn tự chịu trách nhiệm về quyền sử dụng khi
đăng tải video. Hãy ghi rõ nguồn truyện trong phần mô tả video.

Mã nguồn dự án thuộc repository này. Nếu muốn công bố theo giấy phép cụ thể, hãy
thêm tệp `LICENSE` phù hợp.
