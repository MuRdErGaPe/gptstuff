# Hover Correct Firefox Extension

Hover Correct adds hover-aware spell checking to Firefox. When you hover over a misspelled word on any webpage, the extension looks up spelling suggestions. If a likely correction is available, a tooltip prompts you to press **Alt+.** (Alt and the period key) to instantly replace the word with the top suggestion.

## Features
- Detects the word under your cursor using the browser's caret APIs.
- Queries the Datamuse suggestion service to determine whether the word is misspelled.
- Shows an unobtrusive tooltip near your cursor when an automatic correction is available.
- Replaces the misspelled word in-place and dispatches input events so editors react properly.

## Installation
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside this folder.
4. Visit any page with editable text. Hover over a misspelled word and press **Alt+.** to auto-correct it.

> **Note:** The extension relies on Datamuse for spelling suggestions. Ensure that network access to `https://api.datamuse.com` is available.
