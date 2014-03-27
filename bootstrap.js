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
		_dbg = prefs.get("debug", false);
		_dbgv = prefs.get("debug.verbose", false);

		var ws = Services.wm.getEnumerator("navigator:browser");
		while(ws.hasMoreElements())
			this.initWindow(ws.getNext(), reason);
		if(!this._tweakStyleLoaded && Services.wm.getMostRecentWindow("Places:Organizer"))
			this.loadStyles(true);
		Services.ww.registerNotification(this);

		delay(function() {
			// We can't apply this patch after "domwindowopened" + delay at least in Firefox 27
			if(prefs.get("dontRemoveFinishedDownloads") && prefs.get("fixDownloadsLoading"))
				this.de.fixLoadDownloads(true);
		}, this);

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
			this.de.saveDownloads();
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
		switch(e.type) {
			case "load":
				var window = e.originalTarget.defaultView;
				window.removeEventListener("load", this, false);
				this.initWindow(window, WINDOW_LOADED);
			break;
			case "command":      this.handleCommand(e); break;
			case "click":        this.handleClick(e);   break;
			case "popupshowing": this.popupShowingHandler(e);
		}
	},

	initWindow: function(window, reason) {
		if(reason == WINDOW_LOADED && this.isLibraryWindow(window)) {
			this.loadStyles(true);
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
				this.de.dontRemoveFinishedDownloads(true);
		}.bind(this), 0);
		if(prefs.get("fixWrongTabsOnTopAttribute")) window.setTimeout(function() {
			this.setFixToolbox(window, true);
		}.bind(this), 0);
		window.setTimeout(function() {
			this.loadStyles(true);
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
		this.destroyPanel(document, force);
		if(force) {
			this.setItemCountLimit(window, false);
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

	get de() {
		_log("Load downloadsEnhancements.js");
		Services.scriptloader.loadSubScript("chrome://downloadpaneltweaker/content/downloadsEnhancements.js");
		delete this.de;
		return this.de = downloadsEnhancements;
	},
	get sss() {
		delete this.sss;
		return this.sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
			.getService(Components.interfaces.nsIStyleSheetService);
	},
	newCssURI: function(cssStr) {
		cssStr = this.trimCSSString(cssStr);
		return Services.io.newURI("data:text/css," + encodeURIComponent(cssStr), null, null);
	},
	trimCSSString: function(s) {
		var spaces = s.match(/^[ \t]*/)[0];
		return s.replace(new RegExp("^" + spaces, "mg"), "");
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
	minPanelHeight: 30,
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
			var panelMaxHeight = prefs.get("panelMaxHeight", 0);
			var panelMaxHeightVal = panelMaxHeight <= 0
				? "none"
				: Math.max(this.minPanelHeight, panelMaxHeight) + "px";
			var pbHeight = Math.max(this.minProgressBarHeight, Math.min(this.maxProgressBarHeight,
				prefs.get("progressBarHeight", 10)
			));
			var containerSelector = parseFloat(Services.appinfo.version) >= 20
				? ".downloadContainer"
				: ".download-state > vbox";
			var tdsPrefix = "-moz-";
			var window = Services.wm.getMostRecentWindow(null);
			if(window && "textDecorationStyle" in window.document.documentElement.style)
				tdsPrefix = "";
			var cssStr = '\
				/* Download Panel Tweaker */\n\
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n\
				@-moz-document url("chrome://browser/content/browser.xul"),\n\
					url("chrome://browser/content/places/places.xul"),\n\
					url("about:downloads"),\n\
					url("chrome://browser/content/downloads/contentAreaDownloadsView.xul") {\n\
					#downloadsListBox {\n\
						/* Set width for Firefox < 20 and NASA Night Launch theme */\n\
						width: auto !important;\n\
						min-width: 0 !important;\n\
						max-width: none !important;\n\
						max-height: ' + panelMaxHeightVal + ' !important;\n\
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
				}\n\
				@-moz-document url("about:addons"),\n\
					url("chrome://mozapps/content/extensions/extensions.xul") {\n\
					.downloadPanelTweaker-item[tooltiptext] {\n\
						text-decoration: underline;\n\
						' + tdsPrefix + 'text-decoration-style: dotted;\n\
					}\n\
				}';
			cssURI = this.tweakCssURI = this.newCssURI(cssStr);
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
			if("onDataInvalidated" in DownloadsView)
				DownloadsView.onDataInvalidated(); // This calls DownloadsPanel.terminate();
			else { // Firefox 28.0a1+
				// Based on code from chrome://browser/content/downloads/downloads.js in Firefox 25.0
				DownloadsPanel.terminate();
				DownloadsView.richListBox.textContent = "";
				// We can't use {} and [] here because of memory leaks!
				DownloadsView._viewItems = new window.Object();
				DownloadsView._dataItems = new window.Array();
			}
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
			if(!paused ^ summaryNode.hasAttribute(this.pausedAttr))
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
		});
	},
	get handleClickEvent() {
		return !!(
			prefs.get("overrideDownloadsCommand")
			|| prefs.get("overrideDownloadsCommand.private")
		);
	},
	handleCommand: function(e) {
		var curTrg = e.currentTarget;
		if(curTrg.getAttribute && curTrg.hasAttribute("downloadPanelTweaker-command")) {
			var cmd = curTrg.getAttribute("downloadPanelTweaker-command");
			if(cmd == "clearDownloads")
				this.clearDownloads();
			else if(cmd == "copyReferrer")
				this.copyReferrer(e.target);
			else if(cmd == "removeFile")
				this.removeFile(e.target);
		}
		else if(e.target.id == "Tools:Downloads") {
			if(e.sourceEvent && e.sourceEvent.target.nodeName != "key")
				this.downloadCommand(e, "overrideDownloadsCommand");
			else
				this.downloadCommand(e, "overrideDownloadsHotkey");
		}
		else if(e.target.id == "downloadsHistory")
			this.downloadCommand(e, "overrideShowAllDownloads");
	},
	handleClick: function(e) {
		var trg = e.target;
		if(
			trg.ownerDocument
			&& trg.ownerDocument.documentURI == "about:home"
			&& trg.id == "downloads"
		)
			this.downloadCommand(e, "overrideDownloadsCommand");
		else if(e.currentTarget.id == "downloadsPanel")
			this.panelClick(e);
	},
	downloadCommand: function(e, prefName) {
		var window = e.currentTarget;
		var isPrivate = "PrivateBrowsingUtils" in window
			&& window.PrivateBrowsingUtils.isWindowPrivate(window.content);
		if(isPrivate)
			prefName += ".private";
		var cmd = prefs.get(prefName);
		if(!cmd)
			return;
		var ok;
		switch(cmd) {
			case 1: ok = this.toggleDownloadPanel(window);  break;
			case 2: ok = this.showDownloadWindow(window);   break;
			case 3: ok = this.openDownloadsTab(window);     break;
			case 4: ok = this.openDownloadsLibrary(window); break;
			case 5: ok = this.toggleDownloadsSidebar(window); break;
			default: return;
		}
		if(ok == false)
			return;
		_log("downloadCommand(): " + prefName + " = " + cmd);
		this.stopEvent(e);
	},
	panelClick: function(e) {
		if(e.button != 1 || !prefs.get("middleClickToRemoveFromPanel"))
			return;
		var dlController = this.getDlController(e.target);
		if(!dlController)
			return;
		this.removeFromPanel(dlController, prefs.get("middleClickToRemoveFromPanel.clearHistory"));
		this.stopEvent(e);
	},
	getDlNode: function(node) {
		for(; node; node = node.parentNode) {
			var ln = node.localName;
			if(ln == "richlistitem") {
				if(node.getAttribute("type") == "download")
					return node;
				break;
			}
			else if(ln == "panel") {
				break;
			}
		}
		return null;
	},
	getDlController: function(node) {
		var dlItem = this.getDlNode(node);
		if(!dlItem)
			return null;
		var window = dlItem.ownerDocument.defaultView;
		return new window.DownloadsViewItemController(dlItem);
	},
	stopEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	},
	showDownloadWindow: function(window) {
		if(!this.dispatchAPIEvent(window, "OpenDownloadWindow")) {
			_log("showDownloadWindow(): someone handle API event, do nothing");
			return true;
		}
		// https://addons.mozilla.org/firefox/addon/downloads-window/
		if(this.packageAvailable("downloads_window")) {
			_log("Found Downloads Window extension, will open its window");
			return this.openWindow(window, {
				uri: "chrome://downloads_window/content/downloadsWindow.xul",
				name: "downloads window",
				features: "chrome,dialog=no,resizable,centerscreen"
			});
		}
		if(
			"PrivateBrowsingUtils" in window
			&& window.PrivateBrowsingUtils.isWindowPrivate(window.content)
		) {
			_log("showDownloadWindow(): private downloads aren't supported");
			return false;
		}
		// See resource://app/components/DownloadsUI.js
		// DownloadsUI.prototype.show()
		_log("showDownloadWindow()");
		this.toggleDownloadPanel(window, false);
		var toolkitUI = Components.classesByID["{7dfdf0d1-aff6-4a34-bad1-d0fe74601642}"]
			.getService(Components.interfaces.nsIDownloadManagerUI);
		toolkitUI.show(window/*, aDownload, aReason, aUsePrivateUI*/);
		return true;
	},
	toggleDownloadPanel: function(window, show) {
		_log("toggleDownloadPanel(" + show + ")");
		var DownloadsPanel = window.DownloadsPanel;
		if(show === undefined)
			show = !DownloadsPanel.isPanelShowing;
		else if(show == DownloadsPanel.isPanelShowing)
			return;
		if(show)
			DownloadsPanel.showPanel();
		else
			DownloadsPanel.hidePanel();
	},
	openDownloadsTab: function(window) {
		this.toggleDownloadPanel(window, false);
		const downloadsURI = "about:downloads";
		var gBrowser = window.gBrowser;
		// We need to check private state for Private Tab extension
		var pbu = "PrivateBrowsingUtils" in window && window.PrivateBrowsingUtils;
		var isPrivate = pbu && pbu.isWindowPrivate(window.content);
		if(!Array.some(gBrowser.visibleTabs || gBrowser.tabs, function(tab) {
			var browser = tab.linkedBrowser;
			if(
				browser
				&& browser.currentURI
				&& browser.currentURI.spec == downloadsURI
				&& isPrivate == (pbu && pbu.isWindowPrivate(browser.contentWindow))
			) {
				gBrowser.selectedTab = tab;
				return true;
			}
			return false;
		})) {
			//gBrowser.selectedTab = gBrowser.addTab(downloadsURI);
			// See resource://app/components/DownloadsUI.js
			window.openUILinkIn(downloadsURI, "tab");
		}
	},
	openDownloadsLibrary: function(window) {
		this.toggleDownloadPanel(window, false);
		// See resource://app/components/DownloadsUI.js
		return this.openWindow(window, {
			uri: "chrome://browser/content/places/places.xul",
			type: "Places:Organizer",
			features: "chrome,toolbar=yes,dialog=no,resizable",
			args: ["Downloads"],
			callback: function(win, alreadyOpened) {
				if(alreadyOpened)
					win.PlacesOrganizer.selectLeftPaneQuery("Downloads");
			}
		});
	},
	toggleDownloadsSidebar: function(window) {
		if(!this.dispatchAPIEvent(window, "ToggleDownloadSidebar")) {
			_log("toggleDownloadsSidebar(): someone handle API event, do nothing");
			return true;
		}
		var document = window.document;
		var sbItem = document.getElementById("menu_dmSidebar") // OmniSidebar
			|| document.getElementById("downloads-mitem"); // All-in-One Sidebar
		if(sbItem) {
			_log("toggleDownloadsSidebar(): found #" + sbItem.id);
			sbItem.doCommand();
			return;
		}
		var sbBrowser = document.getElementById("sidebar");
		var wpBrowser = sbBrowser && sbBrowser.boxObject.width > 0
			&& sbBrowser.contentDocument.getElementById("web-panels-browser");
		if(wpBrowser && wpBrowser.currentURI.spec == "about:downloads") {
			window.toggleSidebar();
			return;
		}
		var downloadsTitle = this.getEntity(
			["chrome://browser/locale/downloads/downloads.dtd"],
			"downloads.title",
			"Downloads"
		);
		window.openWebPanel(downloadsTitle, "about:downloads");
	},

	dispatchAPIEvent: function(window, type) {
		var evt = window.document.createEvent("Events");
		evt.initEvent("DownloadPanelTweaker:" + type, true, true);
		return window.dispatchEvent(evt);
	},

	popupShowingHandler: function(e) {
		var popup = e.target;
		var curTrg = e.currentTarget;
		var id = popup.id;
		if(curTrg instanceof Components.interfaces.nsIDOMWindow) {
			var window = curTrg;
			if(id == "downloadsPanel") {
				window.removeEventListener("popupshowing", this, false);
				window.setTimeout(function() {
					this.initPanel(window.document, popup);
				}.bind(this), 0);
			}
			return;
		}
		if(popup != curTrg)
			return;
		if(id == "downloadsContextMenu")
			this.updateDownloadsContextMenu(popup);
	},

	clearDownloadsId: "downloadPanelTweaker-menuItem-clearDownloads",
	clearDownloads2Id: "downloadPanelTweaker-menuItem-clearDownloads2",
	copyReferrerId: "downloadPanelTweaker-menuItem-copyReferrer",
	removeFileId: "downloadPanelTweaker-menuItem-removeFile",
	panelFooterContextId: "downloadPanelTweaker-popup-panelFooterContext",
	initPanel: function(document, popup) {
		_log("initPanel()");
		popup.addEventListener("click", this, true);

		var labels = {
			"cmd.clearDownloads.label": "Clear Downloads",
			"cmd.clearDownloads.accesskey": "D",
			"dpt.copyReferrer": "Copy Download Page Link",
			"dpt.copyReferrer.accesskey": "P",
			"dpt.removeFile": "Remove File From Disk",
			"dpt.removeFile.accesskey": "F"
		};
		this.getEntities([
			"chrome://downloadpaneltweaker/locale/dpt.dtd",
			"chrome://browser/locale/downloads/downloads.dtd"
		], labels);

		var clearDownloads = this.createMenuItem(document, {
			id: this.clearDownloadsId,
			label: labels["cmd.clearDownloads.label"],
			accesskey: labels["cmd.clearDownloads.accesskey"],
			"downloadPanelTweaker-command": "clearDownloads"
		});
		var copyReferrer = this.createMenuItem(document, {
			id: this.copyReferrerId,
			label: labels["dpt.copyReferrer"],
			accesskey: labels["dpt.copyReferrer.accesskey"],
			"downloadPanelTweaker-command": "copyReferrer"
		});
		var removeFile = this.createMenuItem(document, {
			id: this.removeFileId,
			label: labels["dpt.removeFile"],
			accesskey: labels["dpt.removeFile.accesskey"],
			"downloadPanelTweaker-command": "removeFile"
		});

		var footer = document.getElementById("downloadsFooter")
			|| document.getElementById("downloadsHistory"); // Firefox < 20
		if(footer) {
			var footerContext = document.createElement("menupopup");
			footerContext.id = this.panelFooterContextId;
			var clearDownloads2 = clearDownloads.cloneNode(true);
			clearDownloads2.id = this.clearDownloads2Id;
			clearDownloads2.addEventListener("command", this, false);
			footerContext.appendChild(clearDownloads2);
			document.documentElement.appendChild(footerContext);
			if(footer.hasAttribute("context"))
				footer.setAttribute("downloadPanelTweaker-origContext", footer.getAttribute("context"));
			footer.setAttribute("context", this.panelFooterContextId);
			_log("Add context menu for download panel footer");
		}

		var contextMenu = document.getElementById("downloadsContextMenu");
		if(contextMenu) {
			var insert = function(item, insPos) {
				item.addEventListener("command", this, false);
				contextMenu.insertBefore(item, insPos && insPos.parentNode == contextMenu && insPos.nextSibling);
			}.bind(this);
			insert(clearDownloads, contextMenu.getElementsByAttribute("command", "downloadsCmd_clearList")[0]);
			insert(copyReferrer, contextMenu.getElementsByAttribute("command", "downloadsCmd_copyLocation")[0]);
			insert(removeFile, contextMenu.getElementsByAttribute("command", "cmd_delete")[0]);
			contextMenu.addEventListener("popupshowing", this, false);
			_log("Add menu items to panel context menu");
		}
	},
	destroyPanel: function(document, force) {
		var popup = document.getElementById("downloadsPanel");
		if(popup)
			popup.removeEventListener("click", this, true);
		var contextMenu = document.getElementById("downloadsContextMenu");
		if(contextMenu)
			contextMenu.removeEventListener("popupshowing", this, false);
		var footer = document.getElementById("downloadsFooter")
			|| document.getElementById("downloadsHistory"); // Firefox < 20
		if(footer) {
			if(footer.hasAttribute("downloadPanelTweaker-origContext"))
				footer.setAttribute("context", footer.getAttribute("downloadPanelTweaker-origContext"));
			else
				footer.removeAttribute("context");
			var clearDownloads2 = document.getElementById(this.clearDownloads2Id);
			if(clearDownloads2)
				clearDownloads2.removeEventListener("command", this, false);
			var footerContext = document.getElementById(this.panelFooterContextId);
			if(footerContext && force)
				footerContext.parentNode.removeChild(footerContext);
		}
		Array.slice(document.getElementsByAttribute("downloadPanelTweaker-command", "*"))
			.forEach(function(mi) {
				mi.removeEventListener("command", this, false);
				force && mi.parentNode.removeChild(mi);
			}, this);
	},
	createMenuItem: function(document, attrs) {
		var mi = document.createElement("menuitem");
		for(var attr in attrs)
			mi.setAttribute(attr, attrs[attr]);
		return mi;
	},

	updateDownloadsContextMenu: function(popup) {
		_log("updateDownloadsContextMenu()");
		var dlItem = this.getDlNode(popup.triggerNode);
		var dlController = this.getDlController(dlItem);
		Array.forEach(
			popup.getElementsByAttribute("downloadPanelTweaker-command", "*"),
			function(mi) {
				var cmd = mi.getAttribute("downloadPanelTweaker-command");
				if(cmd == "copyReferrer")
					this.enableNode(mi, dlController && dlController.dataItem && dlController.dataItem.referrer);
				else if(cmd == "removeFile") {
					var exists = dlItem && dlItem.getAttribute("exists") == "true";
					var window = popup.ownerDocument.defaultView;
					if(
						window.DownloadsViewItem
						&& window.DownloadsViewItem.prototype
						&& !("verifyTargetExists" in window.DownloadsViewItem.prototype)
					) try { // Firefox 20 and older
						_log("Will use dataItem.localFile.exists()");
						exists = dlController.dataItem.localFile.exists();
					}
					catch(e) {
						Components.utils.reportError(e);
					}
					this.enableNode(mi, exists);
				}
			},
			this
		);
	},
	enableNode: function(node, enable) {
		if(enable)
			node.removeAttribute("disabled");
		else
			node.setAttribute("disabled", "true");
	},

	clearDownloads: function() {
		_log("clearDownloads()");
		try {
			var downloads = Services.downloads;
			downloads.canCleanUp && downloads.cleanUp();
			downloads.canCleanUpPrivate && downloads.cleanUpPrivate();
		}
		catch(e) { // Firefox 26.0a1
			_log("clearDownloads(): Services.downloads.cleanUp/cleanUpPrivate() failed:\n" + e);
			try {
				var global = Components.utils.import("resource://app/modules/DownloadsCommon.jsm", {});
				if(global.DownloadsData && global.DownloadsData.removeFinished) {
					global.DownloadsData.removeFinished();
					_log("clearDownloads(): cleanup DownloadsData");
				}
				if(global.PrivateDownloadsData && global.PrivateDownloadsData.removeFinished) {
					global.PrivateDownloadsData.removeFinished();
					_log("clearDownloads(): cleanup PrivateDownloadsData");
				}
			}
			catch(e2) {
				Components.utils.reportError(e2);
			}
		}
		Components.classes["@mozilla.org/browser/download-history;1"]
			.getService(Components.interfaces.nsIDownloadHistory)
			.removeAllDownloads();
		_log("clearDownloads(): done");
	},
	copyReferrer: function(mi) {
		var dlContext = mi.parentNode;
		var dlController = this.getDlController(dlContext.triggerNode);
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(dlController.dataItem.referrer, mi.ownerDocument);
	},
	removeFile: function(mi) {
		var dlContext = mi.parentNode;
		var dlItem = this.getDlNode(dlContext.triggerNode);
		var dlController = this.getDlController(dlItem);
		var dataItem = dlController.dataItem;
		var path = dataItem.file;
		if(!path || typeof path != "string" || path.startsWith("file:/")) // Firefox 24 and older
			path = dataItem.localFile.path;
		_log("removeFile(): " + path);
		var htmlPattern = /\.(?:[xs]?html?|xht)$/i;
		var removeFilesDirPref = "removeFile.removeFilesDirectoryForHTML";
		var clearHistory = prefs.get("removeFile.clearHistory");
		try {
			Components.utils.import("resource://gre/modules/osfile.jsm");
			OS.File.remove(path).then(
				function onSuccess() {
					dlItem.removeAttribute("exists");
					if(clearHistory)
						this.removeFromPanel(dlController, clearHistory > 1);
				}.bind(this),
				Components.utils.reportError
			);
			if(htmlPattern.test(path) && prefs.get(removeFilesDirPref)) {
				var filesPath = RegExp.leftContext + "_files";
				_log("removeFile(): HTML _files directory: " + filesPath);
				OS.File.removeDir(filesPath, { ignoreAbsent: true }).then(
					null,
					Components.utils.reportError
				);
			}
		}
		catch(e) { // Firefox 17
			if((e.message || e) != "osfile.jsm cannot be used from the main thread yet")
				Components.utils.reportError(e);
			_log("removeFile(): will use dataItem.localFile.remove(false)");
			var localFile = dataItem.localFile;
			if(htmlPattern.test(localFile.leafName) && prefs.get(removeFilesDirPref)) {
				var filesName = RegExp.leftContext + "_files";
				var filesDir = localFile.parent.clone();
				filesDir.append(filesName);
				_log("removeFile(): HTML _files directory: " + filesDir.path);
			}
			localFile.remove(false);
			if(clearHistory)
				this.removeFromPanel(dlController, clearHistory > 1);
			if(filesDir && filesDir.exists())
				filesDir.remove(true);
		}
	},
	removeFromPanel: function(dlController, clearHistory) {
		// See chrome://browser/content/downloads/downloads.js
		if(clearHistory) {
			dlController.doCommand("cmd_delete");
			_log('removeFromPanel() -> dlController.doCommand("cmd_delete")');
		}
		else {
			dlController.dataItem.remove();
			_log("removeFromPanel() -> dlController.dataItem.remove()");
		}
	},

	setFixToolbox: function(window, enable) {
		var document = window.document;
		var tb = document.getElementById("navigator-toolbox");
		_log("setFixToolbox(" + enable + ")");
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

	get xcr() {
		delete this.xcr;
		return this.xcr = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
			.getService(Components.interfaces.nsIXULChromeRegistry);
	},
	packageAvailable: function(packageName) {
		try {
			return /^[a-z]/.test(this.xcr.getSelectedLocale(packageName));
		}
		catch(e) {
		}
		return false;
	},
	openWindow: function(parentWindow, options) {
		var win = options.type && Services.wm.getMostRecentWindow(options.type)
			|| options.name && Services.ww.getWindowByName(options.name, null)
			|| (function() {
				var ws = Services.wm.getEnumerator(null);
				while(ws.hasMoreElements()) {
					var win = ws.getNext();
					if(win.location.href == options.uri)
						return win;
				}
				return null;
			})();
		if(win) {
			_log("openWindow(): already opened " + options.uri);
			options.callback && options.callback(win, true);
			win.focus();
		}
		else {
			var openArgs = [options.uri, options.name || "", options.features || "chrome,all,dialog=0"];
			options.args && openArgs.push.apply(openArgs, options.args);
			win = parentWindow.openDialog.apply(parentWindow, openArgs);
			_log("openWindow(): open " + options.uri);
			options.callback && win.addEventListener("load", function load(e) {
				win.removeEventListener(e.type, load, false);
				_log("openWindow(): loaded " + options.uri);
				options.callback(win, false);
			}, false);
		}
		return win;
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
		for(var name in names) if(names.hasOwnProperty(name))
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
				for(var name in names) if(names.hasOwnProperty(name))
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
			|| pName == "panelMaxHeight"
		) {
			if(
				pName == "panelWidth"
					&& this.wrongPref(pName, pVal, this.minPanelWidth, 10e3)
				|| pName == "progressBarHeight"
					&& this.wrongPref(pName, pVal, this.minProgressBarHeight, this.maxProgressBarHeight)
				|| pName == "panelMaxHeight"
					&& this.wrongPref(pName, pVal, this.minPanelHeight, 100e3, true)
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
		else if(pName.startsWith("override")) {
			var handleCommand = this.handleCommandEvent;
			var handleClick = this.handleClickEvent;
			_log(
				'Changed "' + pName + '" pref'
				+ ", handleCommandEvent = " + handleCommand
				+ ", handleClickEvent = " + handleClick
			);
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements()) {
				var window = ws.getNext();
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
			var ws = Services.wm.getEnumerator("navigator:browser");
			while(ws.hasMoreElements())
				this.setFixToolbox(ws.getNext(), pVal);
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