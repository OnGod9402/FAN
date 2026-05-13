# Fayda ID Reconstruction Bot — Handover Document

## Purpose

A Telegram bot that reconstructs a printable Ethiopian Fayda Digital ID card (front side) from a screenshot of the Fayda mobile app.

The user sends one screenshot of the Fayda app card screen. The bot extracts all visible data using OCR, extracts the person's face from the screenshot, composites everything onto a card template, and returns a PNG of the reconstructed front card.

---

## What Works Properly

### Bot Infrastructure (NestJS + Telegraf)
- NestJS application with modular architecture
- Telegraf bot using `Scenes.WizardScene` for conversation flow
- Long-polling (no webhook needed)
- Global exception filter — catches all unhandled errors, logs stack trace, notifies user
- Session management — in-memory per-user session with configurable TTL (default 30 min)
- `/start` — enters the wizard scene
- `/cancel` — clears session and exits
- `/help` — shows command list
- Bilingual UI — English and Amharic, user selects at start via inline keyboard buttons
- Docker setup — `Dockerfile` (Node 20 Alpine + canvas system deps) and `docker-compose.yml`
- Startup validation — exits with error if `TELEGRAM_BOT_TOKEN` or required assets are missing

### Conversation Flow (4 steps)
1. Language selection (inline keyboard: English / አማርኛ)
2. User sends Fayda app screenshot
3. OCR runs → all extracted fields shown at once → user taps "✅ Generate Card" or "🔄 Resend"
4. Front card PNG generated and sent back

### Field Validators (`src/validators/validators.ts`)
Pure functions, fully tested:
- `validateFan` — exactly 16 digits
- `validatePhone` — Ethiopian format 07/09XXXXXXXX
- `validateFin` — `FIN XXXXXXXX XXXX` pattern
- `validateSn` — `SN: XXXXXXX` pattern
- `validateEthiopianDate` — DD/MM/YYYY or YYYY/MM/DD
- `validateGregorianDate` — YYYY/Mon/DD

### OCR Service (`src/ocr/ocr.service.ts`)
- Uses `tesseract.js` with `amh+eng` language pack
- Preprocesses image with `sharp` (upscale to 2400px, sharpen, normalise) before OCR
- Parses raw OCR text using label-anchored extraction (finds "Full Name", "Date of Birth", etc. labels then reads values below them)
- Extracts: nameAmharic, nameEnglish, dobEthiopian, dobGregorian, sexAmharic, sexEnglish, expiryEthiopian, expiryGregorian, issueEthiopian, issueGregorian, FAN
- Cleans OCR noise (trailing `=`, `|`, `-` characters)
- Debug logging: logs raw OCR output at DEBUG level

### Photo Processor (`src/photo-processor/photo-processor.service.ts`)
- Coordinate-based face extraction from Fayda Digital Copy screenshot
- Crops card region from phone screenshot (removes status bar, nav bar, app chrome)
- Crops face area from within the card using known fixed proportions
- Resizes to 285×345px and converts to grayscale
- Falls back to `sharp` attention crop if coordinate extraction fails
- No TensorFlow, no native addons — works on Windows/Linux/Mac

### Card Generator (`src/card-generator/card-generator.service.ts`)
- Loads `assets/bg_front.png` as the base template layer
- Composites portrait photo at `x=28, y=155, w=285, h=345`
- Paints all text fields at calibrated coordinates on top of the template
- Generates Code 128 barcode for FAN using `bwip-js`
- White rounded box behind FCN/barcode area
- Date of Issue rendered rotated 90° on right edge
- Returns PNG buffer

---

## What Does NOT Work / Needs Fixing

### Face Extraction
The coordinate-based cropping ratios are estimates. They need to be calibrated against actual screenshots at different phone resolutions. The current ratios work for ~1080px wide screenshots but may be off for other devices.

**Fix needed:** Test with real screenshots, measure exact pixel coordinates of the face area, update `CARD_REGION` and `FACE_IN_CARD` ratios in `photo-processor.service.ts`.

### Amharic Text Rendering
`@napi-rs/canvas` renders Amharic as boxes unless a proper Ethiopic font is registered. The font files are not bundled.

**Fix needed:** Download `NotoSansEthiopic-Regular.ttf` and `NotoSansEthiopic-Bold.ttf`, place in `assets/fonts/`, and they will be auto-loaded at startup. Download from: https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic

### OCR Accuracy
Tesseract OCR on phone screenshots is ~60-70% accurate for mixed Amharic/English. Some fields (especially the rotated issue date) are frequently missed.

**Better approach:** Use Google Vision API or AWS Textract for production — much higher accuracy on Ethiopic script. For MVP, the current Tesseract approach works for clearly visible fields.

### Card Coordinate Calibration
The text field coordinates in `FRONT_COORDS` (card-generator.service.ts) are calibrated to a specific template image. If the template image dimensions differ, all text will be misaligned.

**Fix needed:** Open `assets/bg_front.png` in an image editor, measure exact pixel positions of each field, update `FRONT_COORDS`.

---

## Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22 |
| Framework | NestJS 10 |
| Telegram | Telegraf 4 |
| OCR | tesseract.js (amh+eng) |
| Image processing | sharp |
| Card rendering | @napi-rs/canvas |
| Barcode | bwip-js |
| QR code | qrcode |
| Deployment | Docker (node:20-alpine) |

---

## Project Structure

```
fayda-id-reconstruction-bot/
├── src/
│   ├── main.ts                          # Bootstrap + startup validation
│   ├── app.module.ts                    # Root module
│   ├── session/                         # In-memory session store + types
│   ├── validators/                      # Field validators (FAN, FIN, dates, etc.)
│   ├── ocr/                             # Tesseract OCR service
│   ├── photo-processor/                 # Face extraction from screenshot
│   ├── card-generator/                  # Card compositing (front + back)
│   ├── telegram/                        # Bot + conversation scene
│   └── filters/                         # Global exception filter
├── assets/
│   ├── bg_front.png                     # Card front template (YOU PROVIDE)
│   ├── bg_back.png                      # Card back template (YOU PROVIDE)
│   └── fonts/                           # Optional: NotoSansEthiopic + Roboto TTFs
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

```
TELEGRAM_BOT_TOKEN=   # Required — from @BotFather
NODE_ENV=             # development | production
SESSION_TTL_MINUTES=  # Default: 30
LOG_LEVEL=            # info | debug | error
```

---

## Assets Required Before Running

| File | Source |
|------|--------|
| `assets/bg_front.png` | Your cleaned Fayda card template (front) |
| `assets/bg_back.png` | Your cleaned Fayda card template (back) |
| `assets/fonts/NotoSansEthiopic-Regular.ttf` | Google Fonts |
| `assets/fonts/NotoSansEthiopic-Bold.ttf` | Google Fonts |
| `assets/fonts/Roboto-Regular.ttf` | Google Fonts |
| `assets/fonts/Roboto-Bold.ttf` | Google Fonts |

---

## Run Locally

```bash
cp .env.example .env
# Add your TELEGRAM_BOT_TOKEN to .env
# Place assets in assets/

npm install
npm run start:dev
```

## Run with Docker

```bash
docker compose up --build
```
