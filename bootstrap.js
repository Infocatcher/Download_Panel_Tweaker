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
			this.loadStyles(true);
		Services.ww.registerNotification(this);

		_log("Successfully started");
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		if(reason != APP_SHUTDOWN) {
			this.loadStyles(false);
			if(prefs.get("showDownloadRate"))
				this.showDownloadRate(false);
			if(prefs.get("decolorizePausedProgress"))
				this.showPausedDownloadsSummary(false);
			if(prefs.get("dontRemoveFinishedDownloads"))
				this.dontRemoveFinishedDownloads(false);
		}

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.destroyWindow(ws.getNext(), reason);
		Services.ww.unregisterNotification(this);

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
		else if(e.type == "command") {
			this.overrideDownloadsCommand(e);
		}
	},

	initWindow: function(window, reason) {
		if(reason == WINDOW_LOADED && this.isLibraryWindow(window)) {
			this.loadStyles(true);
			return;
		}
		if(reason == WINDOW_LOADED && !this.isTargetWindow(window))
			return;
		if(prefs.get("useDownloadsHotkeyToTogglePanel"))
			window.addEventListener("command", this, true);
		window.setTimeout(function() {
			this.setItemCountLimit(window, true);
			var needUpdate = reason != WINDOW_LOADED;
			var document = window.document;
			if(prefs.get("showDownloadRate")) {
				this.showDownloadRate(true);
				needUpdate && this.udateDownloadRate(document, true);
			}
			if(prefs.get("decolorizePausedProgress")) {
				this.showPausedDownloadsSummary(true);
				needUpdate && this.updateDownloadsSummary(document, true);
			}
			if(prefs.get("dontRemoveFinishedDownloads"))
				this.dontRemoveFinishedDownloads(true);
		}.bind(this), 0);
		if(prefs.get("fixWrongTabsOnTopAttribute")) window.setTimeout(function() {
			this.setFixToolbox(window, true);
		}.bind(this), 0);
		window.setTimeout(function() {
			this.loadStyles(true);
		}.bind(this), 50);
	},
	destroyWindow: function(window, reason) {
		window.removeEventListener("load", this, false); // Window can be closed before "load"
		if(reason == WINDOW_CLOSED && !this.isTargetWindow(window))
			return;
		if(prefs.get("useDownloadsHotkeyToTogglePanel"))
			window.removeEventListener("command", this, true);
		if(reason != WINDOW_CLOSED && reason != APP_SHUTDOWN) {
			this.setItemCountLimit(window, false);
			var document = window.document;
			if(prefs.get("showDownloadRate"))
				this.udateDownloadRate(document, false);
			if(prefs.get("decolorizePausedProgress"))
				this.updateDownloadsSummary(document, false);
		}
		if(prefs.get("fixWrongTabsOnTopAttribute"))
			this.setFixToolbox(window, false);
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
	loadStyles: function(add) {
		this.loadCompactStyle(add ? prefs.get("compactDownloads") : 0);
		this.loadTweakStyle(add);
	},
	_compactStyleLoaded: false,
	_forceCompactStyleLoaded: false,
	loadCompactStyle: function(compact) {
		var loadCompact = compact == 1;
		if(loadCompact != this._compactStyleLoaded) {
			this._compactStyleLoaded = loadCompact;
			this.loadSheet(
				Services.io.newURI("chrome://downloadpaneltweaker/content/compactDownloads.css", null, null),
				loadCompact
			);
			_log((loadCompact ? "Load" : "Unload") + " compactDownloads.css");
		}
		var loadForceCompact = compact == 2;
		if(loadForceCompact != this._forceCompactStyleLoaded) {
			this._forceCompactStyleLoaded = loadForceCompact;
			this.loadSheet(
				Services.io.newURI("chrome://downloadpaneltweaker/content/compactDownloadsForce.css", null, null),
				loadForceCompact
			);
			_log((loadForceCompact ? "Load" : "Unload") + " compactDownloadsForce.css");
		}
	},
	_tweakStyleLoaded: false,
	tweakCssURI: null,
	minPanelWidth: 5,
	minProgressBarHeight: 6,
	maxProgressBarHeight: 50,
	pausedAttr: "downloadPanelTweaker_paused",
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
				: ".download-state > vbox";
			var cssStr = '\
				/* Download Panel Tweaker */\n\
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n\
				@-moz-document url("chrome://browser/content/browser.xul"),\n\
					url("chrome://browser/content/places/places.xul"),\n\
					url("about:downloads"),\n\
					url("chrome://browser/content/downloads/contentAreaDownloadsView.xul") {\n\
					#downloadsListBox { /* Firefox < 20 or NASA Night Launch theme */\n\
						width: auto !important;\n\
						min-width: 0 !important;\n\
						max-width: none !important;\n\
					}\n\
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
					}\n\
					.downloadProgress > .progress-bar {\n\
						height: auto !important;\n\
						min-height: 2px !important;\n\
						max-height: ' + pbHeight + 'px !important;\n\
					}' + (
						prefs.get("decolorizePausedProgress")
						? '\n\
					/* Paused downloads */\n\
					.download-state[state="4"] .downloadProgress,\n\
					#downloadsSummary[' + this.pausedAttr + '] .downloadProgress {\n\
						filter: url("chrome://mozapps/skin/extensions/extensions.svg#greyscale");\n\
					}\n\
					.download-state[state="4"] .downloadProgress > .progress-bar,\n\
					.download-state[state="4"] .downloadProgress > .progress-remainder,\n\
					#downloadsSummary[' + this.pausedAttr + '] .downloadProgress > .progress-bar,\n\
					#downloadsSummary[' + this.pausedAttr + '] .downloadProgress > .progress-remainder {\n\
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
	_reloadTweakStyleTimer: null,
	reloadTweakStyleProxy: function() {
		var timer = this._reloadTweakStyleTimer;
		if(timer)
			timer.cancel();
		else {
			timer = this._reloadTweakStyleTimer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
		}
		timer.init(function() {
			this._reloadTweakStyleTimer = null;
			this.reloadTweakStyle();
		}.bind(this), 300, timer.TYPE_ONE_SHOT);
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
		_log("DownloadsCommon loaded: " + !Object.getOwnPropertyDescriptor(window, "DownloadsCommon").get);
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

	showDownloadRate: function(patch) {
		var {DownloadUtils} = Components.utils.import("resource://gre/modules/DownloadUtils.jsm", {});
		const bakKey = "_downloadPanelTweaker_getDownloadStatusNoRate";
		if(!patch ^ bakKey in DownloadUtils)
			return;
		if(patch) {
			DownloadUtils[bakKey] = DownloadUtils.getDownloadStatusNoRate;
			DownloadUtils.getDownloadStatusNoRate = DownloadUtils.getDownloadStatus;
		}
		else {
			DownloadUtils.getDownloadStatusNoRate = DownloadUtils[bakKey];
			delete DownloadUtils[bakKey];
		}
		_log("showDownloadRate(" + patch + ")");
	},
	udateDownloadRate: function(document, patch) {
		if(!patch)
			return; // Not implemented
		_log("udateDownloadRate(" + patch + ")");
		var lb = document.getElementById("downloadsListBox");
		lb && Array.forEach(
			lb.getElementsByTagName("richlistitem"),
			function(item) {
				if(
					item.getAttribute("type") == "download"
					&& item.getAttribute("state") == "0" // Downloading
					&& item.hasAttribute("status")
					&& item.hasAttribute("statusTip")
				) {
					var statusTip = item.getAttribute("statusTip");
					statusTip && item.setAttribute("status", statusTip);
				}
			}
		);
		var details = document.getElementById("downloadsSummaryDetails");
		if(details) {
			var tip = details.getAttribute("tooltiptext");
			tip && details.setAttribute("value", tip);
		}
	},

	_downloadsSummaryPatched: false,
	showPausedDownloadsSummary: function(patch) {
		if(!patch ^ this._downloadsSummaryPatched)
			return;
		this._downloadsSummaryPatched = patch;

		var {DownloadsSummaryData} = Components.utils.import("resource://app/modules/DownloadsCommon.jsm", {});
		if(patch) {
			var _this = this;
			patcher.wrapFunction(DownloadsSummaryData.prototype, "_updateView", "DownloadsSummaryData.prototype._updateView",
				function before() {},
				function after(ret, aView) {
					_this.updateDownloadsSummary(aView._summaryNode, true);
				}
			);
		}
		else {
			patcher.unwrapFunction(DownloadsSummaryData.prototype, "_updateView", "DownloadsSummaryData.prototype._updateView");
		}
		_log("showPausedDownloadsSummary(" + patch + ")");
	},
	updateDownloadsSummary: function(summaryNode, patch) {
		if(summaryNode && summaryNode instanceof Components.interfaces.nsIDOMDocument)
			summaryNode = summaryNode.getElementById("downloadsSummary");
		if(!summaryNode)
			return;
		if(!patch) {
			_log("updateDownloadsSummary(): Restore");
			summaryNode.removeAttribute(this.pausedAttr);
			return;
		}
		var progress = summaryNode.getElementsByAttribute("id", "downloadsSummaryProgress")[0];
		if(progress) {
			// Round off "value", but don't dispatch "ValueChange" event, for styles like
			// https://github.com/Infocatcher/UserStyles/blob/master/Download_percentage
			var val = progress.value;
			if(val.indexOf(".") != -1)
				progress.setAttribute("value", Math.round(val));
		}
		var details = summaryNode.getElementsByAttribute("id", "downloadsSummaryDetails")[0];
		if(details) {
			var paused = !details.getAttribute("value");
			if(!paused ^ summaryNode.hasAttribute(this.pausedAttr))
				return;
			_log("updateDownloadsSummary(): Paused: " + paused);
			if(paused)
				summaryNode.setAttribute(this.pausedAttr, "true");
			else
				summaryNode.removeAttribute(this.pausedAttr);
		}
	},

	dontRemoveFinishedDownloads: function(patch) {
		const bakKey = "_downloadPanelTweaker_downloads";
		if(!patch ^ bakKey in Services)
			return;
		if(patch) {
			var downloads = Services[bakKey] = Services.downloads;
			Services.downloads = {
				__proto__: Services.downloads,
				cleanUp: function downloadPanelTweakerWrapper() {
					var stack = new Error().stack;
					_log("Services.downloads.cleanUp()\n" + stack);
					if(
						stack.indexOf("@resource://app/components/DownloadsStartup.js:") != -1
						|| stack.indexOf("@resource://gre/components/DownloadsStartup.js:") != -1 // Firefox 20 and older
					) {
						_log("Prevent Services.downloads.cleanUp()");
						return undefined;
					}
					return downloads.cleanUp.apply(downloads, arguments);
				}
			};
		}
		else {
			Services.downloads = Services[bakKey];
			delete Services[bakKey];
		}
		_log("dontRemoveFinishedDownloads(" + patch + ")");
	},

	overrideDownloadsCommand: function(e) {
		if(e.target.id != "Tools:Downloads")
			return;
		if(e.sourceEvent && e.sourceEvent.target.nodeName != "key")
			return;
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		var window = e.currentTarget;
		this.toggleDownloadPanel(window);
	},
	toggleDownloadPanel: function(window) {
		var DownloadsPanel = window.DownloadsPanel;
		if(DownloadsPanel.isPanelShowing)
			DownloadsPanel.hidePanel();
		else
			DownloadsPanel.showPanel();
	},

	setFixToolbox: function(window, enable) {
		var document = window.document;
		var tb = document.getElementById("navigator-toolbox");
		if(enable) {
			if(
				!tb.hasAttribute("tabsontop")
				|| !document.documentElement.hasAttribute("tabsontop")
			) {
				_log('setFixToolbox(): nothing to do, "tabsontop" attribute not found');
				return;
			}

			var mo = new window.MutationObserver(this.handleMutationsFixed);
			mo.observe(tb, {
				attributes: true,
				attributeFilter: ["tabsontop"]
			});
			tb._downloadPanelTweakerMutationObserver = mo;
			this.fixToolbox(tb);
		}
		else if("_downloadPanelTweakerMutationObserver" in tb) {
			tb._downloadPanelTweakerMutationObserver.disconnect();
			delete tb._downloadPanelTweakerMutationObserver;
			if(tb.hasAttribute("_downloadPanelTweaker_tabsontop")) {
				tb.setAttribute("tabsontop", tb.getAttribute("_downloadPanelTweaker_tabsontop"));
				tb.removeAttribute("_downloadPanelTweaker_tabsontop")
			}
		}
	},
	get handleMutationsFixed() {
		delete this.handleMutationsFixed;
		return this.handleMutationsFixed = this.handleMutations.bind(this);
	},
	handleMutations: function(mutations) {
		var tb = mutations[0].target;
		this.fixToolbox(tb);
	},
	fixToolbox: function(tb) {
		var root = tb.ownerDocument.documentElement;
		var tt = tb.getAttribute("tabsontop");
		var ttRoot = root.getAttribute("tabsontop");
		if(tt && ttRoot && ttRoot != tt) {
			tb.setAttribute("_downloadPanelTweaker_tabsontop", tt);
			tb.setAttribute("tabsontop", ttRoot);
			_log("fixToolbox(): override \"tabsontop\" on #navigator-toolbox: " + tt + " => " + ttRoot);
		}
	},

	prefChanged: function(pName, pVal) {
		if(pName == "compactDownloads")
			this.loadCompactStyle(pVal);
		else if(pName == "showDownloadRate") {
			this.showDownloadRate(pVal);
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.udateDownloadRate(ws.getNext().document, pVal);
		}
		else if(pName == "itemCountLimit") {
			if(this.wrongPref(pName, pVal, this.minItemCountLimit, 10e3))
				return;
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.setItemCountLimit(ws.getNext(), true);
		}
		else if(
			pName == "panelWidth"
			|| pName == "progressBarHeight"
			|| pName == "decolorizePausedProgress"
		) {
			if(
				pName == "panelWidth"
					&& this.wrongPref(pName, pVal, this.minPanelWidth, 10e3)
				|| pName == "progressBarHeight"
					&& this.wrongPref(pName, pVal, this.minProgressBarHeight, this.maxProgressBarHeight)
			)
				return;
			if(pName == "decolorizePausedProgress") {
				this.showPausedDownloadsSummary(pVal);
				var ws = Services.wm.getEnumerator("navigator:browser");
				while(ws.hasMoreElements())
					this.updateDownloadsSummary(ws.getNext().document, pVal);
			}
			this.reloadTweakStyleProxy();
		}
		else if(pName == "useDownloadsHotkeyToTogglePanel") {
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements()) {
				var window = ws.getNext();
				if(pVal)
					window.addEventListener("command", this, true);
				else
					window.removeEventListener("command", this, true);
			}
		}
		else if(pName == "dontRemoveFinishedDownloads")
			this.dontRemoveFinishedDownloads(pVal);
		else if(pName == "fixWrongTabsOnTopAttribute") {
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.setFixToolbox(ws.getNext(), pVal);
		}
	},
	_wrongPrefTimer: null,
	wrongPref: function(pName, pVal, min, max) {
		var timer = this._wrongPrefTimer;
		timer && timer.cancel();

		var corrected;
		if(pVal > max)
			corrected = max;
		else if(pVal < min)
			corrected = min;
		else
			return false;

		if(!timer) {
			timer = this._wrongPrefTimer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
		}
		timer.init(function() {
			this._wrongPrefTimer = null;
			prefs.set(pName, corrected);
		}.bind(this), 500, timer.TYPE_ONE_SHOT);
		return true;
	}
};

var prefs = {
	ns: "extensions.downloadPanelTweaker.",
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		this.migratePrefs();
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

	migratePrefs: function() {
		var compactPref = this.ns + "compactDownloads";
		var compact = this.getPref(compactPref);
		if(typeof compact == "boolean") {
			Services.prefs.deleteBranch(compactPref);
			if(compact === false)
				this.setPref(compactPref, 0);
		}
	},
	loadDefaultPrefs: function() {
		var defaultBranch = Services.prefs.getDefaultBranch("");
		var prefsFile = "chrome://downloadpaneltweaker/content/defaults/preferences/prefs.js";
		var prefs = this;
		Services.scriptloader.loadSubScript(prefsFile, {
			pref: function(pName, val) {
				var pType = defaultBranch.getPrefType(pName);
				if(pType != defaultBranch.PREF_INVALID && pType != prefs.getValueType(val)) {
					Components.utils.reportError(
						LOG_PREFIX + 'Changed preference type for "' + pName
						+ '", old value will be lost!'
					);
					defaultBranch.deleteBranch(pName);
				}
				prefs.setPref(pName, val, defaultBranch);
			}
		});
	},

	_cache: { __proto__: null },
	get: function(pName, defaultVal) {
		var cache = this._cache;
		return pName in cache
			? cache[pName]
			: (cache[pName] = this.getPref(this.ns + pName, defaultVal));
	},
	set: function(pName, val) {
		return this.setPref(this.ns + pName, val);
	},
	getPref: function(pName, defaultVal, prefBranch) {
		var ps = prefBranch || Services.prefs;
		switch(ps.getPrefType(pName)) {
			case ps.PREF_BOOL:   return ps.getBoolPref(pName);
			case ps.PREF_INT:    return ps.getIntPref(pName);
			case ps.PREF_STRING: return ps.getComplexValue(pName, Components.interfaces.nsISupportsString).data;
		}
		return defaultVal;
	},
	setPref: function(pName, val, prefBranch) {
		var ps = prefBranch || Services.prefs;
		var pType = ps.getPrefType(pName);
		if(pType == ps.PREF_INVALID)
			pType = this.getValueType(val);
		switch(pType) {
			case ps.PREF_BOOL:   ps.setBoolPref(pName, val); break;
			case ps.PREF_INT:    ps.setIntPref(pName, val);  break;
			case ps.PREF_STRING:
				var ss = Components.interfaces.nsISupportsString;
				var str = Components.classes["@mozilla.org/supports-string;1"]
					.createInstance(ss);
				str.data = val;
				ps.setComplexValue(pName, ss, str);
		}
		return this;
	},
	getValueType: function(val) {
		switch(typeof val) {
			case "boolean": return Services.prefs.PREF_BOOL;
			case "number":  return Services.prefs.PREF_INT;
		}
		return Services.prefs.PREF_STRING;
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