#### Internals
Compact downloads list style: https://github.com/Infocatcher/UserStyles/tree/master/Compact_downloads
<br>Visible downloads count limit: https://gist.github.com/Infocatcher/5387328

Additional tweaks can be done using following style:
```css
/* Download Panel Tweaker */
@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
@-moz-document url("chrome://browser/content/browser.xul"),
	url("chrome://browser/content/places/places.xul"),
	url("about:downloads"),
	url("chrome://browser/content/downloads/contentAreaDownloadsView.xul") {
	.downloadContainer {
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