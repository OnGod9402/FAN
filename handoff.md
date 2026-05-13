Fayda ID Reconstruction Bot — AI Handoff Guide

Project overview
This is a NestJS + Telegraf Telegram bot that reconstructs a printable Fayda ID image from user screenshots.

Current intended flow:
1. User starts bot and selects language.
2. User sends screenshots step-by-step.
3. Bot OCRs data, shows confirmation.
4. Bot generates final combined ID image.



What I changed just now

1) Fully refactored conversation flow to strict step-by-step screenshot intake
Updated src/telegram/conversation.scene.ts to enforce this sequence:

1. Step 1/3: Front screenshot
◦  OCR via ocrService.extractFrontCard(...)
2. Step 2/3: Back screenshot
◦  OCR via ocrService.extractBackCard(...)
3. Step 3/3: Portrait screenshot/photo
◦  Stored for portrait processing
4. Review screen
◦  Shows extracted fields from front + back
◦  Buttons:
▪  Generate Card
▪  Resend Front
▪  Resend Back
▪  Resend Portrait
5. Generate
◦  Processes portrait with photoService.processPortrait(...)
◦  Generates combined image with cardService.generateCombined(...)
◦  Sends fayda_id.png

2) Updated bot help text to match real behavior
Updated src/telegram/telegram.service.ts:
•  Removed misleading /skip and /keep mentions.
•  Help now describes actual front → back → portrait → review → generate flow.



Current status after changes
•  New multi-screenshot wizard flow is implemented.
•  Regenerate/re-upload path per screenshot is implemented.
•  Final generation remains integrated with existing card generator.
•  Build was run once and completed successfully before your “don’t build” message.



Key files to inspect
•  src/telegram/conversation.scene.ts (main flow logic — heavily updated)
•  src/telegram/telegram.service.ts (help text and command wiring)
•  src/ocr/ocr.service.ts (front/back OCR extraction)
•  src/photo-processor/photo-processor.service.ts (portrait extraction)
•  src/card-generator/card-generator.service.ts (final output rendering)



Important behavior notes
•  Front/back OCR now happen separately and sequentially.
•  Portrait is now explicitly requested as its own input step.
•  User can re-upload any one of the 3 screenshot types from review.
•  Session state uses existing fields (_frontScreenshotBuffer, _backScreenshotBuffer, _portraitScreenshotBuffer, etc.).



Known risks / follow-up tasks for next AI
1. Run and test end-to-end in Telegram with real screenshots.
2. Verify OCR quality for different screenshot resolutions.
3. Verify portrait step input type (photo vs screenshot variants from users).
4. Regression-test old tests:
◦  Existing repo had prior failing tests around OCR mocks and portrait size expectation (not introduced by this change).
5. Optional UX improvement:
◦  Add per-language labels for back fields in review (currently extra review lines are mostly English labels).



Suggested prompt for next AI IDE
“Open src/telegram/conversation.scene.ts and verify the new 6-step wizard flow (front OCR, back OCR, portrait upload, review, regenerate options, final generation). Then run an end-to-end simulation and fix any runtime edge cases in callback navigation or OCR empty-field handling.”



If you want, I can now generate a second handoff block focused only on QA test cases (user journeys + expected bot messages) so the next AI can validate quickly.