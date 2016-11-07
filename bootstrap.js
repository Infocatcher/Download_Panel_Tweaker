const WINDOW_LOADED = -1;
const WINDOW_CLOSED = -2;

const LOG_PREFIX = "[Download Panel Tweaker] ";

var global = this;
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
		_dbg = prefs.get("debug", false);
		_dbgv = prefs.get("debug.verbose", false);

		for(var window of this.windows)
			this.initWindow(window, reason);
		if(!this._tweakStyleLoaded && Services.wm.getMostRecentWindow("Places:Organizer"))
			this.stl.loadStyles(true);
		Services.ww.registerNotification(this);

		delay(function() {
			if(!prefs.get("dontRemoveFinishedDownloads"))
				return;
			// We can't apply this patch after "domwindowopened" + delay at least in Firefox 27
			if(prefs.get("fixDownloadsLoading"))
				this.de.fixLoadDownloads(true);
			if(reason == APP_STARTUP)
				this.de.suppressNotifications();
		}, this);

		_log("Successfully started");
	},
	destroy: function(reason) {
		if(!this.initialized)
			return;
		this.initialized = false;

		if(reason != APP_SHUTDOWN) {
			this.stl.loadStyles(false);
			if(prefs.get("showDownloadRate"))
				this.showDownloadRate(false);
			if(prefs.get("decolorizePausedProgress"))
				this.showPausedDownloadsSummary(false);
			if(prefs.get("dontRemoveFinishedDownloads")) {
				this.de.dontRemoveFinishedDownloads(false);
				if(prefs.get("fixDownloadsLoading"))
					this.de.fixLoadDownloads(false);
			}
		}
		else if(
			prefs.get("dontRemoveFinishedDownloads")
			&& prefs.get("cleanupDownloadsOnShutdown")
		) {
			// Force save downloads.json to perform cleanup: due to optimizations (or bugs?)
			// this may not happens after removing of "session" downloads
			// Note: windows aren't closed yet, will wait for better performance
			Services.obs.addObserver(function observer(subject, topic, data) {
				// Following doesn't work (NS_ERROR_FAILURE) and isn't really needed on shutdown
				//Services.obs.removeObserver(observer, topic);
				this.de.saveDownloads();
			}.bind(this), "profile-change-teardown", false);
		}

		for(var window of this.windows)
			this.destroyWindow(window, reason);
		Services.ww.unregisterNotification(this);

		prefs.destroy();
		if(patcherLoaded) {
			patcher.destroy();
			Components.utils.unload("chrome://downloadpaneltweaker/content/patcher.jsm");
		}
		if("downloadsStyles" in global)
			this.stl.dpt = null;
		if("downloadsEnhancements" in global)
			this.de.dpt = null;
		if("downloadsActions" in global)
			this.da.dpt = null;
		if("downloadsPanel" in global)
			this.dp.dpt = null;
		if("downloadsButton" in global)
			this.btn.dpt = null;
		_log("Successfully destroyed");
	},

	observe: function(subject, topic, data) {
		if(topic == "domwindowopened")
			subject.addEventListener("load", this, false);
		else if(topic == "domwindowclosed")
			this.destroyWindow(subject, WINDOW_CLOSED);
	},
	handleEvent: function(e) {
		switch(e.type) {
			case "load":
				var window = e.currentTarget;
				window.removeEventListener("load", this, false);
				this.initWindow(window, WINDOW_LOADED);
			break;
			case "command":      this.handleCommand(e);   break;
			case "click":        this.handleClick(e);     break;
			case "popupshowing": this.popupShowingHandler(e);
		}
	},

	initWindow: function(window, reason) {
		if(reason == WINDOW_LOADED && this.isLibraryWindow(window)) {
			this.stl.loadStyles(true);
			return;
		}
		if(reason == WINDOW_LOADED && !this.isTargetWindow(window))
			return;
		if(this.handleCommandEvent)
			window.addEventListener("command", this, true);
		if(this.handleClickEvent)
			window.addEventListener("click", this, true);
		window.addEventListener("popupshowing", this, false);
		window.setTimeout(function() {
			if(this.enableDlButtonTweaks) window.setTimeout(function() {
				this.btn.tweakDlButton(window, true);
			}.bind(this), 0);
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
		}.bind(this), 10);
		window.setTimeout(function() {
			if(prefs.get("dontRemoveFinishedDownloads"))
				this.de.dontRemoveFinishedDownloads(true);
			if(prefs.get("fixWrongTabsOnTopAttribute"))
				this.setFixToolbox(window, true);
		}.bind(this), 15);
		window.setTimeout(function() {
			this.stl.loadStyles(true);
		}.bind(this), 50);
	},
	destroyWindow: function(window, reason) {
		var document = window.document;
		window.removeEventListener("load", this, false); // Window can be closed before "load"
		if(reason == WINDOW_CLOSED && !this.isTargetWindow(window))
			return;
		if(this.handleCommandEvent)
			window.removeEventListener("command", this, true);
		if(this.handleClickEvent)
			window.removeEventListener("click", this, true);
		window.removeEventListener("popupshowing", this, false);
		var force = reason != WINDOW_CLOSED && reason != APP_SHUTDOWN;
		if("downloadsPanel" in global)
			this.dp.destroyPanel(document, force);
		if(force) {
			this.setItemCountLimit(window, false);
			if(prefs.get("showDownloadRate"))
				this.udateDownloadRate(document, false);
			if(prefs.get("decolorizePausedProgress"))
				this.updateDownloadsSummary(document, false);
		}
		if(prefs.get("fixWrongTabsOnTopAttribute"))
			this.setFixToolbox(window, false, force);
		if(this.enableDlButtonTweaks)
			this.btn.tweakDlButton(window, false, force);
	},
	isTargetWindow: function(window) {
		return window.document.documentElement.getAttribute("windowtype") == "navigator:browser";
	},
	isLibraryWindow: function(window) {
		return window.document.documentElement.getAttribute("windowtype") == "Places:Organizer";
	},
	get windows() {
		var windows = [];
		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			windows.push(ws.getNext());
		return windows;
	},

	get stl() { return this.lazy("stl", "downloadsStyles");       },
	get de()  { return this.lazy("de",  "downloadsEnhancements"); },
	get da()  { return this.lazy("da",  "downloadsActions");      },
	get dp()  { return this.lazy("dp",  "downloadsPanel");        },
	get btn() { return this.lazy("btn", "downloadsButton");       },
	lazy: function(prop, name) {
		_log("Load " + name + ".js" + (_dbgv ? "\n" + new Error().stack : ""));
		Services.scriptloader.loadSubScript("chrome://downloadpaneltweaker/content/" + name + ".js", global, "UTF-8");
		delete this[prop];
		return this[prop] = global[name];
	},
	get fxVersion() {
		delete this.fxVersion;
		return this.fxVersion = parseFloat(Services.appinfo.version);
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
		// resource:///modules/DownloadsCommon.jsm, see getSummary() function
		if(DownloadsCommon._privateSummary)
			DownloadsCommon._privateSummary._numToExclude = itemCountLimit;
		if(DownloadsCommon._summary)
			DownloadsCommon._summary._numToExclude = itemCountLimit;
		// chrome://browser/content/downloads/downloads.js
		DownloadsView.kItemCountLimit = itemCountLimit;
		if(DownloadsPanel._state != DownloadsPanel.kStateUninitialized) {
			if("onDataInvalidated" in DownloadsView)
				DownloadsView.onDataInvalidated(); // This calls DownloadsPanel.terminate();
			else { // Firefox 28.0a1+
				// Based on code from chrome://browser/content/downloads/downloads.js in Firefox 25.0
				DownloadsPanel.terminate();
				DownloadsView.richListBox.textContent = "";
				// We can't use {} and [] here because of memory leaks!
				if("_downloads" in DownloadsView) // Firefox 38+
					DownloadsView._downloads = new window.Array();
				else {
					DownloadsView._viewItems = new window.Object();
					DownloadsView._dataItems = new window.Array();
				}
			}
			DownloadsPanel.initialize(function() {});
		}
		_log("setItemCountLimit(): " + itemCountLimit);
	},

	showDownloadRate: function(patch) {
		var {DownloadUtils} = Components.utils.import("resource://gre/modules/DownloadUtils.jsm", {});
		const bakKey = "_downloadPanelTweaker_getDownloadStatusNoRate";
		if(patch == bakKey in DownloadUtils)
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

	pausedAttr: "downloadPanelTweaker_paused",
	_downloadsSummaryPatched: false,
	showPausedDownloadsSummary: function(patch) {
		if(patch == this._downloadsSummaryPatched)
			return;
		this._downloadsSummaryPatched = patch;

		var {DownloadsSummaryData} = Components.utils.import("resource:///modules/DownloadsCommon.jsm", {});
		if(
			!DownloadsSummaryData
			|| !DownloadsSummaryData.prototype
			|| !("_updateView" in DownloadsSummaryData.prototype)
		) {
			_log("Can't patch DownloadsSummaryData.prototype._updateView(), method not found");
			return;
		}
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
			if(val && val.indexOf(".") != -1)
				progress.setAttribute("value", Math.round(val));
		}
		var details = summaryNode.getElementsByAttribute("id", "downloadsSummaryDetails")[0];
		if(details) {
			var paused = !details.getAttribute("value");
			if(paused == summaryNode.hasAttribute(this.pausedAttr))
				return;
			_log("updateDownloadsSummary(): Paused: " + paused);
			if(paused)
				summaryNode.setAttribute(this.pausedAttr, "true");
			else
				summaryNode.removeAttribute(this.pausedAttr);
		}
	},

	get handleCommandEvent() {
		return [
			"overrideDownloadsCommand",
			"overrideDownloadsHotkey",
			"overrideShowAllDownloads"
		].some(function(pName) {
			return prefs.get(pName)
				|| prefs.get(pName + ".private");
		})
		|| prefs.get("reopenPanel.openContainingFolder");
	},
	get handleClickEvent() {
		return !!(
			prefs.get("overrideDownloadsCommand")
			|| prefs.get("overrideDownloadsCommand.private")
		);
	},
	handleCommand: function(e) {
		var curTrg = e.currentTarget;
		var trg = e.target;
		var origTrg = e.originalTarget;
		if(curTrg.getAttribute && curTrg.hasAttribute("downloadPanelTweaker-command")) {
			var cmd = curTrg.getAttribute("downloadPanelTweaker-command");
			if(cmd == "clearDownloads")
				this.da.clearDownloads(trg);
			else if(cmd == "copyReferrer")
				this.da.copyReferrer(trg);
			else if(cmd == "removeFile")
				this.da.removeFile(trg);
		}
		else if(trg.id == "Tools:Downloads") {
			if(e.sourceEvent && e.sourceEvent.target.nodeName != "key")
				this.downloadCommand(e, "overrideDownloadsCommand");
			else
				this.downloadCommand(e, "overrideDownloadsHotkey");
		}
		else if(origTrg.id == "downloadsHistory")
			this.downloadCommand(e, "overrideShowAllDownloads");
		else if(trg.id == "downloadsCmd_show") {
			if(prefs.get("reopenPanel.openContainingFolder")) {
				_log(e.type + " #" + trg.id + " => reopenPanel()");
				this.dp.reopenPanel(e.view);
			}
		}
	},
	handleClick: function(e) {
		var trg = e.originalTarget || e.target;
		if(
			trg.ownerDocument
			&& trg.ownerDocument.documentURI == "about:home"
			&& trg.id == "downloads"
		)
			this.downloadCommand(e, "overrideDownloadsCommand");
		else if(
			trg.localName == "browser"
			&& trg.getAttribute("remote") == "true"
			&& trg.currentURI.spec == "about:home"
		) {
			var window = e.currentTarget;
			var origBrowserDownloadsUI = window.BrowserDownloadsUI;
			if(origBrowserDownloadsUI.name == "dpTweakerWrapper")
				return;

			var unwrap = function() {
				window.BrowserDownloadsUI = origBrowserDownloadsUI;
			};
			var _this = this;
			window.BrowserDownloadsUI = function dpTweakerWrapper() {
				_log(e.type + " -> BrowserDownloadsUI() => downloadCommand()");
				unwrap();
				// Note: we can't use event here, at least e.currentTarget is broken after delay
				_this.downloadCommand(window, "overrideDownloadsCommand");
			};
			window.setTimeout(unwrap, 50);
		}
	},
	downloadCommand: function(e, prefName) {
		var window = e.currentTarget || e;
		if(e instanceof Components.interfaces.nsIDOMWindow)
			e = null;
		if(this.isPrivateContent(window))
			prefName += ".private";
		var cmd = prefs.get(prefName);
		if(!cmd)
			return;
		var ok;
		switch(cmd) {
			case 1: ok = this.da.toggleDownloadPanel(window);    break;
			case 2: ok = this.da.showDownloadWindow(window);     break;
			case 3: ok = this.da.openDownloadsTab(window);       break;
			case 4: ok = this.da.openDownloadsLibrary(window);   break;
			case 5: ok = this.da.toggleDownloadsSidebar(window); break;
			default: return;
		}
		if(ok == false)
			return;
		_log("downloadCommand(): " + prefName + " = " + cmd);
		e && this.stopEvent(e);
	},
	isPrivateContent: function(window) {
		return this.isPrivateTab(window.gBrowser.selectedTab);
	},
	isPrivateTab: function(tab) {
		var window = tab.ownerDocument.defaultView;
		if(!("PrivateBrowsingUtils" in window))
			return false;
		var browser = tab.linkedBrowser;
		// Try directly check state of content window, may fail in e10s mode
		var contentWindow = browser.contentWindow;
		if(contentWindow) try {
			return window.PrivateBrowsingUtils.isWindowPrivate(contentWindow);
		}
		catch(e) {
		}
		// Installed Private Tab?
		// https://github.com/Infocatcher/Private_Tab#privatetabistabprivate
		if("privateTab" in window) try {
			return window.privateTab.isTabPrivate(tab);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		// Fallback to check state of browser window itself
		try {
			return window.PrivateBrowsingUtils.isWindowPrivate(window);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		return false;
	},

	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	},
	dispatchAPIEvent: function(window, type) {
		var evt = window.document.createEvent("Events");
		evt.initEvent("DownloadPanelTweaker:" + type, true, true);
		return window.dispatchEvent(evt);
	},

	popupShowingHandler: function(e) {
		var popup = e.target;
		if(popup.id != "downloadsPanel")
			return;
		var window = e.currentTarget;
		window.removeEventListener("popupshowing", this, false);
		window.setTimeout(function() {
			this.dp.initPanel(window.document, popup);
		}.bind(this), 0);
		if(this.fxVersion >= 52) {
			var mv = popup.getElementsByAttribute("id", "downloadsPanel-multiView")[0];
			mv && mv.setAttribute("downloadPanelTweaker_newList", "true");
		}
	},

	setFixToolbox: function(window, enable, force) {
		var document = window.document;
		var tb = document.getElementById("navigator-toolbox");
		var key = "_downloadPanelTweaker_mutationObserverTabsOnTop";
		if(enable == key in tb)
			return;
		_log("setFixToolbox(" + enable + ")");
		if(enable) {
			if(
				!tb.hasAttribute("tabsontop")
				|| !document.documentElement.hasAttribute("tabsontop")
			) {
				_log('setFixToolbox(): nothing to do, "tabsontop" attribute not found');
				return;
			}

			var mo = tb[key] = new window.MutationObserver(this.onTabsOnTopChanged);
			mo.observe(tb, {
				attributes: true,
				attributeFilter: ["tabsontop"]
			});
			this.fixToolbox(tb);
		}
		else {
			var mo = tb[key];
			delete tb[key];
			mo.disconnect();
			if(force && tb.hasAttribute("_downloadPanelTweaker_tabsontop")) {
				tb.setAttribute("tabsontop", tb.getAttribute("_downloadPanelTweaker_tabsontop"));
				tb.removeAttribute("_downloadPanelTweaker_tabsontop")
			}
		}
	},
	get onTabsOnTopChanged() {
		delete this.onTabsOnTopChanged;
		return this.onTabsOnTopChanged = function(mutations) {
			var tb = mutations[0].target;
			this.fixToolbox(tb);
		}.bind(this);
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

	get enableDlButtonTweaks() {
		return prefs.get("dontHighlightButton")
			|| prefs.get("menuButtonBehavior");
	},

	getEntity: function(dtds, name, dafaultVal) {
		var out = {};
		out[name] = dafaultVal;
		this.getEntities(dtds, out);
		return out[name];
	},
	getEntities: function(dtds, names) {
		var dtdData = dtds.map(function(dtd, i) {
			return '<!ENTITY % dtd' + i + ' SYSTEM "' + dtd + '"> %dtd' + i + ';';
		}).join("\n");
		var attrs = [];
		for(var name in names)
			attrs.push(name + '="&' + name + ';"');
		var attrsData = attrs.join(" ");
		try {
			var xul = '<?xml version="1.0"?>\n\
				<!DOCTYPE label [\n' + dtdData + '\n\
				]>\n\
				<label ' + attrsData + ' />';
			var node = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Components.interfaces.nsIDOMParser)
				.parseFromString(xul, "application/xml")
				.documentElement;
			if(node.localName == "label") {
				for(var name in names)
					names[name] = node.getAttribute(name) || names[name];
				return true;
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		_log("getEntities(): will use English strings: " + JSON.stringify(names));
		return false;
	},

	prefChanged: function(pName, pVal) {
		if(pName == "compactDownloads")
			this.stl.loadCompactStyle(pVal);
		else if(pName == "showDownloadRate") {
			this.showDownloadRate(pVal);
			for(var window of this.windows)
				this.udateDownloadRate(window.document, pVal);
		}
		else if(pName == "itemCountLimit") {
			if(this.wrongPref(pName, pVal, this.minItemCountLimit, 10e3))
				return;
			for(var window of this.windows)
				this.setItemCountLimit(window, true);
		}
		else if(
			pName == "panelWidth"
			|| pName == "progressBarHeight"
			|| pName == "decolorizePausedProgress"
			|| pName == "panelMaxHeight"
		) {
			if(
				pName == "panelWidth"
					&& this.wrongPref(pName, pVal, this.stl.minPanelWidth, 10e3)
				|| pName == "progressBarHeight"
					&& this.wrongPref(pName, pVal, this.stl.minProgressBarHeight, this.stl.maxProgressBarHeight)
				|| pName == "panelMaxHeight"
					&& this.wrongPref(pName, pVal, this.stl.minPanelHeight, 100e3, true)
			)
				return;
			if(pName == "decolorizePausedProgress") {
				this.showPausedDownloadsSummary(pVal);
				for(var window of this.windows)
					this.updateDownloadsSummary(window.document, pVal);
			}
			this.stl.reloadTweakStyleProxy();
		}
		else if(pName == "showFullPathInTooltip")
			!pVal && this.dp.restoreAllDlItemsTooltips();
		else if(
			pName.startsWith("override")
			|| pName == "reopenPanel.openContainingFolder"
		) {
			var handleCommand = this.handleCommandEvent;
			var handleClick = this.handleClickEvent;
			_log(
				'Changed "' + pName + '" pref'
				+ ", handleCommandEvent = " + handleCommand
				+ ", handleClickEvent = " + handleClick
			);
			for(var window of this.windows) {
				if(handleCommand)
					window.addEventListener("command", this, true);
				else
					window.removeEventListener("command", this, true);
				if(handleClick)
					window.addEventListener("click", this, true);
				else
					window.removeEventListener("click", this, true);
			}
		}
		else if(pName == "dontRemoveFinishedDownloads") {
			this.de.dontRemoveFinishedDownloads(pVal);
			this.de.fixLoadDownloads(pVal && prefs.get("fixDownloadsLoading"));
			if(!pVal) delay(function() {
				this.de.saveDownloads(); // Force perform cleanup
			}, this);
		}
		else if(pName == "fixDownloadsLoading")
			this.de.fixLoadDownloads(pVal && prefs.get("dontRemoveFinishedDownloads"));
		else if(pName == "fixWrongTabsOnTopAttribute") {
			for(var window of this.windows)
				this.setFixToolbox(window, pVal, true);
		}
		else if(
			pName == "dontHighlightButton"
			|| pName == "menuButtonBehavior"
		) {
			for(var window of this.windows)
				this.btn.tweakDlButton(window, this.enableDlButtonTweaks, true);
		}
		else if(pName == "debug")
			_dbg = pVal;
		else if(pName == "debug.verbose")
			_dbgv = pVal;
	},
	_wrongPrefDelay: 500,
	_wrongPrefTimer: null,
	_wrongPrefLast: "",
	wrongPref: function(pName, pVal, min, max, allowZero) {
		var timer = this._wrongPrefTimer;
		if(timer) {
			if(pName == this._wrongPrefLast)
				timer.cancel();
			else
				timer = this._wrongPrefTimer = null;
		}

		if(allowZero && pVal <= 0)
			return false;

		var corrected;
		if(pVal > max)
			corrected = max;
		else if(pVal < min)
			corrected = min;
		else
			return false;

		this._wrongPrefLast = pName;
		if(!timer) {
			timer = this._wrongPrefTimer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
		}
		timer.init(function() {
			this._wrongPrefTimer = null;
			this._wrongPrefLast = "";
			prefs.set(pName, corrected);
		}.bind(this), this._wrongPrefDelay, timer.TYPE_ONE_SHOT);
		return true;
	}
};

var prefs = {
	ns: "extensions.downloadPanelTweaker.",
	version: 1,
	initialized: false,
	init: function() {
		if(this.initialized)
			return;
		this.initialized = true;

		var version = this.getPref(this.ns + "prefsVersion", 0);
		if(version < this.version) {
			this.migratePrefs(version);
			_log("Prefs updated: " + version + " => " + this.version);
			this.setPref(this.ns + "prefsVersion", this.version);
		}
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

	migratePrefs: function(version) {
		switch(version) {
			case 0:
				var compactPref = this.ns + "compactDownloads";
				var compact = this.getPref(compactPref);
				if(typeof compact == "boolean") {
					Services.prefs.deleteBranch(compactPref);
					if(compact === false)
						this.setPref(compactPref, 0);
				}
				var maxRetentionPref = this.ns + "downloadsMaxRetentionDays";
				var maxRetention = this.getPref(maxRetentionPref);
				if(typeof maxRetention == "number") {
					// Note: no migration, we may have bugs with too long limit
					Services.prefs.deleteBranch(maxRetentionPref);
					if(maxRetention > 0 && this.getPref(this.ns + "dontRemoveFinishedDownloads"))
						dpTweaker.de._cleanupDownloads = true; // See dontRemoveFinishedDownloads()
				}
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

function delay(callback, context) {
	var tm = Services.tm;
	var DISPATCH_NORMAL = Components.interfaces.nsIThread.DISPATCH_NORMAL;
	delay = function(callback, context) {
		tm.mainThread.dispatch(function() {
			callback.call(context);
		}, DISPATCH_NORMAL);
	}
	delay.apply(this, arguments);
}

// Be careful, loggers always works until prefs aren't initialized
// (and if "debug" preference has default value)
var _dbg = true, _dbgv = true;
function ts() {
	var d = new Date();
	var ms = d.getMilliseconds();
	return d.toLocaleFormat("%M:%S:") + "000".substr(String(ms).length) + ms + " ";
}
function _log(s) {
	if(!_dbg)
		return;
	var msg = LOG_PREFIX + ts() + s;
	Services.console.logStringMessage(msg);
	dump(msg + "\n");
}