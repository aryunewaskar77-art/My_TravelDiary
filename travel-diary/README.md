# My Travel Diary

## Project Description
My Travel Diary is a responsive, elegantly designed web application built to help users seamlessly record, manage, and revisit their personal travel memories. It offers a visually rich, card-based interface with dynamic color extraction, extensive theming options, and built-in photo gallery support.

## Tech Stack Used
* **Frontend:** HTML, CSS, JavaScript
* **Media Hosting:** Cloudinary API integration (with local Base64 fallback)
* **Storage:** LocalStorage API for persistence

## Features
* **Per-Card & Global Theming:** Personalize the entire app or individual memory cards with distinct theme palettes (Tropical, Mountain, City, Beach Sunset, Default).
* **Smart Image Galleries:** Upload multiple photos or videos for each memory. The system automatically handles cropping, maintaining photo dimensions (portrait or landscape).
* **Cloudinary Fallback:** Built-in safeguards automatically switch to local Base64 image encoding if the Cloudinary API is unconfigured or fails. 
* **Dynamic Palette Extraction:** Extracts the dominant colors from your cover photo to style the cards automatically (used as a fallback when no specific theme is selected).
* **Responsive Design:** A fluid layout built from the ground up to look perfect on full desktop monitors, tablets, and mobile devices.
* **Full CRUD Functionality:** Create new memories, edit titles/descriptions, and remove old entries at any time.

## Installation Steps
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/aryunewaskar77-art/My_TravelDiary.git
   ```
2. Navigate to the project directory:
   ```bash
   cd travelDiary
   ```
3. Open `index.html` in any modern web browser or use a tool like VS Code's "Live Server" extension for a better development experience.
4. *(Optional)* To enable cloud image hosting instead of browser local storage:
   * Open `script.js`
   * Overwrite `CLOUD_NAME` and `UPLOAD_PRESET` at the top of the file with your own Cloudinary credentials.

## Demo Credentials
To access the application, you can use the following mock credentials upon loading:
* **Email:** `<anything>@gmail.com` (e.g. `test@gmail.com`)
* **Password:** Must be exactly the same as the entered Email ID.
