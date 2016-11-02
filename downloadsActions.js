var downloadsActions = {
	dpt: dpTweaker,

	showDownloadWindow: function(window) {
		this.toggleDownloadPanel(window, false);
		if(!this.dpt.dispatchAPIEvent(window, "OpenDownloadWindow")) {
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
		if(this.dpt.isPrivateContent(window)) {
			_log("showDownloadWindow(): private downloads aren't supported");
			return false;
		}
		// See resource:///components/DownloadsUI.js
		// DownloadsUI.prototype.show()
		_log("showDownloadWindow()");
		var toolkitUI = Components.classesByID["{7dfdf0d1-aff6-4a34-bad1-d0fe74601642}"]
			.getService(Components.interfaces.nsIDownloadManagerUI);
		toolkitUI.show(window/*, aDownload, aReason, aUsePrivateUI*/);
		return true;
	},
	toggleDownloadPanel: function(window, show) {
		_log("toggleDownloadPanel(" + (arguments.length > 1 ? show : "") + ")");
		var DownloadsPanel = window.DownloadsPanel;
		if(!DownloadsPanel) {
			_log("toggleDownloadPanel(): window.DownloadsPanel not found!");
			return;
		}
		if(show === undefined)
			show = !DownloadsPanel.isPanelShowing;
		else if(show == DownloadsPanel.isPanelShowing)
			return;
		if(show)
			DownloadsPanel.showPanel();
		else
			DownloadsPanel.hidePanel();

		if(show) try { // Ensure, that anchor for downloads popup is visible
			window.DownloadsButton.getAnchor(function(anchor) {
				if(anchor && anchor.boxObject.width && anchor.boxObject.height)
					return;
				_log("toggleDownloadPanel(): anchor not found or not visible, move panel to #identity-box");
				var anchor = window.document.getElementById("identity-box");
				DownloadsPanel.panel.openPopup(anchor, "bottomcenter topright", 0, 0, false, null);
			});
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},
	openDownloadsTab: function(window) {
		this.toggleDownloadPanel(window, false);
		if(!this.dpt.dispatchAPIEvent(window, "OpenDownloadTab")) {
			_log("openDownloadsTab(): someone handle API event, do nothing");
			return;
		}
		const downloadsURI = "about:downloads";
		var gBrowser = window.gBrowser;
		// Check private state for Private Tab extension
		var isPrivate = this.dpt.isPrivateContent(window);
		if(!Array.some(gBrowser.visibleTabs || gBrowser.tabs, function(tab) {
			var browser = tab.linkedBrowser;
			if(
				browser
				&& browser.currentURI
				&& browser.currentURI.spec == downloadsURI
				&& this.dpt.isPrivateTab(tab) == isPrivate
			) {
				gBrowser.selectedTab = tab;
				return true;
			}
			return false;
		}, this)) {
			//gBrowser.selectedTab = gBrowser.addTab(downloadsURI);
			// See resource:///components/DownloadsUI.js
			window.openUILinkIn(downloadsURI, "tab");
		}
	},
	openDownloadsLibrary: function(window) {
		this.toggleDownloadPanel(window, false);
		// See resource:///components/DownloadsUI.js
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
		this.toggleDownloadPanel(window, false);
		if(!this.dpt.dispatchAPIEvent(window, "ToggleDownloadSidebar")) {
			_log("toggleDownloadsSidebar(): someone handle API event, do nothing");
			return;
		}
		var document = window.document;
		var sbItem = document.getElementById("menu_dmSidebar") // OmniSidebar
			|| document.getElementById("downloads-mitem"); // All-in-One Sidebar
		if(sbItem) {
			// Prefer broadcaster, if available (because menuitem may be disabled)
			// see https://github.com/Infocatcher/Download_Panel_Tweaker/issues/21
			var observes = sbItem.getAttribute("observes");
			sbItem = observes && document.getElementById(observes) || sbItem;
			_log("toggleDownloadsSidebar(): found #" + sbItem.id);
			sbItem.doCommand();
			return;
		}
		var sbBrowser = document.getElementById("sidebar");
		var wpBrowser = sbBrowser && sbBrowser.boxObject.width > 0
			&& sbBrowser.contentDocument.getElementById("web-panels-browser");
		if(wpBrowser && wpBrowser.currentURI.spec == "about:downloads") {
			if("SidebarUI" in window) // Firefox 38+
				window.SidebarUI.hide();
			else
				window.toggleSidebar();
			return;
		}
		var downloadsTitle = this.dpt.getEntity(
			["chrome://browser/locale/downloads/downloads.dtd"],
			"downloads.title",
			"Downloads"
		);
		window.openWebPanel(downloadsTitle, "about:downloads");
	},

	clearDownloads: function(mi) {
		_log("clearDownloads()");
		if(
			!this.confirm({
				pref: "clearDownloads.confirm",
				messageKey: "dpt.clearDownloads.confirmMessage",
				messageDefault: "Are you sure you want to clear ALL downloads history?",
				window: mi && mi.ownerDocument.defaultView
			})
		)
			return;
		try {
			var downloads = Services.downloads;
			downloads.canCleanUp && downloads.cleanUp();
			downloads.canCleanUpPrivate && downloads.cleanUpPrivate();
		}
		catch(e) { // Firefox 26+
			_log("clearDownloads(): Services.downloads.cleanUp/cleanUpPrivate() failed:\n" + e);
			try {
				var global = Components.utils.import("resource:///modules/DownloadsCommon.jsm", {});
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
		var document = mi.ownerDocument;
		var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper);
		var dataItem = this.getDlDataItem(dlContext.triggerNode);
		var ref = this.getDlReferrer(dataItem);
		var content = document.defaultView.content; // For Private Tab extension
		if(content) try {
			clipHelper.copyString(ref, content.document);
			return;
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		clipHelper.copyString(ref, document);
	},
	removeFile: function(mi) {
		var dlContext = mi.parentNode;
		var dlItem = this.getDlNode(dlContext.triggerNode);
		var dlController = this.getDlController(dlItem);
		var dataItem = this.getDlDataItem(dlController);
		var path = this.getDlPath(dataItem);
		_log("removeFile(): " + path);
		if(
			!this.confirm({
				pref: "removeFile.confirm",
				messageKey: "dpt.removeFile.confirmMessage",
				messageDefault: "Are you sure you want to remove file “$S”?",
				messageReplace: function(s) {
					return s.replace("$S", path);
				},
				window: mi && mi.ownerDocument.defaultView
			})
		)
			return;
		var htmlPattern = /\.(?:[xs]?html?|xht|xml)$/i;
		var removeFilesDirPref = "removeFile.removeFilesDirectoryForHTML";
		var clearHistory = prefs.get("removeFile.clearHistory");
		var fileRemoved = false;
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
			fileRemoved = true; // Not yet, but we may get "access denied" error
			if(htmlPattern.test(path) && prefs.get(removeFilesDirPref)) {
				var filesPath = RegExp.leftContext + "_files";
				OS.File.removeDir(filesPath, { ignoreAbsent: true }).then(
					null,
					Components.utils.reportError
				);
				_log("removeFile(): HTML _files directory: " + filesPath);
			}
		}
		catch(e) { // Firefox 17, Firefox 26 and older without OS.File.removeDir()
			var msg = e.message || e;
			if(
				msg != "osfile.jsm cannot be used from the main thread yet"
				&& !(msg == "OS.File.removeDir is not a function" && this.dpt.fxVersion < 27)
			)
				Components.utils.reportError(e);
			_log("removeFile(): will use dataItem.localFile.remove(false)");
			var localFile = dataItem.localFile;
			if(htmlPattern.test(localFile.leafName) && prefs.get(removeFilesDirPref)) {
				var filesName = RegExp.leftContext + "_files";
				var filesDir = localFile.parent.clone();
				filesDir.append(filesName);
				_log("removeFile(): HTML _files directory: " + filesDir.path);
			}
			if(!fileRemoved && localFile.exists())
				localFile.remove(false);
			if(clearHistory)
				this.removeFromPanel(dlController, clearHistory > 1);
			if(filesDir && filesDir.exists() && filesDir.isDirectory())
				filesDir.remove(true);
		}
	},
	removeFromPanel: function(dlController, clearHistory) {
		// See chrome://browser/content/downloads/downloads.js
		if(!clearHistory && dlController.dataItem && "remove" in dlController.dataItem) { // Firefox 20+
			dlController.dataItem.remove();
			_log("removeFromPanel() -> dlController.dataItem.remove()");
		}
		else if(!clearHistory && "download" in dlController) { // Firefox 38+
			var {DownloadsCommon} = Components.utils.import("resource:///modules/DownloadsCommon.jsm", {});
			DownloadsCommon.removeAndFinalizeDownload(dlController.download);
			_log("removeFromPanel() -> DownloadsCommon.removeAndFinalizeDownload()");
		}
		else {
			if(!clearHistory)
				Components.utils.reportError(LOG_PREFIX + "removeFromPanel(): can't remove only from panel!");
			dlController.doCommand("cmd_delete");
			_log('removeFromPanel() -> dlController.doCommand("cmd_delete")');
		}
	},

	updateDownloadsContextMenu: function(popup) {
		_log("updateDownloadsContextMenu()");
		var dlItem = this.getDlNode(popup.triggerNode);
		var dlController = this.getDlController(dlItem);
		var dataItem = this.getDlDataItem(dlController);

		var miRef = popup.getElementsByAttribute("downloadPanelTweaker-command", "copyReferrer")[0];
		if(miRef) {
			var ref = this.getDlReferrer(dataItem);
			miRef.disabled = !ref;
			miRef.tooltipText = ref;
			var openRef = popup.getElementsByAttribute("command", "downloadsCmd_openReferrer")[0];
			if(openRef)
				openRef.tooltipText = ref;
		}
		var miRemove = popup.getElementsByAttribute("downloadPanelTweaker-command", "removeFile")[0];
		if(miRemove) {
			var exists = dlItem && dlItem.getAttribute("exists") == "true";
			var existsChecked = false;
			var window = popup.ownerDocument.defaultView;
			if(
				window.DownloadsViewItem
				&& window.DownloadsViewItem.prototype
				&& !("verifyTargetExists" in window.DownloadsViewItem.prototype)
				&& "localFile" in dataItem
			) try { // Firefox 20 and older
				_log("Will use dataItem.localFile.exists()");
				exists = dataItem.localFile.exists();
				existsChecked = true;
			}
			catch(e) {
				Components.utils.reportError(e);
			}
			miRemove.disabled = this.isActiveDownload(dataItem) || !exists;
			// "exists" attribute may be wrong for canceled downloads
			if(!existsChecked && !dataItem.openable) {
				_log("Will check anyway using OS.File.exists() (exists: " + exists + ")");
				var path = this.getDlPath(dataItem);
				Components.utils.import("resource://gre/modules/osfile.jsm");
				OS.File.exists(path).then(
					function onSuccess(exists) {
						_log("OS.File.exists(): " + exists);
						miRemove.disabled = this.isActiveDownload(dataItem) || !exists;
					}.bind(this),
					Components.utils.reportError
				);
			}
			window.setTimeout(function() {
				miRemove.tooltipText = miRemove.disabled ? "" : path || this.getDlPath(dataItem);
			}.bind(this), 0);
		}
		var copyLoc = popup.getElementsByAttribute("command", "downloadsCmd_copyLocation")[0];
		if(copyLoc)
			copyLoc.tooltipText = dataItem && (dataItem.uri || dataItem.source && dataItem.source.url) || "";
		var sep = popup.getElementsByAttribute("id", this.dpt.dp.ids.removeFileSep)[0];
		if(sep)
			sep.hidden = !this.hasVisibleNodeBefore(sep);
		this.updateClearDownloads(popup);
	},
	updateClearDownloads: function(popup) {
		_log("updateClearDownloads() in #" + popup.id);
		var cd = popup.getElementsByAttribute("downloadPanelTweaker-command", "clearDownloads")[0];
		cd.disabled = false;
		this.hasDlSessionHistoryAsync(function(hasSessionHistory) {
			if(hasSessionHistory) {
				_log("updateClearDownloads(): has session history");
				return;
			}
			if(this.hasDlHistory)
				_log("updateClearDownloads(): has persistent history");
			else
				cd.disabled = true;
		}, this);
	},
	isActiveDownload: function(dl) {
		var isActive = false;
		if("stopped" in dl && "canceled" in dl && "hasPartialData" in dl) {
			isActive = !dl.stopped // DOWNLOAD_DOWNLOADING
				|| dl.canceled && dl.hasPartialData; // DOWNLOAD_PAUSED
		}
		else { // Legacy
			var dm = Components.interfaces.nsIDownloadManager || {};
			switch(dl.state) {
				case dm.DOWNLOAD_DOWNLOADING || 0:
				case dm.DOWNLOAD_PAUSED      || 4:
				case dm.DOWNLOAD_QUEUED      || 5:
					isActive = true;
			}
		}
		_log("isActiveDownload(): " + isActive);
		return isActive;
	},
	hasVisibleNodeBefore: function(node) {
		for(var ps = node.previousSibling; ps; ps = ps.previousSibling)
			if(ps.boxObject.width && ps.boxObject.height)
				return true;
		return false;
	},
	hasDlSessionHistoryAsync: function(callback, context) {
		try {
			callback.call(context, Services.downloads.canCleanUp || Services.downloads.canCleanUpPrivate);
			return;
		}
		catch(e) { // Firefox 26+
		}
		var {Downloads} = Components.utils.import("resource://gre/modules/Downloads.jsm", {});
		Downloads.getList(Downloads.ALL).then(function(list) {
			var hasHistory = list._publicList._downloads.length > 0
				|| list._privateList._downloads.length > 0;
			callback.call(context, hasHistory);
		});
	},
	get hasDlHistory() {
		var {PlacesUtils} = Components.utils.import("resource://gre/modules/PlacesUtils.jsm", {});
		var query = PlacesUtils.history.getNewQuery();
		query.setTransitions([Components.interfaces.nsINavHistoryService.TRANSITION_DOWNLOAD], 1);
		var options = PlacesUtils.history.getNewQueryOptions();
		options.resultType = options.RESULTS_AS_URI;
		options.queryType = Components.interfaces.nsINavHistoryQueryOptions.QUERY_TYPE_HISTORY;
		options.includeHidden = true;
		options.maxResults = 1;
		var result = PlacesUtils.history.executeQuery(query, options);
		var contents = result.root;
		contents.containerOpen = true;
		return !!contents.childCount;
	},

	getDlNode: function(node) {
		for(; node; node = node.parentNode) {
			var ln = node.localName;
			if(ln == "panel")
				break;
			if(ln == "richlistitem") {
				if(node.getAttribute("type") == "download")
					return node;
				break;
			}
		}
		return null;
	},
	getDlController: function(node) {
		var dlItem = this.getDlNode(node);
		if(!dlItem)
			return null;
		if("_shell" in dlItem) // Firefox 47+
			return dlItem._shell;
		var window = dlItem.ownerDocument.defaultView;
		if(
			"DownloadsView" in window
			&& "controllerForElement" in window.DownloadsView // Firefox 38+
		)
			return window.DownloadsView.controllerForElement(dlItem);
		return new window.DownloadsViewItemController(dlItem);
	},
	getDlDataItem: function(dlController) {
		if(dlController && "parentNode" in dlController)
			dlController = this.getDlController(dlController);
		return dlController && (dlController.dataItem || dlController.download);
	},
	getDlPath: function(dataItem) {
		if("target" in dataItem && !("file" in dataItem))
			return dataItem.target && dataItem.target.path || dataItem.target;
		var path = dataItem.file;
		if(!path || typeof path != "string" || path.startsWith("file:/")) // Firefox 24 and older
			path = dataItem.localFile.path;
		return path;
	},
	getDlReferrer: function(dataItem) {
		return dataItem && (dataItem.referrer || dataItem.source && dataItem.source.referrer) || "";
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
	confirm: function(options) {
		var pref = options.pref;
		if(!prefs.get(pref))
			return true;
		var strings = {
			"dpt.confirm.title": "Download Panel Tweaker",
			"dpt.confirm.dontAskAgain": "Don't ask again"
		};
		strings[options.messageKey] = options.messageDefault;
		this.dpt.getEntities(["chrome://downloadpaneltweaker/locale/dpt.dtd"], strings);
		var message = strings[options.messageKey];
		if("messageReplace" in options)
			message = options.messageReplace(message);
		var window = options.window || Services.ww.activeWindow;
		this.toggleDownloadPanel(window, false);
		var dontAsk = { value: false };
		var ok = Services.prompt.confirmCheck(
			window,
			strings["dpt.confirm.title"],
			message,
			strings["dpt.confirm.dontAskAgain"],
			dontAsk
		);
		if(ok && dontAsk.value)
			prefs.set(pref, false);
		return ok;
	}
};