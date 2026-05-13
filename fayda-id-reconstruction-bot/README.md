# Fayda ID Reconstruction Bot

A Telegram bot built with NestJS and Telegraf that reconstructs a printable Ethiopian Fayda Digital ID card from a Fayda app screenshot.

## Features

- Step-by-step Telegram conversation flow
- OCR pre-fill from a Fayda app screenshot with `tesseract.js`
- Portrait extraction from screenshots with NVIDIA Build face detection
- Portrait output preserves original source color (no forced grayscale)
- Sharp-based fallback crop when the NVIDIA API key is not configured or detection fails
- Front and back card rendering with `@napi-rs/canvas`
- Barcode and QR code generation
- In-memory session management with TTL auto-expiry

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and message `@BotFather`
2. Send `/newbot` and follow the prompts
3. Copy the bot token you receive

### 2. Configure Environment

```bash
cp .env.example .env
```

Set at least:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
NVIDIA_API_KEY=your_build_nvidia_api_key
```

Optional:

```env
PHOTO_DEBUG_DIR=C:\path\to\debug-crops
```

### 3. Place Asset Files

Copy required assets into `assets/`:

```text
assets/
|-- bg_front.png
|-- bg_back.png
`-- fonts/
    |-- NotoSansEthiopic-VariableFont_wdth,wght.ttf
    `-- Roboto-VariableFont_wdth,wght.ttf
```

Download fonts from [Google Fonts](https://fonts.google.com).

### 4. Run

```bash
npm install
npm run start:dev
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Bot token from BotFather |
| `NODE_ENV` | No | `development` | `production` or `development` |
| `SESSION_TTL_MINUTES` | No | `30` | Session expiry in minutes |
| `LOG_LEVEL` | No | `info` | `info`, `debug`, or `error` |
| `POLLING_TIMEOUT` | No | `30` | Telegraf long-poll timeout in seconds |
| `NVIDIA_API_KEY` | No | - | API key from build.nvidia.com |
| `NGC_API_KEY` | No | - | Alternative env name for the same NVIDIA key |
| `PHOTO_DEBUG_DIR` | No | - | Optional directory for screenshot/card/portrait debug outputs |
| `FRONT_PORTRAIT_X` | No | `28` | Front-card portrait box left position |
| `FRONT_PORTRAIT_Y` | No | `155` | Front-card portrait box top position |
| `FRONT_PORTRAIT_W` | No | `285` | Front-card portrait box width |
| `FRONT_PORTRAIT_H` | No | `345` | Front-card portrait box height |
| `FRONT_NAME_X` | No | `398` | Base X for name lines |
| `FRONT_NAME_AMH_Y` | No | `203` | Amharic name Y |
| `FRONT_NAME_ENG_Y` | No | `232` | English name Y |
| `FRONT_DOB_X` | No | `398` | Base X for DOB lines |
| `FRONT_DOB_ETH_Y` | No | `290` | Ethiopian DOB Y |
| `FRONT_DOB_GREG_Y` | No | `324` | Gregorian DOB Y |
| `FRONT_EXPIRY_X` | No | `398` | Base X for expiry lines |
| `FRONT_EXPIRY_ETH_Y` | No | `372` | Ethiopian expiry Y |
| `FRONT_EXPIRY_GREG_Y` | No | `406` | Gregorian expiry Y |
| `FRONT_SEX_X` | No | `760` | Base X for sex lines |
| `FRONT_SEX_AMH_Y` | No | `390` | Amharic sex Y |
| `FRONT_SEX_ENG_Y` | No | `424` | English sex Y |
| `FRONT_NATIONALITY_X` | No | `398` | Base X for nationality lines |
| `FRONT_NATIONALITY_AMH_Y` | No | `462` | Amharic nationality Y |
| `FRONT_NATIONALITY_ENG_Y` | No | `496` | English nationality Y |
| `FRONT_FCN_STYLE` | No | `barcode` | `barcode` for standard FAN barcode mode, `text` for plain-number mode |
| `FRONT_FCN_BOX_X` | No | `515` | FCN white box left |
| `FRONT_FCN_BOX_Y` | No | `574` | FCN white box top |
| `FRONT_FCN_BOX_W` | No | `282` | FCN white box width |
| `FRONT_FCN_BOX_H` | No | `38` | FCN white box height |
| `FRONT_FCN_LABEL_X` | No | `430` | FCN label X |
| `FRONT_FCN_LABEL_Y` | No | `608` | FCN label Y |
| `FRONT_FCN_VALUE_X` | No | `656` | FCN value center X |
| `FRONT_FCN_VALUE_Y` | No | `603` | FCN value baseline Y |
| `ALLOW_MISSING_ETHIOPIC_FONTS` | No | `false` | Set `true` only for local testing without NotoSansEthiopic files |

## Testing

```bash
npm test
npm run test:cov
```
