# Installation and updates

Cool Pills is distributed as a browser-specific ZIP from the [GitHub releases page](https://github.com/asoapyoid/coolpills/releases/latest). It supports Chrome, Edge, Brave, and Firefox.

## Chrome, Edge, or Brave

1. Download the Chrome ZIP and extract it into a folder that you will keep.
2. Open the browser's extensions page: `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Open [Coolhole](https://coolhole.org) and sign in.

Do not delete or move the selected folder after loading the extension; the browser runs the unpacked files from that location.

## Firefox

1. Download the Firefox ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose the downloaded ZIP.
4. Open [Coolhole](https://coolhole.org) and sign in.

Firefox temporary add-ons are removed when Firefox closes. Load the ZIP again after restarting the browser.

## Updating

Cool Pills can check for a newer GitHub release from **Settings → Updates → Check for updates**. The extension cannot silently replace its own files; install the downloaded package manually.

### Chrome, Edge, or Brave

1. Extract the new ZIP.
2. Copy its contents into the same folder originally selected with **Load unpacked**, replacing old files.
3. Check that `manifest.json` is directly inside the selected folder, not nested in another folder.
4. Open the browser's extensions page and click **Reload** on Cool Pills.
5. Refresh open pages where the updated content scripts should run.

### Firefox

Reload the extension from `about:debugging` if the **Reload** control is available. Otherwise remove the temporary add-on and load the new ZIP. Refresh pages to activate the updated scripts.

## Remove

Remove Cool Pills from the browser's extensions page. Removing it also makes its locally stored settings and queue data unavailable to the extension.
