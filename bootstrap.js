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
		switch(e.type) {
			case "load":
				var window = e.originalTarget.defaultView;
				window.removeEventListener("load", this, false);
				this.initWindow(window, WINDOW_LOADED);
			break;
			case "command":      this.handleCommand(e); break;
			case "click":        this.handleClick(e);   break;
			case "popupshowing": this.initContextMenus(e);
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
		this.destroyContextMenus(document, force);
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

	dontRemoveFinishedDownloads: function(patch) {
		// See https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5 for details
		try { // Firefox 26+
			// http://mxr.mozilla.org/mozilla-central/source/toolkit/components/jsdownloads/src/DownloadIntegration.jsm
			var {DownloadIntegration} = Components.utils.import("resource://gre/modules/DownloadIntegration.jsm", {});
		}
		catch(e) {
		}
		if(DownloadIntegration && "shouldPersistDownload" in DownloadIntegration) {
			const bakKey = "_downloadPanelTweaker_shouldPersistDownload";
			if(!patch ^ bakKey in DownloadIntegration)
				return;
			_log("dontRemoveFinishedDownloads(" + patch + ")");
			if(patch) {
				DownloadIntegration[bakKey] = DownloadIntegration.shouldPersistDownload;
				DownloadIntegration.shouldPersistDownload = function downloadPanelTweakerWrapper(download) {
					if(download.hasPartialData || !download.stopped)
						return true;
					var retentionDays = prefs.get("downloadsMaxRetentionDays");
					return retentionDays > 0
						&& download.startTime > (Date.now() - retentionDays*24*60*60*1000);
				};
			}
			else {
				DownloadIntegration.shouldPersistDownload = DownloadIntegration[bakKey];
				delete DownloadIntegration[bakKey];
			}
		}
		else {
			this.dontRemoveFinishedDownloadsLegacy(patch);
		}
	},
	dontRemoveFinishedDownloadsLegacy: function(patch) {
		const bakKey = "_downloadPanelTweaker_downloads";
		const newKey = "_downloadPanelTweaker_downloadsWrapper";
		if(!patch ^ bakKey in Services)
			return;
		var logPrefix = "dontRemoveFinishedDownloadsLegacy(" + patch + "): ";
		if(patch) {
			var cleanUp = function downloadPanelTweakerWrapper() {
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
			};
			if(newKey in Services) {
				var downloads = Services[newKey].__proto__;
				Services[bakKey] = null;
				this.setProperty(Services[newKey], "cleanUp", cleanUp);
				_log(logPrefix + "Will use old wrapper for Services.downloads");
			}
			else {
				var downloads = Services[bakKey] = Services.downloads;
				var downloadsWrapper = Services[newKey] = {
					__proto__: downloads,
					cleanUp: cleanUp
				};
				this.setProperty(Services, "downloads", downloadsWrapper);
				_log(logPrefix + "Create wrapper for Services.downloads");
			}
		}
		else {
			if(Services.downloads == Services[newKey] && Services[bakKey]) {
				this.setProperty(Services, "downloads", Services[bakKey]);
				delete Services[newKey];
				_log(logPrefix + "Restore Services.downloads");
			}
			else {
				// Yes, we create some memory leaks here, but it's better than break other extensions
				delete Services[newKey].cleanUp;
				_log(logPrefix + "Can't completely restore Services.downloads: detected third-party wrapper");
			}
			delete Services[bakKey];
		}
	},
	setProperty: function(o, p, v) {
		Object.defineProperty(o, p, {
			value: v,
			configurable: true,
			writable: true,
			enumerable: true
		});
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
		if(curTrg.getAttribute && curTrg.getAttribute("downloadPanelTweaker-command") == "clearDownloads")
			this.clearDownloads();
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
			default: return;
		}
		if(ok == false)
			return;
		_log("downloadCommand(): " + prefName + " = " + cmd);
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	},
	showDownloadWindow: function(window) {
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
	clearDownloadsId: "downloadPanelTweaker-menuItem-clearDownloads",
	clearDownloads2Id: "downloadPanelTweaker-menuItem-clearDownloads2",
	panelFooterContextId: "downloadPanelTweaker-popup-panelFooterContext",
	initContextMenus: function(e) {
		var popup = e.target;
		if(popup.id != "downloadsPanel")
			return;
		_log("Opened #downloadsPanel, will initialize context menus");
		var window = e.currentTarget;
		var document = window.document;
		window.removeEventListener("popupshowing", this, false);

		var clearDownloads = document.createElement("menuitem");
		clearDownloads.id = this.clearDownloadsId;
		clearDownloads.setAttribute("downloadPanelTweaker-command", "clearDownloads");
		var [label, accesskey] = this.getClearDownloadsLabel(window);
		clearDownloads.setAttribute("label", label);
		clearDownloads.setAttribute("accesskey", accesskey);

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
			clearDownloads.addEventListener("command", this, false);
			var insPos = contextMenu.getElementsByAttribute("command", "downloadsCmd_clearList")[0];
			contextMenu.insertBefore(clearDownloads, insPos.nextSibling);
			_log('Add "Clear Downloads" to panel context menu');
		}
	},
	destroyContextMenus: function(document, force) {
		var clearDownloads = document.getElementById(this.clearDownloadsId);
		if(clearDownloads) {
			clearDownloads.removeEventListener("command", this, false);
			force && clearDownloads.parentNode.removeChild(clearDownloads);
		}
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
	},
	getClearDownloadsLabel: function(window) {
		try {
			var xul = '<?xml version="1.0"?>\
				<!DOCTYPE label [\
					<!ENTITY % dptDTD SYSTEM "chrome://downloadpaneltweaker/locale/dpt.dtd">\
					%dptDTD;\
					<!ENTITY % downloadsDTD SYSTEM "chrome://browser/locale/downloads/downloads.dtd">\
					%downloadsDTD;\
				]>\
				<label value="&cmd.clearDownloads.label;" accesskey="&cmd.clearDownloads.accesskey;" />';
			var node = new window.DOMParser().parseFromString(xul, "application/xml").documentElement;
			if(node.localName == "label")
				return [node.getAttribute("value"), node.getAttribute("accesskey")];
			else
				_log("getClearDownloadsLabel(): can't parse downloads.dtd");
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		_log("getClearDownloadsLabel(): will use English strings...");
		return ["Clear Downloads", "D"];
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
				var global = Components.utils.import("resource:///modules/DownloadsCommon.jsm");
				if(global.DownloadsData && global.DownloadsData.removeFinished)
					global.DownloadsData.removeFinished();
				if(global.PrivateDownloadsData && global.PrivateDownloadsData.removeFinished)
					global.PrivateDownloadsData.removeFinished();
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