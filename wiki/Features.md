# Features and queue behavior

## Video detection

Cool Pills watches enabled pages for video players and supported site-specific video cards. It places a small CH | CP pill near the detected video. On YouTube cards the control is positioned on the card; on other pages it is placed by the player. The extension can use page and player metadata to identify an item.

Detection depends on the page markup and the media being exposed by the site. A site redesign, private post, login wall, or custom player can prevent detection.

## Sending an item to Coolhole

When you choose CH or queue an item with a shortcut, Cool Pills sends the selected media link to a Coolhole tab, along with available title, duration, and thumbnail metadata. It reuses a matching open tab when possible, or opens Coolhole to handle the request.

## Q+ waiting list

Q+ is the extension's local waiting list for items that should be added later. It is stored in browser extension storage and associated with the Coolhole account detected in the tab.

- Drag and drop entries to change their order.
- Enable **Auto-queue when a slot opens** to send the next item when there is room.
- Schedule an entry to defer it until a chosen time.
- Use **Frc** to attempt to send an entry immediately.
- Use **+Link** to add one or more links.

The queue drain uses a shared lock so multiple Coolhole tabs do not intentionally process the same Q+ item simultaneously. Items rejected as invalid or unplayable are removed rather than retried forever. An item may be sent to Coolhost after a genuine playback rejection; a queue-limit response is not treated as a playback failure.

## History and pins

Hist stores recently handled queue items in the extension's local storage. Search history, pin frequently used items, or re-queue an item. Q+ items and history are available from the floating Coolhole panel.

## Coolhost processing

For eligible links that Coolhole rejects as unplayable, Cool Pills can submit the link to Coolhost and queue the resulting MP4 only after processing completes. Processing occurs in an inactive tab so it does not take over the page you are using. A Coolhole tab can show status notices. See [Reddit and Coolhost recovery](Coolhost-Recovery).

## Themes and Gold Collector

The extension can use its own panel themes or follow supported Coolhole themes. Gold Collector assists with lottery chat lines. The look, opacity, and theme options are described in [Settings](Settings).
