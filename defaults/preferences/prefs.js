pref("extensions.downloadPanelTweaker.itemCountLimit", 7);
pref("extensions.downloadPanelTweaker.panelWidth", 58);
pref("extensions.downloadPanelTweaker.panelMaxHeight", 0);
pref("extensions.downloadPanelTweaker.progressBarHeight", 10);
pref("extensions.downloadPanelTweaker.showDownloadRate", true);
pref("extensions.downloadPanelTweaker.compactDownloads", 1);
pref("extensions.downloadPanelTweaker.decolorizePausedProgress", true);

pref("extensions.downloadPanelTweaker.overrideDownloadsCommand", 0);
pref("extensions.downloadPanelTweaker.overrideDownloadsCommand.private", 0);
pref("extensions.downloadPanelTweaker.overrideDownloadsHotkey", 1);
pref("extensions.downloadPanelTweaker.overrideDownloadsHotkey.private", 1);
pref("extensions.downloadPanelTweaker.overrideShowAllDownloads", 0);
pref("extensions.downloadPanelTweaker.overrideShowAllDownloads.private", 0);
// 0 - perform default action (don't override)
// 1 - toggle download panel
// 2 - open old downloads window
// 3 - open "about:downloads" tab
// 4 - open downloads library

pref("extensions.downloadPanelTweaker.dontRemoveFinishedDownloads", true);
// Additional tweaks for dontRemoveFinishedDownloads = true:
pref("extensions.downloadPanelTweaker.downloadsMaxRetentionHours", 72); // 3*24, only Firefox 26+
// Store finished downloads at least this time (in hours)
pref("extensions.downloadPanelTweaker.cleanupDownloadsOnShutdown", true); // only Firefox 26+
// Save current "session" downloads into %profile%/downloads.json on browser shutdown to perform cleanup
// and correctly remove deleted (from UI) downloads, but this may break save process, if someone will
// call it at the same time.

pref("extensions.downloadPanelTweaker.fixWrongTabsOnTopAttribute", true);

pref("extensions.downloadPanelTweaker.prefsVersion", 0);

pref("extensions.downloadPanelTweaker.debug", false);