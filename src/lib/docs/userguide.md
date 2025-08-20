## Overview

Voice Libre creates a "Voice to Voice" AI engagement eperience. Made for people who use their voice. Made for those who use multiple languages. Made for people who want to enage AI in a more natural way. Set your voice free!

The interface centers on a microphone control and a bottom action bar that controls the most common needs such as choosing what AI you engage and its personality, hands free voice to voice conversation, chat memory, Internet augmentation for any AI, and save and load previous chat transcripts.

### 100's of AI models

VoiceLibre supports 100's of AI LLM models multilingual speech-to-text (STT) and text-to-speech (TTS) (≈30 languages) via supported providers (OpenAI, ElevenLabs, and 100's of other providers of AI services via APIpie.ai).

This app was developed as a language tutor assistant where as users and ai can go between multiple languages in their requests and responses. The app requires an **apipie.ai API key** to enable memory, internet search augmentation, and ElevenLabs voices. This is release 1.0, the MVP for voiceLibre, more improvements to come over time.

### This project is opensource

This can be used from our website or users can download the source and run it from docker on their own machine however, a mysql server is required. This project is also opensource, consider becoming a contributor.

Github: [voicelibre](https://github.com/EncryptShawn/voicelibre)

## Languages supported

Afrikaans, Albanian, Amharic, Arabic, Armenian, Basque, Belarusian, Bengali, Bosnian, Bulgarian, Burmese (Myanmar), Catalan, Cebuano, Chinese (Mandarin), Chinese (Cantonese), Croatian, Danish, Dutch, English, Estonian, Filipino (Tagalog), Finnish, French, Galician, Georgian, German, Greek, Gujarati, Haitian Creole, Hausa, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Irish, Italian, Japanese, Javanese, Kannada, Kasakh, Khmer, Korean, Kurdish, Kyrgy, Lao, Latvian, Lithuanian, Macedonian, Malay, Malayalam, Maltese, Marathi, Mongolian, Nepali, Norwegian, Persian (Farsi), Polish, Portuguese, Punjabi, Romanian, Russian, Serbian, Sinhala, Slovak, Slovenian, Somali, Spanish, Sundanese, Swahili, Swedish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, Uyghur, Usbek, Vietnamese, Xhosa, Yiddish, Yoruba, Zulu

---

## Quick Start

1. **Sign in** with Google (only Google auth is supported at present).
2. Add your **apipie.ai API key** via Profile → API Key. Without it some features (memory, internet augment, ElevenLabs voices) are restricted.
3. Open the **Chat** screen (default) and tap the central **Microphone** to begin.

---

## Main UI

(Top → Center → Bottom)

### Top Bar (Header)

- **Logo** (top-left) — returns to main screen.
- **Chat** button (default view).
- **Transcripts** button — opens saved transcripts page.
- **Profile** (top-right) — access settings, API key, theme (light/dark), usage analytics, help, and logout.

### Center (Chat Area)

- Conversation bubbles show both user speech transcripts and AI responses.
- Each chat bubble contains **detailed usage data** (tokens, audio cost, total cost, latency, chars) visible on demand.
- You can **swipe** any message to the right to reveal a **Delete** button — taps require confirmation.

> Example: chat bubbles show per-message usage details (tokens, audio cost, latency).  
> See screenshot for usage annotation in a chat bubble:

![Chat Usage Example](./screenshots/voiceLibre-dark.png)

### Bottom Bar (Primary Controls)

From left → right:

1. **Responders dropdown**
   - Presets: `Default`, `General`, `Language`, etc.
   - Admins can edit presets in the backend (MySQL). Standard users **cannot** edit admin presets.
   - **+** below responders: create _your own_ responder (see "Creating a Custom Responder").

2. **Other icons**
   - **Internet (globe) icon** — toggle internet augmentation for the next AI request.
     - Tap to enable/disable.
     - **Long-hold** = choose search depth: **Low**, **Medium**, **High** (affects how many and how deep AI-generated searches are made).
   - **Memory (brain) icon** — toggle remembering for the next AI request.
     - Tap to tell the AI to remember the current conversation context.
     - **Long-hold** = memory actions:
       - **Clear all memory** (flush memory).
       - **Reload transcript into memory** (push a saved transcript into memory).
   - **TTS/Audio/Play** icon(s) — indicate audio state / playback controls.
   - **Save transcript** (far right) — save the current conversation to the Transcripts page.

3. **Central Microphone button**
   - **Tap** to start recording.
   - **Tap again** to stop recording and send audio to the AI.
   - **Hands-Free** mode: enable via a small toggle or quick menu — the app auto-records user speech, sends to AI, receives response, sends to TTS in multi-chunk playback, then re-opens the mic for the user's next turn.

> Bottom bar screenshot (shows responders, memory, internet, save transcript, mic):  
> ![Bottom Controls](./screenshots/voiceLibre-bottom-bar.png)

---

## Recording Modes & Flow

### Push-to-Record (manual)

- Press mic → speak → press mic to stop → audio uploaded and transcribed → AI receives transcript and responds → optional TTS → playback.

### Hands-Free Mode (auto conversational loop)

- Enable **Hands-Free**.
- The cycle:
  1. Record user speech (auto-chunking).
  2. Auto-send chunk(s) to AI.
  3. AI generates text response.
  4. TTS (multi-chunk) generated and played back seamlessly.
  5. After playback, mic re-opens for the user to continue.

Notes:

- Hands-Free is perfect for continuous back-and-forth flows like tutoring or practice.
- While TTS plays the UI displays audio waveforms and playback progress.

---

## Internet Search

- **Purpose:** Augments AI responses with current Internet results created by AI-generated searches based on the user's prompt.
- **How to use:**
  - **Tap** the globe icon to toggle internet augmentation ON/OFF.
  - **Long-hold** globe icon to choose search **depth**: **Low**, **Medium**, **High**.
    - Low = fewer/shallow searches (faster/cheaper).
    - Medium = balanced.
    - High = deeper/more searches (slower/higher cost).
- Internet augmentation requires backend access (apipie.ai key) for full functionality.

---

## Memory Controls

- **Tap** the memory (brain) icon to mark the next turn as something the AI should remember.
- **Short-term** vs **Long-term** memory are configurable per-responder (see responders).
- **Long-hold memory** options:
  - **Clear all memory** — wipe stored memory for the current responder/user.
  - **Reload transcript into memory** — re-ingest a saved transcript into memory so the AI can reference prior content.

---

## Responders (Presets & Custom)

### What is a Responder?

A **responder** is a named configuration that defines AI behavior. Fields include:

- **Name**
- **AI Model** (e.g., `pool/gpt-4-1`, `gpt-4o-mini-tts`)
- **Voice Model** (TTS provider selection)
- **Voice** (voice identity)
- **System Prompt** (system behavior)
- **Response Length** (token cap)
- **Short-term / Long-term Memory** sliders
- **Memory Expiration** (minutes)

> Responder editor screenshot (shows voice, model, prompt, memory sliders, response length):  
> ![Responder Editor](./screenshots/voiceLibre-Responder.png)

### Presets vs Custom

- **Admin presets**: Global: `Default`, `General`, `Language`, etc. — read-only to normal users.
- **User custom responders**: Click **+** to create personal responders. Users can select model, voice, write prompts, and configure memory & response length.

### Choosing Models & Voices

- Responder editor is searchable and displays **average price and latency** for each model to help trade-offs between cost and performance.
- Available TTS voices depend on the chosen voice model (OpenAI or ElevenLabs).

---

## Creating & Editing a Responder

1. Click **+** under the responders list.
2. Fill in:
   - **Name**
   - **AI Model**
   - **Voice Model**
   - **Voice**
   - **Prompt** (behavior)
   - **Response Length**
   - **Short-Term** & **Long-Term Memory** sliders
   - **Memory Expiration**
3. Click **Save** — the responder is added to your personal list.

---

## Transcripts Page

- **Location:** Top bar → Transcripts.
- Displays saved conversations as cards with metadata: created/updated timestamps, # of messages, and a preview.
- Each transcript card actions:
  - **Reload to Chat** — load the transcript into the chat window for continued editing.
  - **Reload & Remember** — load the transcript and ingest it into memory (makes AI "remember" the prior conversation).
- **Edit & Save:** Load a transcript, edit content in chat, then save:
  - Saving with the same name **overwrites** the existing transcript.
  - Changing the name creates a new transcript.
- **Delete:** Swipe a transcript card to the right → confirm deletion.

> Transcripts page screenshot:  
> ![Transcripts](./screenshots/voiceLibre-transcripts.png)

---

## Detailed Chat Bubble Data

Each chat bubble includes a collapsible **usage** area with:

- **Cost (USD)** for the message
- **Tokens** used
- **Latency** (processing time)
- **Audio cost** (if TTS created)
- **Characters processed**

This per-message breakdown helps users track cost and performance.

---

## Usage Analytics

VoiceLibre provides a **Usage Analytics** interface in Profile:

- **Charts** (visual breakdowns: spend, tokens, model distribution).  
  ![Usage Charts](./screenshots/voiceLibre-usage-charts.png)

- **Records** (chronological list of API calls with model names and cost-per-request).  
  ![Usage Records](./screenshots/vocieLibre-usage-records.png)

Features:

- Time-range dropdown (Last 24 Hours, Last 7 Days, Last 30 Days).
- Charts tab + Records tab to inspect aggregated spend or individual requests.

---

## Profile & Settings

- **Theme:** Light / Dark toggle. Example light/dark UI assets:
  - Light mode screenshot:  
    ![Light Mode](./screenshots/voiceLibre-light.png)

  - Dark mode screenshot:  
    ![Dark Mode](./screenshots/voiceLibre-dark.png)

- **API Key:** Add/Update apipie.ai API key (required for memory, internet augment, ElevenLabs).
- **Usage:** Link to the Usage Analytics UI (charts + records).
- **Help:** Link to this documentation.
- **Logout:** Sign out of the app.
- **Auth:** Google Sign-In only for now.

---

## Deleting Messages & Transcripts

You can quickly delete any message or transcript in two ways:

- **Swipe right** on a message or transcript to reveal the **Delete** button. Tapping Delete will prompt for confirmation.
- **Double-click** a message or transcript to immediately prompt for deletion.

> Example:  
> ![Delete Action](./screenshots/voiceLibre-delete.png)

---

## Accessibility & Controls

- Buttons support **tap** and **long-press** for advanced actions (e.g., long-press memory/internet).
- Swipe-to-reveal actions for messages and transcripts (right-swipe = reveal delete).
- Visual indicators for recording, playback, and network activity.
- Multilingual support across UI and AI — STT and TTS available for ~30 languages via OpenAI/ElevenLabs and backend.

---

## Troubleshooting & Tips

- **No audio playback?**
  - Confirm device audio and that a TTS voice is selected.
  - Ensure `apipie.ai` API key is present for ElevenLabs voices.
- **Mic not recording?**
  - Confirm browser microphone permissions.
  - Refresh the page and re-select microphone device.
- **Memory not working?**
  - Check memory sliders in the responder config.
  - Use Long-hold Memory → Reload transcript into memory to force re-ingestion.
- **High latency?**
  - Use a lower-latency model or reduce internet search depth.
- **Cost concerns:**
  - Monitor Profile → Usage (Charts & Records).
  - Reduce response length and internet search depth.

---

## Security & Privacy Notes

- Transcripts are stored in your account; delete sensitive transcripts if needed.
- API keys are stored per user for backend access to apipie.ai features — do not share your key.
- Usage details and transcripts are only accessible when authenticated to your account.

---

## FAQ (Short)

- **Q:** Do I need an API key?  
  **A:** Yes — apipie.ai for full features (memory, internet augmentation, ElevenLabs). OpenAI-only fallback may be limited.

- **Q:** Can I edit admin responders?  
  **A:** No. Admin presets are read-only for normal users. Create a custom responder for changes.

- **Q:** How do I permanently remove memory?  
  **A:** Long-hold the memory button and choose **Clear all memory**.

- **Q:** How does Hands-Free handle chunking?  
  **A:** It chunks long audio, auto-sends chunks, receives AI text, converts text to multi-chunk TTS, plays audio, then reopens the mic.

---

## Glossary

- **Responder:** A configuration defining AI/voice/behavior presets.
- **TTS:** Text-to-speech (spoken responses).
- **STT:** Speech-to-text (transcription).
- **apipie.ai:** Backend service used by VoiceLibre to provide memory/internet/voice features.
- **Chunking:** Breaking audio into pieces for processing/playback.
- **Memory Reload:** Re-ingesting a transcript into the AI memory store.

---

## Example Walkthroughs

### Simple Interaction (push-to-record)

1. Select a responder (e.g., `Language`).
2. Tap mic → say “¿Puedes ayudarme con mi español?” → tap mic to stop.
3. App transcribes → sends to AI → AI replies → TTS plays (if enabled). See cost & tokens under the bubble.

### Start a Tutoring Session (hands-free)

1. Select `Language` responder tuned for tutoring.
2. Enable **Hands-Free**.
3. Speak naturally — the app auto handles recording, chunking, playback, and re-opening the mic for continued conversation.

### Save & Reuse a Session

1. After a session, tap **Save transcript** in the bottom bar.
2. Later: Top bar → Transcripts → choose the saved card.
3. Tap **Reload to Chat** to continue or **Reload & Remember** to re-ingest into memory.
