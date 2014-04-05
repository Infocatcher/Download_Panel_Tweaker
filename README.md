#### Styles
Example styles for <a href="http://kb.mozillazine.org/UserChrome.css">userChrome.css</a>/<a href="https://addons.mozilla.org/addon/stylish/">Stylish</a>:
* <a href="https://github.com/Infocatcher/UserStyles/blob/master/Download_Panel_Tweaker_hide_items">hide some menu items</a>
* <a href="https://github.com/Infocatcher/UserStyles/blob/master/Download_percentage">show NN% label after each progress bar</a>

#### API
You can use "DownloadPanelTweaker:OpenDownloadWindow" and "DownloadPanelTweaker:ToggleDownloadSidebar" events to override “open old window” and “toggle sidebar” commands, example:
```js
window.addEventListener("DownloadPanelTweaker:OpenDownloadWindow", function(e) {
	e.preventDefault();
	// Put here some code to open alternative download window
}, false);
```

#### Internals
Compact downloads list style: https://github.com/Infocatcher/UserStyles/tree/master/Compact_downloads
<br>Visible downloads count limit: https://gist.github.com/Infocatcher/5387328
<br>Show download rate: https://gist.github.com/Infocatcher/5787749
<br>Don't remove finished downloads: https://gist.github.com/Infocatcher/6452231

Additional tweaks can be done using following style (but `[downloadPanelTweaker_paused]` doesn't work without extension):
```css
/* Download Panel Tweaker */
@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
@-moz-document url("chrome://browser/content/browser.xul"),
	url("chrome://browser/content/places/places.xul"),
	url("about:downloads"),
	url("chrome://browser/content/downloads/contentAreaDownloadsView.xul") {
	#downloadsListBox { /* Firefox < 20 or NASA Night Launch theme */
		width: auto !important;
		min-width: 0 !important;
		max-width: none !important;
	}
	.downloadContainer,
	.download-state > vbox /* Firefox < 20 */ {
		width: 58ch !important;
		min-width: 0 !important;
	}
	#downloadsSummaryDescription,
	#downloadsSummaryDetails {
		width: 58ch !important;
		min-width: 0 !important;
	}
	.downloadTarget {
		min-width: 5ch !important;
	}
	.downloadProgress {
		min-width: 20px !important;
		min-height: 10px !important;
		height: 10px !important;
	}
	.downloadProgress > .progress-bar {
		height: auto !important;
		min-height: 2px !important;
		max-height: 10px !important;
	}
	/* Paused downloads */
	.download-state[state="4"] .downloadProgress,
	#downloadsSummary[downloadPanelTweaker_paused] .downloadProgress {
		filter: url("chrome://mozapps/skin/extensions/extensions.svg#greyscale");
	}
	.download-state[state="4"] .downloadProgress > .progress-bar,
	.download-state[state="4"] .downloadProgress > .progress-remainder,
	#downloadsSummary[downloadPanelTweaker_paused] .downloadProgress > .progress-bar,
	#downloadsSummary[downloadPanelTweaker_paused] .downloadProgress > .progress-remainder {
		opacity: 0.85;
	}
}
```