# Implementation Plan: Fayda ID Reconstruction Bot

## Overview

Implement a NestJS + Telegraf Telegram bot that guides users through a multi-step conversation to reconstruct a printable Ethiopian Fayda Digital ID card. The implementation follows the modular architecture defined in the design document: SessionModule → validators → OcrModule → PhotoProcessorModule → CardGeneratorModule → TelegramModule (ConversationScene).

## Tasks

- [x] 1. Project scaffolding
  - Initialise NestJS project with `nest new`, configure `tsconfig.json` for `strict: true`, `esModuleInterop: true`, `emitDecoratorMetadata: true`
  - Add all required dependencies to `package.json`: `@nestjs/core`, `@nestjs/common`, `telegraf`, `nestjs-telegraf`, `tesseract.js`, `@vladmandic/face-api`, `sharp`, `canvas`, `bwip-js`, `qrcode`, `fast-check`, `jest`, `ts-jest`, `@types/*`
  - Configure ESLint + Prettier with NestJS defaults
  - Create `src/main.ts` entry point with NestJS bootstrap and startup validation hook
  - Create `src/app.module.ts` importing all feature modules
  - Create `assets/` directory with `.gitkeep` and document required asset files in README
  - _Requirements: 9.1, 9.2_

- [x] 2. Docker setup
  - Write `Dockerfile` using `node:20-alpine`, install canvas system deps (`cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev python3 make g++`), run `npm ci`, build, expose port 3000
  - Write `docker-compose.yml` with `bot` service, `restart: unless-stopped`, env vars, and `./assets:/app/assets:ro` volume mount
  - Write `.env.example` documenting all environment variables: `TELEGRAM_BOT_TOKEN`, `NODE_ENV`, `SESSION_TTL_MINUTES`, `LOG_LEVEL`, `POLLING_TIMEOUT`
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3. Implement SessionModule
  - Create `src/session/session.module.ts` and `src/session/session.service.ts`
  - Implement `SessionData` interface and `ConversationStep` enum as defined in the design
  - Implement `SessionService` with `get`, `set`, `delete`, `merge` methods backed by an in-memory `Map<number, SessionData>`
  - Implement TTL auto-expiry using `setTimeout`; read TTL from `SESSION_TTL_MINUTES` env var (default 30)
  - Export `SessionService` from `SessionModule`
  - [x] 3.1 Write unit tests for SessionService
    - Test `get`/`set`/`delete`/`merge` with concrete inputs
    - Test TTL expiry fires and removes session
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ]* 3.2 Write property test: session isolation (P13)
    - `// Feature: fayda-id-reconstruction-bot, Property 13: Session isolation across users`
    - Generate two distinct user IDs + session data, write both, assert no cross-contamination
    - **Property 13: Session isolation across users**
    - **Validates: Requirements 8.1**
  - [ ]* 3.3 Write property test: completed session fully cleared (P14)
    - `// Feature: fayda-id-reconstruction-bot, Property 14: Completed session is fully cleared`
    - Generate a session, call `delete`, assert `get` returns `undefined`
    - **Property 14: Completed session is fully cleared**
    - **Validates: Requirements 8.2**
  - [ ]* 3.4 Write property test: active session retains all entered fields (P15)
    - `// Feature: fayda-id-reconstruction-bot, Property 15: Active session retains all entered fields`
    - Generate a sequence of `merge` calls with arbitrary field values, assert all fields readable after each merge
    - **Property 15: Active session retains all entered fields**
    - **Validates: Requirements 8.3**

- [x] 4. Implement field validators
  - Create `src/validators/validators.ts` exporting pure validator functions: `validateFan`, `validatePhone`, `validateFin`, `validateSn`, `validateEthiopianDate`, `validateGregorianDate`
  - Each validator returns `{ valid: boolean; warning?: boolean; message?: string }`
  - Implement regex rules exactly as specified in the design validation table
  - Phone validator returns `warning: true` (not hard rejection) for non-Ethiopian format
  - [x] 4.1 Write unit tests for validators
    - Test each validator with known valid and invalid examples
    - Test phone validator returns warning (not error) for non-matching input
    - _Requirements: 2.2, 2.3, 3.2, 3.3_
  - [ ]* 4.2 Write property test: FAN rejects non-16-digit strings (P3)
    - `// Feature: fayda-id-reconstruction-bot, Property 3: FAN validation rejects non-16-digit strings`
    - Use `fc.string()` to generate arbitrary strings; assert only `/^\d{16}$/` strings pass
    - **Property 3: FAN validation rejects non-16-digit strings**
    - **Validates: Requirements 2.2**
  - [ ]* 4.3 Write property test: date validation rejects unrecognized formats (P4)
    - `// Feature: fayda-id-reconstruction-bot, Property 4: Date validation rejects unrecognized formats`
    - Use `fc.string()` to generate arbitrary strings; assert only pattern-matching strings pass for each date field
    - **Property 4: Date validation rejects unrecognized formats**
    - **Validates: Requirements 2.3**
  - [ ]* 4.4 Write property test: phone validation warns on non-Ethiopian format (P5)
    - `// Feature: fayda-id-reconstruction-bot, Property 5: Phone validation warns on non-Ethiopian format`
    - Use `fc.string()` to generate arbitrary strings; assert non-matching strings return `warning: true`
    - **Property 5: Phone validation warns on non-Ethiopian format**
    - **Validates: Requirements 3.2**
  - [ ]* 4.5 Write property test: FIN rejects malformed values (P6)
    - `// Feature: fayda-id-reconstruction-bot, Property 6: FIN validation rejects malformed values`
    - Use `fc.string()` to generate arbitrary strings; assert only FIN-pattern strings pass
    - **Property 6: FIN validation rejects malformed values**
    - **Validates: Requirements 3.3**

- [x] 5. Checkpoint — ensure all tests pass so far
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement OcrModule
  - Create `src/ocr/ocr.module.ts` and `src/ocr/ocr.service.ts`
  - Implement `OcrService.extractFields(imageBuffer: Buffer): Promise<Partial<SessionData>>`
  - Initialise `tesseract.js` worker with `amh+eng` language pack; reuse worker across calls
  - Apply regex patterns from the design to parse raw OCR text: FAN `/\b\d{16}\b/`, FIN `/FIN\s+[A-Z0-9]{8}\s+[A-Z0-9]{4}/i`, phone `/0[79]\d{8}/`, date patterns
  - On OCR failure, log warning and return empty partial (do not throw)
  - [x] 6.1 Write unit tests for OcrService
    - Test with a fixture image buffer that produces known OCR text (mock tesseract worker)
    - Test graceful empty return when OCR throws
    - _Requirements: 2.1, 3.1_

- [x] 7. Implement PhotoProcessorModule
  - Create `src/photo-processor/photo-processor.module.ts` and `src/photo-processor/photo-processor.service.ts`
  - Load `@vladmandic/face-api` SSD MobileNet V1 models from `assets/face-api-models/` at module init; if load fails, log warning and set `faceApiAvailable = false`
  - Implement `processPortrait(rawBuffer: Buffer): Promise<Buffer>`:
    1. `sharp(buffer).metadata()` to get dimensions
    2. If `faceApiAvailable`, run `faceapi.detectSingleFace(tensor)` to get bounding box
    3. If face found (score >= 0.5), compute padded box (+15% each side, clamped to image bounds)
    4. If no face or score < 0.5, fall back to center-crop to 3:4 aspect ratio
    5. `sharp(buffer).extract(box).resize(180, 220).grayscale().png().toBuffer()`
  - [x] 7.1 Write unit tests for PhotoProcessorService
    - Test with a mock face-api that returns a known bounding box; assert output dimensions are 180×220
    - Test fallback center-crop path when face detection returns null
    - _Requirements: 4.2, 4.4_
  - [ ]* 7.2 Write property test: non-portrait photos corrected to portrait orientation (P8)
    - `// Feature: fayda-id-reconstruction-bot, Property 8: Non-portrait photos are corrected to portrait orientation`
    - Generate landscape/square image buffers via sharp; assert output height > width
    - **Property 8: Non-portrait photos are corrected to portrait orientation**
    - **Validates: Requirements 4.4**
  - [ ]* 7.3 Write property test: photo upload triggers processing and session storage (P7)
    - `// Feature: fayda-id-reconstruction-bot, Property 7: Photo upload triggers processing and session storage`
    - Generate valid image buffers; assert `processPortrait` returns a non-null Buffer
    - **Property 7: Photo upload triggers processing and session storage**
    - **Validates: Requirements 4.2**

- [x] 8. Implement CardGeneratorModule — front card renderer
  - Create `src/card-generator/card-generator.module.ts` and `src/card-generator/card-generator.service.ts`
  - At module init, register fonts via `registerFont()` for NotoSansEthiopic-Regular/Bold and Roboto-Regular/Bold from `assets/fonts/`
  - Load background and logo assets (`bg_front.png`, `bg_back.png`, `eth_flag.png`, `national_id_logo.png`) once at init
  - Implement `generateFront(session: SessionData, portrait: Buffer): Promise<Buffer>`:
    1. `createCanvas(1012, 638)`, draw `bg_front.png`
    2. Draw header: `eth_flag` at (0,15), title text centered, `national_id_logo` at right
    3. Draw "FAYDA DIGITAL COPY" watermark (Roboto-Bold 48px, gray 30% alpha)
    4. Draw portrait image at (30, 120, 180, 220)
    5. Draw all front text fields at coordinates from the design layout
    6. Generate Code 128 barcode via `bwip-js.toBuffer({ bcid: 'code128', text: session.fan })`, draw at (206, 560, 600, 60)
    7. Draw FAN text centered below barcode at y=628
    8. Return `canvas.toBuffer('image/png')`
  - [x] 8.1 Write unit tests for front card generation
    - Test with a known fixture `SessionData` and a 1×1 px portrait buffer; assert output is a valid PNG Buffer
    - Test that missing portrait falls back gracefully (no throw)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [ ]* 8.2 Write property test: generated cards meet minimum resolution (P9)
    - `// Feature: fayda-id-reconstruction-bot, Property 9: Generated cards meet minimum resolution`
    - Generate arbitrary complete `SessionData`; assert front PNG decodes to width >= 1012 and height >= 638
    - **Property 9: Generated cards meet minimum resolution**
    - **Validates: Requirements 5.1, 6.1**
  - [ ]* 8.3 Write property test: front card contains all session text fields (P10)
    - `// Feature: fayda-id-reconstruction-bot, Property 10: Front card contains all session text fields`
    - Generate arbitrary `SessionData`; assert `generateFront` completes without error (structural completeness check)
    - **Property 10: Front card contains all session text fields**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 9. Implement CardGeneratorModule — back card renderer
  - Implement `generateBack(session: SessionData): Promise<Buffer>`:
    1. `createCanvas(1012, 638)`, draw `bg_back.png`
    2. Draw header (same as front)
    3. Draw all back text fields at coordinates from the design layout (phone, FIN, nationality, region, zone, woreda, SN, footer)
    4. Generate QR code via `qrcode.toBuffer(session.fin)`, draw at (780, 100, 200, 200)
    5. Return `canvas.toBuffer('image/png')`
  - Implement `generatePdf(front: Buffer, back: Buffer): Promise<Buffer>` combining both PNGs into a two-page PDF using `canvas` PDF mode
  - [x] 9.1 Write unit tests for back card generation
    - Test with a known fixture `SessionData`; assert output is a valid PNG Buffer
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 9.2 Write property test: back card contains all session text fields (P11)
    - `// Feature: fayda-id-reconstruction-bot, Property 11: Back card contains all session text fields`
    - Generate arbitrary `SessionData`; assert `generateBack` completes without error
    - **Property 11: Back card contains all session text fields**
    - **Validates: Requirements 6.2**
  - [ ]* 9.3 Write property test: QR code encodes FIN round-trip (P12)
    - `// Feature: fayda-id-reconstruction-bot, Property 12: QR code encodes FIN round-trip`
    - Use `fc.stringMatching(/^FIN\s+[A-Z0-9]{8}\s+[A-Z0-9]{4}$/)` to generate valid FIN strings; encode QR, decode with `jsQR`, assert equality
    - **Property 12: QR code encodes FIN round-trip**
    - **Validates: Requirements 6.3**

- [x] 10. Checkpoint — ensure all module unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement TelegramModule and ConversationScene
  - Create `src/telegram/telegram.module.ts` importing `TelegrafModule.forRoot({ token })` and registering the wizard scene
  - Create `src/telegram/telegram.service.ts` wrapping the Telegraf bot instance with `launch()` and `stop()` methods
  - Create `src/telegram/conversation.scene.ts` as a `Scenes.WizardScene` with one step handler per `ConversationStep`:
    - `handleStart`: send welcome message, prompt for optional screenshot, advance to `AWAIT_SCREENSHOT`
    - `handleOcrScreenshot`: if photo received, call `OcrService.extractFields`, merge into session, advance; if text "skip", advance directly
    - `handleFieldInput(fieldKey)`: for each of the 23 text fields — display pre-filled value if present, validate input using the appropriate validator, re-prompt on error, call `SessionService.merge`, advance step
    - `handlePhotoUpload`: download Telegram photo, call `PhotoProcessorService.processPortrait`, store `processedPortrait` in session, advance to `GENERATING`
    - `handleGenerateCards`: call `CardGeneratorService.generateFront` + `generateBack`, send both PNGs via `ctx.replyWithDocument`, optionally send PDF, call `SessionService.delete`, send completion message
  - Register `/cancel` command handler: call `SessionService.delete`, notify user, leave scene
  - Register `/help` command handler: reply with command list and workflow description
  - Register `/start` handler: if active session exists, ask user to confirm restart before clearing
  - Log each step transition at INFO level with user ID and step name (no field values)
  - [x] 11.1 Write unit tests for ConversationScene step transitions
    - Test `/start` sends welcome message
    - Test `/cancel` at any step clears session and sends cancellation message
    - Test `/help` returns command list
    - Test `/start` while session active prompts for confirmation
    - Test post-delivery session cleanup
    - _Requirements: 1.1, 1.2, 1.3, 8.2, 8.4_
  - [ ]* 11.2 Write property test: cancel clears session at any step (P1)
    - `// Feature: fayda-id-reconstruction-bot, Property 1: Cancel clears session at any step`
    - Use `fc.constantFrom(...Object.values(ConversationStep))` + `fc.record(sessionDataArb)` to generate random step + session; call cancel handler; assert `SessionService.get` returns `undefined`
    - **Property 1: Cancel clears session at any step**
    - **Validates: Requirements 1.2, 8.2**
  - [ ]* 11.3 Write property test: state machine advances in correct field order (P2)
    - `// Feature: fayda-id-reconstruction-bot, Property 2: State machine advances in correct field order`
    - Generate a sequence of valid inputs for each step; assert each resulting step equals the next enum value in the defined sequence
    - **Property 2: State machine advances in correct field order**
    - **Validates: Requirements 2.1, 3.1**
  - [ ]* 11.4 Write property test: step transitions logged without field values (P16)
    - `// Feature: fayda-id-reconstruction-bot, Property 16: Step transitions are logged at INFO level`
    - Generate step transitions with arbitrary field values; assert logger.info was called with step name and user ID but NOT with any field value string
    - **Property 16: Step transitions are logged at INFO level**
    - **Validates: Requirements 10.1, 10.3**

- [x] 12. Implement global exception filter and logging
  - Create `src/filters/all-exceptions.filter.ts` implementing NestJS `ExceptionFilter`
  - On any unhandled exception: log full stack trace at ERROR level (no user field values), send generic error message to user via Telegraf context if available, call `SessionService.delete` to clear stuck session
  - Register filter globally in `main.ts` via `app.useGlobalFilters()`
  - Configure NestJS Logger with `LOG_LEVEL` env var; use structured log format
  - [x] 12.1 Write unit tests for exception filter
    - Test that filter logs at ERROR level with stack trace
    - Test that filter sends generic message to user (mock ctx)
    - Test that filter clears session on exception
    - _Requirements: 10.2_
  - [ ]* 12.2 Write property test: unhandled exceptions logged at ERROR level (P17)
    - `// Feature: fayda-id-reconstruction-bot, Property 17: Unhandled exceptions are logged at ERROR level`
    - Use `fc.string()` to generate arbitrary error messages; wrap in `Error`, pass to filter; assert `logger.error` called with stack trace
    - **Property 17: Unhandled exceptions are logged at ERROR level**
    - **Validates: Requirements 10.2**

- [x] 13. Implement startup validation
  - In `main.ts` (or a dedicated `StartupValidator` service called before `app.listen()`), check:
    - `TELEGRAM_BOT_TOKEN` is set; if not, `logger.fatal('FATAL: TELEGRAM_BOT_TOKEN is not set')` and `process.exit(1)`
    - All required asset files exist (`bg_front.png`, `bg_back.png`, `eth_flag.png`, `national_id_logo.png`, all four font files); if any missing, log which files are absent and `process.exit(1)`
    - face-api model files exist; if missing, log warning only (non-fatal, falls back to center-crop)
  - [x] 13.1 Write unit tests for startup validation
    - Test missing `TELEGRAM_BOT_TOKEN` causes `process.exit(1)` (mock `process.exit`)
    - Test missing asset file causes `process.exit(1)` with descriptive log
    - Test missing face-api models logs warning but does not exit
    - _Requirements: 9.5_

- [x] 14. Final checkpoint — full test suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `numRuns: 100` (set explicitly)
- Each property test file must include the comment tag: `// Feature: fayda-id-reconstruction-bot, Property N: <property text>`
- Asset files (`assets/`) must be provided separately — they are not generated by code
- The face-api model files can be copied from `node_modules/@vladmandic/face-api/model/` after `npm install`
