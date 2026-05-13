# Requirements Document

## Introduction

The Fayda ID Reconstruction Bot is a Telegram bot that guides users through a step-by-step conversation to collect all fields required to reconstruct a printable Ethiopian Fayda Digital ID card. The bot accepts text inputs and a photo from the user, then generates a high-fidelity PNG or PDF image of both the front and back of the Fayda ID card, matching the official card layout.

The MVP does not perform OCR on uploaded screenshots. All field values are entered manually by the user via the Telegram conversation interface.

## Glossary

- **Bot**: The Telegram bot application built with python-telegram-bot
- **User**: A Telegram user interacting with the Bot
- **Session**: A single user's active data-collection conversation from /start to card generation
- **FAN**: Fayda Account Number — the 16-digit card number encoded in the barcode
- **FIN**: Fayda Identification Number — a unique identifier printed on the back of the card
- **SN**: Serial Number printed on the back of the card
- **Front_Card**: The front face of the reconstructed Fayda ID card image
- **Back_Card**: The back face of the reconstructed Fayda ID card image
- **Card_Generator**: The component responsible for compositing all fields into the final card image
- **Session_Store**: The in-memory or file-based store that holds per-user session data during a conversation
- **Conversation_Handler**: The component managing the multi-step Telegram conversation flow
- **Renderer**: The Pillow-based image rendering engine used by the Card_Generator

---

## Requirements

### Requirement 1: Bot Initialization and Entry Point

**User Story:** As a user, I want to start the bot with a simple command, so that I know how to begin the ID reconstruction process.

#### Acceptance Criteria

1. WHEN a user sends `/start` to the Bot, THE Conversation_Handler SHALL respond with a welcome message explaining the purpose of the bot and prompt the user to begin entering their ID fields.
2. WHEN a user sends `/cancel` at any step, THE Conversation_Handler SHALL discard the current Session and notify the user that the process has been cancelled.
3. WHEN a user sends `/help`, THE Bot SHALL respond with a list of available commands and a brief description of the workflow.

---

### Requirement 2: Step-by-Step Field Collection — Front Card Fields

**User Story:** As a user, I want to be guided step by step to enter each field, so that I don't miss any required information for the front of my ID card.

#### Acceptance Criteria

1. THE Conversation_Handler SHALL collect the following front-card fields in sequential steps, prompting the user for each one individually:
   - Full name in Amharic script
   - Full name in English
   - Date of birth in Ethiopian calendar format (DD/MM/YYYY)
   - Date of birth in Gregorian calendar format (YYYY/Mon/DD)
   - Sex in Amharic (e.g. ወንድ or ሴት)
   - Sex in English (Male or Female)
   - Date of expiry in Ethiopian calendar format (YYYY/MM/DD)
   - Date of expiry in Gregorian calendar format (YYYY/Mon/DD)
   - Date of issue in Ethiopian calendar format (YYYY/MM/DD)
   - Date of issue in Gregorian calendar format (YYYY/Mon/DD)
   - Card number (FAN) — 16-digit numeric string
2. WHEN a user provides a FAN value that is not exactly 16 digits, THE Conversation_Handler SHALL reject the input and prompt the user to re-enter a valid 16-digit card number.
3. WHEN a user provides a date in an unrecognized format, THE Conversation_Handler SHALL notify the user of the expected format and prompt re-entry.

---

### Requirement 3: Step-by-Step Field Collection — Back Card Fields

**User Story:** As a user, I want to enter the fields for the back of my ID card, so that the reconstructed card is complete.

#### Acceptance Criteria

1. THE Conversation_Handler SHALL collect the following back-card fields in sequential steps after all front-card fields are collected:
   - Phone number
   - FIN number (format: "FIN XXXXXXXX XXXX")
   - Nationality in Amharic (e.g. ኢትዮጵያ)
   - Nationality in English (e.g. Ethiopian)
   - Region in Amharic and English
   - Zone in Amharic and English
   - Woreda in Amharic and English
   - SN number (format: "SN: XXXXXXX")
2. WHEN a user provides a phone number that does not match a 10-digit Ethiopian format (starting with 09 or 07), THE Conversation_Handler SHALL warn the user and ask them to confirm or re-enter.
3. WHEN a user provides a FIN value that does not match the pattern "FIN XXXXXXXX XXXX", THE Conversation_Handler SHALL reject the input and prompt the user to re-enter in the correct format.

---

### Requirement 4: Photo Upload

**User Story:** As a user, I want to upload my photo, so that it appears on the reconstructed ID card.

#### Acceptance Criteria

1. WHEN all text fields have been collected, THE Conversation_Handler SHALL prompt the user to upload a portrait photo.
2. WHEN the user sends a photo via Telegram, THE Bot SHALL download and store the photo in the current Session.
3. IF the user sends a file type that is not a photo or image, THEN THE Conversation_Handler SHALL notify the user and re-prompt for a valid photo.
4. WHEN the uploaded photo dimensions are not in portrait orientation (height >= width), THE Card_Generator SHALL crop or resize the photo to fit the designated portrait area on the Front_Card without distortion.

---

### Requirement 5: ID Card Generation — Front Side

**User Story:** As a user, I want the bot to generate the front of my Fayda ID card, so that it visually matches the official card layout.

#### Acceptance Criteria

1. WHEN all front-card fields and the user photo are available in the Session, THE Card_Generator SHALL render the Front_Card image at a resolution of at least 1012 × 638 pixels (standard CR80 card ratio at 300 DPI equivalent).
2. THE Renderer SHALL place the user photo in the designated portrait area on the left side of the Front_Card.
3. THE Renderer SHALL render the full name in both Amharic and English in the designated name area.
4. THE Renderer SHALL render date of birth, sex, date of expiry, and date of issue fields in their correct bilingual positions on the Front_Card.
5. THE Renderer SHALL render the FAN as a barcode (Code 128 or Code 39) in the designated barcode area at the bottom of the Front_Card.
6. THE Renderer SHALL include the "FAYDA DIGITAL COPY" watermark text on the Front_Card.
7. THE Renderer SHALL include placeholder graphics for the Ethiopian flag and National ID logo in the designated header area.
8. WHERE a QR code asset is provided, THE Renderer SHALL place the QR code in the designated area on the Front_Card.

---

### Requirement 6: ID Card Generation — Back Side

**User Story:** As a user, I want the bot to generate the back of my Fayda ID card, so that all back-side information is included.

#### Acceptance Criteria

1. WHEN all back-card fields are available in the Session, THE Card_Generator SHALL render the Back_Card image at the same resolution as the Front_Card.
2. THE Renderer SHALL render the phone number, FIN number, nationality (bilingual), address (Region/Zone/Woreda, bilingual), and SN number in their correct positions on the Back_Card.
3. THE Renderer SHALL render a QR code encoding the FIN number in the designated large QR code area on the Back_Card.

---

### Requirement 7: Output Delivery

**User Story:** As a user, I want to receive the generated ID card as a downloadable file, so that I can print it.

#### Acceptance Criteria

1. WHEN both Front_Card and Back_Card images are generated, THE Bot SHALL send both images to the user as high-quality PNG files in the same Telegram message.
2. WHERE the user has requested PDF output (via a prompt or command), THE Bot SHALL combine the Front_Card and Back_Card into a single two-page PDF and send it to the user.
3. WHEN the card files are sent, THE Bot SHALL notify the user that the process is complete and offer to start a new session via `/start`.
4. WHEN card generation fails for any reason, THE Bot SHALL notify the user with a descriptive error message and offer to retry.

---

### Requirement 8: Session Management

**User Story:** As a user, I want my session data to be isolated and temporary, so that my information is not stored longer than necessary.

#### Acceptance Criteria

1. THE Session_Store SHALL maintain separate session data per Telegram user ID.
2. WHEN a Session is completed (card delivered) or cancelled, THE Session_Store SHALL delete all data associated with that Session including the uploaded photo.
3. WHILE a Session is active, THE Session_Store SHALL retain all collected field values and the uploaded photo in memory.
4. WHEN a user starts a new `/start` command while a Session is already active, THE Conversation_Handler SHALL ask the user to confirm restarting, discarding the current Session data.

---

### Requirement 9: Deployment — Docker

**User Story:** As a developer, I want the bot to be deployable via Docker on a Linux server, so that setup and updates are reproducible and isolated.

#### Acceptance Criteria

1. THE Bot SHALL be packaged with a `Dockerfile` that builds a self-contained image using a Python 3.11+ base image.
2. THE `Dockerfile` SHALL install all required dependencies from a `requirements.txt` file.
3. THE Bot SHALL read the Telegram bot token from an environment variable named `TELEGRAM_BOT_TOKEN`.
4. WHERE a `docker-compose.yml` file is provided, THE Bot SHALL be startable with a single `docker compose up -d` command.
5. IF the `TELEGRAM_BOT_TOKEN` environment variable is not set at startup, THEN THE Bot SHALL log a descriptive error and exit with a non-zero status code.

---

### Requirement 10: Logging and Observability

**User Story:** As a developer, I want the bot to emit structured logs, so that I can monitor activity and debug issues in production.

#### Acceptance Criteria

1. THE Bot SHALL emit a log entry at INFO level for each step transition in the Conversation_Handler, including the user ID (not username) and the step name.
2. WHEN an unhandled exception occurs, THE Bot SHALL log the full stack trace at ERROR level and notify the user that an unexpected error occurred.
3. THE Bot SHALL NOT log any field values entered by the user in order to protect user privacy.
