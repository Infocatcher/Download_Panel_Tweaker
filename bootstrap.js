const WINDOW_LOADED = -1;
const WINDOW_CLOSED = -2;

const LOG_PREFIX = "[Download Panel Tweaker] ";

Components.utils.import("resource://gre/modules/Services.jsm");
var patcherLoaded = false;
this.__defineGetter__("patcher", function() {
	delete this.patcher;
	Components.utils.import("chrome://downloadpaneltweaker/content/patcher.jsm");
	patcherLoaded = true;
	patcher.init("downloadPanelTweakerMod::", _log);
	return patcher;
});

function install(params, reason) {
}
function uninstall(params, reason) {
}
function startup(params, reason) {
	dpTweaker.init(reason);
}
function shutdown(params, reason) {
	dpTweaker.destroy(reason);
}

var dpTweaker = {
	initialized: false,
	init: function(reason) {
		if(this.initialized)
			return;
		this.initialized = true;

		prefs.init();

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.initWindow(ws.getNext(), reason);
		if(!this._tweakStyleLoaded && Services.wm.getMostRecentWindow("Places:Organizer"))
			this.loadStyles();
		Services.ww.registerNotification(this);
		_log("Successfully started");
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.destroyWindow(ws.getNext(), reason);
		Services.ww.unregisterNotification(this);

		if(reason != APP_SHUTDOWN) {
			if(prefs.get("compactDownloads"))
				this.loadCompactStyle(false);
			this.loadTweakStyle(false);
		}

		prefs.destroy();
		if(patcherLoaded) {
			patcher.destroy();
			Components.utils.unload("chrome://downloadpaneltweaker/content/patcher.jsm");
		}
		_log("Successfully destroyed");
	},

	observe: function(subject, topic, data) {
		if(topic == "domwindowopened")
			subject.addEventListener("load", this, false);
		else if(topic == "domwindowclosed")
			this.destroyWindow(subject, WINDOW_CLOSED);
	},
	handleEvent: function(e) {
		if(e.type == "load") {
			var window = e.originalTarget.defaultView;
			window.removeEventListener("load", this, false);
			this.initWindow(window, WINDOW_LOADED);
		}
	},

	initWindow: function(window, reason) {
		if(reason == WINDOW_LOADED && this.isLibraryWindow(window)) {
			this.loadStyles();
			return;
		}
		if(reason == WINDOW_LOADED && !this.isTargetWindow(window))
			return;
		this.setItemCountLimit(window, true);
		if(prefs.get("detailedText")) {
			window.setTimeout(function() {
				this.patchDownloads(window, true);
			}.bind(this), 0);
		}
		window.setTimeout(function() {
			this.loadStyles();
		}.bind(this), 50);
	},
	destroyWindow: function(window, reason) {
		window.removeEventListener("load", this, false); // Window can be closed before "load"
		if(reason == WINDOW_CLOSED && !this.isTargetWindow(window))
			return;
		if(reason != WINDOW_CLOSED && reason != APP_SHUTDOWN)
			this.setItemCountLimit(window, false);
		if(prefs.get("detailedText"))
			this.patchDownloads(window, false, reason == WINDOW_CLOSED);
	},
	isTargetWindow: function(window) {
		return window.document.documentElement.getAttribute("windowtype") == "navigator:browser";
	},
	isLibraryWindow: function(window) {
		return window.document.documentElement.getAttribute("windowtype") == "Places:Organizer";
	},

	get sss() {
		delete this.sss;
		return this.sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			.getService(Components.interfaces.nsIStyleSheetService);
	},
	loadStyles: function() {
		if(prefs.get("compactDownloads"))
			this.loadCompactStyle(true);
		this.loadTweakStyle(true);
	},
	_compactStyleLoaded: false,
	loadCompactStyle: function(add) {
		if(!add ^ this._compactStyleLoaded)
			return;
		this._compactStyleLoaded = add;
		var cssURI = Services.io.newURI("chrome://downloadpaneltweaker/content/compactDownloads.css", null, null);
		this.loadSheet(cssURI, add);
		_log("loadCompactStyle(" + add + ")");
	},
	_tweakStyleLoaded: false,
	tweakCssURI: null,
	minPanelWidth: 5,
	minProgressBarHeight: 6,
	maxProgressBarHeight: 50,
	loadTweakStyle: function(add) {
		if(!add ^ this._tweakStyleLoaded)
			return;
		this._tweakStyleLoaded = add;
		var cssURI;
		if(add) {
			var panelWidth = Math.max(this.minPanelWidth, prefs.get("panelWidth", 60));
			var pbHeight = Math.max(this.minProgressBarHeight, Math.min(this.maxProgressBarHeight,
				prefs.get("progressBarHeight", 10)
			));
			var containerSelector = parseFloat(Services.appinfo.version) >= 20
				? ".downloadContainer"
				: "#downloadsListBox";
			var cssStr = '\
				/* Download Panel Tweaker: change some sizes */\n\
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n\
				@-moz-document url("chrome://browser/content/browser.xul"),\n\
					url("chrome://browser/content/places/places.xul") {\n\
					' + containerSelector + ' {\n\
						width: ' + panelWidth + 'ch !important;\n\
						min-width: 0 !important;\n\
					}\n\
					#downloadsSummaryDescription,\n\
					#downloadsSummaryDetails {\n\
						width: ' + panelWidth + 'ch !important;\n\
						min-width: 0 !important;\n\
					}\n\
					.downloadTarget {\n\
						min-width: 5ch !important;\n\
					}\n\
					.downloadProgress {\n\
						min-width: 20px !important;\n\
						min-height: ' + pbHeight + 'px !important;\n\
						height: ' + pbHeight + 'px !important;\n\
					}' + (
						prefs.get("decolorizePausedProgress")
						? '\n\
					/* Paused downloads */\n\
					.download-state[state="4"] .downloadProgress {\n\
						filter: url("chrome://mozapps/skin/extensions/extensions.svg#greyscale");\n\
					}\n\
					.download-state[state="4"] .downloadProgress > .progress-bar,\n\
					.download-state[state="4"] .downloadProgress > .progress-remainder {\n\
						opacity: 0.85;\n\
					}'
						: ""
					) + '\n\
				}';
			cssURI = this.tweakCssURI = Services.io.newURI(
				"data:text/css," + encodeURIComponent(cssStr), null, null
			);
		}
		else {
			cssURI = this.tweakCssURI;
		}
		this.loadSheet(cssURI, add);
		_log("loadTweakStyle(" + add + ")");
	},
	reloadTweakStyle: function() {
		this.loadTweakStyle(false);
		this.loadTweakStyle(true);
	},
	loadSheet: function(cssURI, load) {
		var sss = this.sss;
		if(!load ^ sss.sheetRegistered(cssURI, sss.USER_SHEET))
			return;
		if(load)
			sss.loadAndRegisterSheet(cssURI, sss.USER_SHEET);
		else
			sss.unregisterSheet(cssURI, sss.USER_SHEET);
	},

	minItemCountLimit: 1,
	_origItemCountLimit: undefined,
	setItemCountLimit: function(window, set) {
		var DownloadsView = window.DownloadsView;
		var DownloadsPanel = window.DownloadsPanel;
		var DownloadsCommon = window.DownloadsCommon;

		if(!this._origItemCountLimit)
			this._origItemCountLimit = DownloadsView.kItemCountLimit || 3;
		var itemCountLimit = set
			? Math.max(this.minItemCountLimit, prefs.get("itemCountLimit", 7))
			: this._origItemCountLimit;

		// https://gist.github.com/Infocatcher/5387328
		// resource://app/modules/DownloadsCommon.jsm, see getSummary() function
		if(DownloadsCommon._privateSummary)
			DownloadsCommon._privateSummary._numToExclude = itemCountLimit;
		if(DownloadsCommon._summary)
			DownloadsCommon._summary._numToExclude = itemCountLimit;
		// chrome://browser/content/downloads/downloads.js
		DownloadsView.kItemCountLimit = itemCountLimit;
		if(DownloadsPanel._state != DownloadsPanel.kStateUninitialized) {
			DownloadsView.onDataInvalidated(); // This calls DownloadsPanel.terminate();
			DownloadsPanel.initialize(function() {});
		}
		_log("setItemCountLimit(): " + itemCountLimit);
	},

	patchDownloads: function(window, patch, forceDestroy) {
		var dwip = window.DownloadsViewItem.prototype;
		if(patch) {
			var _this = this;
			patcher.wrapFunction(dwip, "_updateStatusLine", "DownloadsViewItem.prototype._updateStatusLine",
				function before() {},
				function after() {
					if(this.dataItem.state == Components.interfaces.nsIDownloadManager.DOWNLOAD_DOWNLOADING)
						_this.updateDownload(this._element, true);
				}
			);
		}
		else {
			patcher.unwrapFunction(dwip, "_updateStatusLine", "DownloadsViewItem.prototype._updateStatusLine", forceDestroy);
		}
		if(!forceDestroy)
			this.updateDownloads(window, patch);
		_log("patchDownloads(" + patch + ")");
	},
	updateDownloads: function(window, patch) {
		var document = window.document;
		var lb = document.getElementById("downloadsListBox");
		lb && Array.forEach(
			lb.getElementsByTagName("richlistitem"),
			function(item) {
				if(
					item.getAttribute("type") == "download"
					&& item.getAttribute("state") == "0" // Downloading
					&& item.hasAttribute("status")
					&& item.hasAttribute("statusTip")
				)
					this.updateDownload(item, patch);
			},
			this
		);
	},
	updateDownload: function(elt, patch) {
		var newStatus;
		if(patch) {
			var status = elt.getAttribute("status");
			var statusTip = elt.getAttribute("statusTip") || status;
			elt.setAttribute("downloadPanelTweaker_origStatus", status);
			newStatus = statusTip;
		}
		else {
			var origStatus = elt.getAttribute("downloadPanelTweaker_origStatus");
			elt.removeAttribute("downloadPanelTweaker_origStatus");
			if(!origStatus)
				return;
			newStatus = origStatus;
		}
		elt.setAttribute("status", newStatus);
	},

	prefChanged: function(pName, pVal) {
		if(pName == "compactDownloads")
			this.loadCompactStyle(pVal);
		else if(pName == "itemCountLimit") {
			if(pVal < this.minItemCountLimit) {
				prefs.set(pName, this.minItemCountLimit);
				return;
			}
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.setItemCountLimit(ws.getNext(), true);
		}
		else if(pName == "detailedText") {
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.patchDownloads(ws.getNext(), pVal);
		}
		else if(
			pName == "panelWidth"
			|| pName == "progressBarHeight"
			|| pName == "decolorizePausedProgress"
		) {
			if(pName == "panelWidth" && pVal < this.minPanelWidth) {
				prefs.set(pName, this.minPanelWidth);
				return;
			}
			if(pName == "progressBarHeight") {
				if(pVal < this.minProgressBarHeight) {
					prefs.set(pName, this.minProgressBarHeight);
					return;
				}
				else if(pVal > this.maxProgressBarHeight) {
					prefs.set(pName, this.maxProgressBarHeight);
					return;
				}
			}
			this.reloadTweakStyle();
		}
	}
};

var prefs = {
	ns: "extensions.downloadPanelTweaker.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		//~ todo: add condition when https://bugzilla.mozilla.org/show_bug.cgi?id=564675 will be fixed
		this.loadDefaultPrefs();
		Services.prefs.addObserver(this.ns, this, false);
	},
	destroy: function() {
		if(!this.initialized)
			return;
		this.initialized = false;

		Services.prefs.removeObserver(this.ns, this);
	},
	observe: function(subject, topic, pName) {
		if(topic != "nsPref:changed")
			return;
		var shortName = pName.substr(this.ns.length);
		var val = this.getPref(pName);
		this._cache[shortName] = val;
		dpTweaker.prefChanged(shortName, val);
	},

	loadDefaultPrefs: function() {
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var prefsFile = "chrome://downloadpaneltweaker/content/defaults/preferences/prefs.js";
		var prefs = this;
		Services.scriptloader.loadSubScript(prefsFile, {
			pref: function(pName, val) {
				prefs.setPref(pName, val, defaultBranch);
			}
		});
	},

	_cache: { __proto__: null },
	get: function(pName, defaultVal) {
		return pName in this._cache
			? this._cache[pName]
			: (this._cache[pName] = this.getPref(this.ns + pName, defaultVal));
	},
	set: function(pName, val) {
		return this.setPref(this.ns + pName, val);
	},
	getPref: function(pName, defaultVal, prefBranch) {
		var ps = prefBranch || Services.prefs;
		switch(ps.getPrefType(pName)) {
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			default:             return defaultVal;
		}
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || Services.prefs;
		var pType = ps.getPrefType(pName);
		var isNew = pType == ps.PREF_INVALID;
		var vType = typeof val;
		if(pType == ps.PREF_BOOL || isNew && vType == "boolean")
			ps.setBoolPref(pName, val);
		else if(pType == ps.PREF_INT || isNew && vType == "number")
			ps.setIntPref(pName, val);
		else if(pType == ps.PREF_STRING || isNew) {
			var ss = Components.interfaces.nsISupportsString;
			var str = Components.classes["@mozilla.org/supports-string;1"]
				.createInstance(ss);
			str.data = val;
			ps.setComplexValue(pName, ss, str);
		}
		return this;
	}
};

// Be careful, loggers always works until prefs aren't initialized
// (and if "debug" preference has default value)
function ts() {
	var d = new Date();
	var ms = d.getMilliseconds();
	return d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms + " ";
}
function _log(s) {
	if(!prefs.get("debug", true))
		return;
	var msg = LOG_PREFIX + ts() + s;
	Services.console.logStringMessage(msg);
	dump(msg + "\n");
}