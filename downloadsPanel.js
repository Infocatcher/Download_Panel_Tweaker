// Tweaks for downloads panel
var downloadsPanel = {
	dpt: dpTweaker,

	handleEvent: function(e) {
		switch(e.type) {
			case "mouseover":    this.panelMouseOver(e); break;
			case "click":        this.panelClick(e);     break;
			case "keypress":     this.panelKeyPress(e);  break;
			case "popupshowing": this.popupShowing(e);   break;
			case "popuphidden":  this.panelHidden(e);    break;
			case "mousedown":    this.windowMouseDown(e);
		}
	},

	ids: {
		clearDownloads:      "downloadPanelTweaker-menuItem-contextClearDownloads",
		clearDownloadsPf:    "downloadPanelTweaker-menuItem-footerClearDownloads",
		clearDownloadsDd:    "downloadPanelTweaker-menuItem-dropdownClearDownloads",
		clearDownloadsDdSep: "downloadPanelTweaker-menuItem-dropdownClearDownloads-separator",
		copyReferrer:        "downloadPanelTweaker-menuItem-copyReferrer",
		removeFile:          "downloadPanelTweaker-menuItem-removeFile",
		removeFileSep:       "downloadPanelTweaker-menuItem-removeFile-separator",
		panelFooterContext:  "downloadPanelTweaker-popup-panelFooterContext",
		__proto__: null
	},
	origTtAttr: "downloadPanelTweaker_origTooltiptext",

	initPanel: function(document, popup) {
		_log("initPanel()");
		popup.addEventListener("click", this, true);
		popup.addEventListener("keypress", this, true);
		popup.addEventListener("mouseover", this, false);
		popup.addEventListener("popupshowing", this, false);
		popup.addEventListener("popuphidden", this, false);
		this.panelShowing(popup);
		if(prefs.get("menuButtonBehavior"))
			this.dpt.btn.menuPanelBehavior(popup, true);

		var labels = {
			"dpt.clearDownloads": "Clear Downloads",
			"dpt.clearDownloads.accesskey": "D",
			"dpt.copyReferrer": "Copy Download Page Link",
			"dpt.copyReferrer.accesskey": "P",
			"dpt.removeFile": "Remove File From Disk",
			"dpt.removeFile.accesskey": "F"
		};
		this.dpt.getEntities(["chrome://downloadpaneltweaker/locale/dpt.dtd"], labels);

		function mi(attrs) {
			var mi = document.createElement("menuitem");
			for(var attr in attrs)
				mi.setAttribute(attr, attrs[attr]);
			return mi;
		}
		function $(id) {
			return document.getElementById(id);
		}
		var clearDownloads = mi({
			id: this.ids.clearDownloads,
			label: labels["dpt.clearDownloads"],
			accesskey: labels["dpt.clearDownloads.accesskey"],
			"downloadPanelTweaker-command": "clearDownloads"
		});
		var copyReferrer = mi({
			id: this.ids.copyReferrer,
			label: labels["dpt.copyReferrer"],
			accesskey: labels["dpt.copyReferrer.accesskey"],
			"downloadPanelTweaker-command": "copyReferrer"
		});
		var removeFile = mi({
			id: this.ids.removeFile,
			label: labels["dpt.removeFile"],
			accesskey: labels["dpt.removeFile.accesskey"],
			"downloadPanelTweaker-command": "removeFile"
		});
		var removeFileSep = document.createElement("menuseparator");
		removeFileSep.id = this.ids.removeFileSep;

		var footer = $("downloadsFooter")
			|| $("downloadsHistory"); // Firefox 19 and older
		if(footer) {
			var footerContext = document.createElement("menupopup");
			footerContext.id = this.ids.panelFooterContext;
			var clearDownloadsPf = clearDownloads.cloneNode(true);
			clearDownloadsPf.id = this.ids.clearDownloadsPf;
			clearDownloadsPf.addEventListener("command", this.dpt, false);
			footerContext.appendChild(clearDownloadsPf);
			var popupSet = $("mainPopupSet") || document.documentElement;
			popupSet.appendChild(footerContext);
			if(footer.hasAttribute("context"))
				footer.setAttribute("downloadPanelTweaker-origContext", footer.getAttribute("context"));
			footer.setAttribute("context", this.ids.panelFooterContext);
			_log("Add context menu for download panel footer");
			footerContext.addEventListener("popupshowing", this, false);
		}

		var ddClearList = $("downloadsDropdownItemClearList");
		if(ddClearList) { // Firefox 51+
			var ddPopup = ddClearList.parentNode;
			var clearDownloadsDd = clearDownloads.cloneNode(true);
			clearDownloadsDd.id = this.ids.clearDownloadsDd;
			clearDownloadsDd.addEventListener("command", this.dpt, false);
			var insPos = ddClearList.nextSibling;
			ddPopup.insertBefore(clearDownloadsDd, insPos);
			if(insPos) {
				var sep = document.createElement("menuseparator");
				sep.id = this.ids.clearDownloadsDdSep;
				ddPopup.insertBefore(sep, insPos);
			}
			ddPopup.addEventListener("popupshowing", this, false);
		}

		var contextMenu = $("downloadsContextMenu");
		if(contextMenu) {
			var insert = function(item, insPos) {
				item.addEventListener("command", this.dpt, false);
				contextMenu.insertBefore(item, insPos && insPos.parentNode == contextMenu && insPos.nextSibling);
			}.bind(this);
			var removeFilePos = contextMenu.getElementsByClassName("downloadCommandsSeparator")[0];
			if(removeFilePos)
				removeFilePos = removeFilePos.previousSibling;
			insert(clearDownloads, contextMenu.getElementsByAttribute("command", "downloadsCmd_clearList")[0]);
			insert(copyReferrer, contextMenu.getElementsByAttribute("command", "downloadsCmd_copyLocation")[0]);
			insert(removeFile, removeFilePos);
			removeFile.parentNode.insertBefore(removeFileSep, removeFile);
			if(prefs.get("removeFile.groupWithRemoveFromHistory")) {
				var removeFromHistory = contextMenu.getElementsByAttribute("command", "cmd_delete")[0];
				if(removeFromHistory) {
					// Note: we may save link to our item here, so we should restore position
					// before removing of our items
					removeFromHistory._downloadPanelTweaker_previousSibling = removeFromHistory.previousSibling;
					removeFromHistory._downloadPanelTweaker_nextSibling = removeFromHistory.nextSibling;
					removeFile.parentNode.insertBefore(removeFromHistory, removeFile);
				}
			}
			contextMenu.addEventListener("popupshowing", this, false);
			_log("Add menu items to panel context menu");
		}
	},
	destroyPanel: function(document, force) {
		function $(id) {
			return document.getElementById(id);
		}
		var popup = $("downloadsPanel");
		if(popup) {
			popup.removeEventListener("click", this, true);
			popup.removeEventListener("keypress", this, true);
			popup.removeEventListener("mouseover", this, false);
			popup.removeEventListener("popupshowing", this, false);
			popup.removeEventListener("popuphidden", this, false);
			// Remove our tooltips, see this.da.updateDownloadsContextMenu()
			var copyLoc = popup.getElementsByAttribute("command", "downloadsCmd_copyLocation")[0];
			if(copyLoc)
				copyLoc.tooltipText = "";
			var openRef = popup.getElementsByAttribute("command", "downloadsCmd_openReferrer")[0];
			if(openRef)
				openRef.tooltipText = "";
			// Note: following may be not needed, looks like we somehow cause XBL binding reattaching
			force && this.restoreDlItemsTooltips(document, popup);
		}
		var contextMenu = $("downloadsContextMenu");
		if(contextMenu) {
			contextMenu.removeEventListener("popupshowing", this, false);
			var removeFromHistory = contextMenu.getElementsByAttribute("command", "cmd_delete")[0];
			if(removeFromHistory && "_downloadPanelTweaker_previousSibling" in removeFromHistory) {
				var ps = removeFromHistory._downloadPanelTweaker_previousSibling;
				var ns = removeFromHistory._downloadPanelTweaker_nextSibling;
				delete removeFromHistory._downloadPanelTweaker_previousSibling;
				delete removeFromHistory._downloadPanelTweaker_nextSibling;
				if(ps && ps.parentNode)
					ps.parentNode.insertBefore(removeFromHistory, ps.nextSibling);
				else if(ns && ns.parentNode)
					ns.parentNode.insertBefore(removeFromHistory, ns);
				else if(!ps)
					contextMenu.insertBefore(removeFromHistory, contextMenu.firstChild);
				else
					_log("Can't move \"Remove From History\" to original position!");
			}
		}
		var footer = $("downloadsFooter")
			|| $("downloadsHistory"); // Firefox 19 and older
		if(footer) {
			if(footer.hasAttribute("downloadPanelTweaker-origContext"))
				footer.setAttribute("context", footer.getAttribute("downloadPanelTweaker-origContext"));
			else
				footer.removeAttribute("context");
			var footerContext = $(this.ids.panelFooterContext);
			if(footerContext)
				footerContext.removeEventListener("popupshowing", this, false);
		}
		var ddClearList = $("downloadsDropdownItemClearList");
		if(ddClearList)
			ddClearList.parentNode.removeEventListener("popupshowing", this, false);

		for(var p in this.ids) {
			var node = $(this.ids[p]);
			if(!node)
				continue;
			if(node.hasAttribute("downloadPanelTweaker-command"))
				node.removeEventListener("command", this.dpt, false);
			force && node.parentNode.removeChild(node);
		}
	},

	panelMouseOver: function(e) {
		var trg = e.originalTarget;
		var isFileName = trg.classList.contains("downloadTarget")
			|| trg.classList.contains("downloadDisplayName"); // Pale Moon 28.1+
		if(
			!isFileName
			|| trg.hasAttribute(this.origTtAttr)
			|| !prefs.get("showFullPathInTooltip")
		)
			return;
		var window = e.view;
		window.setTimeout(function() {
			this.updateDlItemTooltip(trg);
		}.bind(this), 0);
	},
	updateDlItemTooltip: function(trg) {
		var dataItem = this.dpt.da.getDlDataItem(trg);
		var path = this.dpt.da.getDlPath(dataItem);
		var tt = trg.getAttribute("tooltiptext") || "";
		trg.setAttribute(this.origTtAttr, tt);
		trg.setAttribute("tooltiptext", path);
		_log("Change tooltiptext: " + tt + " => " + path);
	},
	restoreDlItemsTooltips: function(document, panel) {
		if(!panel)
			panel = document.getElementById("downloadsPanel");
		if(!panel)
			return;
		_log("restoreDlItemsTooltips()");
		Array.prototype.forEach.call(
			panel.getElementsByTagName("richlistitem"),
			function(rli) {
				var trg = document.getAnonymousElementByAttribute(rli, "class", "downloadTarget")
					|| document.getAnonymousElementByAttribute(rli, "class", "downloadDisplayName");  // Pale Moon 28.1+
				if(trg && trg.hasAttribute(this.origTtAttr)) {
					var tt = trg.getAttribute(this.origTtAttr);
					_log("Restore tooltiptext: " + trg.getAttribute("tooltiptext") + " => " + tt);
					trg.setAttribute("tooltiptext", tt);
					trg.removeAttribute(this.origTtAttr);
				}
			},
			this
		);
	},
	restoreAllDlItemsTooltips: function() {
		_log("restoreAllDlItemsTooltips()");
		for(var window of this.dpt.windows)
			this.restoreDlItemsTooltips(window.document);
	},

	panelClick: function(e) {
		if(e.button == 0)
			this.checkForReopenPanel(e);
		else if(e.button == 1)
			this.checkForClosePanel(e) || this.checkForDlClick(e);
	},
	panelKeyPress: function(e) {
		// See chrome://browser/content/downloads/downloads.js, DownloadsView.onDownloadKeyPress()
		var trg = e.originalTarget;
		var window = e.view;
		if(
			!trg.hasAttribute("command")
			&& !trg.hasAttribute("oncommand")
			&& e.keyCode == e.DOM_VK_RETURN
			&& window.document.activeElement // See DownloadsPanel._onKeyPress()
			&& window.document.activeElement.id == "downloadsListBox"
			&& prefs.get("reopenPanel.openFile")
		) {
			_log("panelKeyPress() -> reopenPanel()");
			this.reopenPanel(window);
		}
	},
	checkForReopenPanel: function(e) {
		var trg = e.originalTarget;
		if(
			// See chrome://browser/content/downloads/downloads.js, DownloadsView.onDownloadClick()
			!trg.hasAttribute("oncommand") // => goDoCommand("downloadsCmd_open")
				&& this.dpt.da.getDlNode(trg)
				&& prefs.get("reopenPanel.openFile")
			|| trg.classList.contains("downloadButton")
				&& trg.classList.contains("downloadShow")
				&& prefs.get("reopenPanel.openContainingFolder")
		) {
			_log("checkForReopenPanel() -> reopenPanel()");
			this.reopenPanel(e.view);
		}
	},
	checkForClosePanel: function(e) {
		if(!prefs.get("middleClickToClosePanel"))
			return false;
		var dlPopup = e.currentTarget;
		for(var node = e.originalTarget; node; node = node.parentNode) {
			if(node.localName == "menupopup")
				break;
			if(
				node == dlPopup && !prefs.get("middleClickToRemoveFromPanel")
				|| node.id == "downloadsFooter"
			) {
				_log("checkForClosePanel() -> hidePopup()");
				this.dpt.stopEvent(e);
				this.cancelReopenPanel(e.view);
				dlPopup.hidePopup();
				return true;
			}
			if(node == dlPopup)
				break;
		}
		return false;
	},
	checkForDlClick: function(e) {
		if(!prefs.get("middleClickToRemoveFromPanel"))
			return false;
		var dlController = this.dpt.da.getDlController(e.originalTarget);
		if(!dlController)
			return false;
		this.dpt.da.removeFromPanel(dlController, prefs.get("middleClickToRemoveFromPanel.clearHistory"));
		this.dpt.stopEvent(e);
		return true;
	},
	reopenPanel: function(window) {
		this.cancelReopenPanel(window);
		var DownloadsPanel = window.DownloadsPanel;
		DownloadsPanel._dptReopenPanelTimer = window.setTimeout(function() {
			var stopTime = Date.now() + prefs.get("reopenPanel.delayFallback");
			DownloadsPanel._dptReopenPanelTimer = window.setInterval(function() {
				if(Date.now() > stopTime)
					this.cancelReopenPanel(window);
				DownloadsPanel.showPanel();
			}.bind(this), 10);
		}.bind(this), prefs.get("reopenPanel.delay"));
		window.addEventListener("mousedown", this, true);
	},
	cancelReopenPanel: function(window) {
		var DownloadsPanel = window.DownloadsPanel;
		var timer = DownloadsPanel._dptReopenPanelTimer || 0;
		if(timer) {
			delete DownloadsPanel._dptReopenPanelTimer;
			window.clearTimeout(timer);
			window.clearInterval(timer);
			window.removeEventListener("mousedown", this, true);
		}
	},
	windowMouseDown: function(e) {
		_log(e.type + " -> cancelReopenPanel()");
		this.cancelReopenPanel(e.currentTarget);
	},

	popupShowing: function(e) {
		var popup = e.originalTarget;
		if(popup != e.currentTarget) // Ignore sub-popups
			return;
		var id = popup.id;
		if(id == "downloadsPanel")
			this.panelShowing(popup);
		else if(id == "downloadsContextMenu")
			this.dpt.da.updateDownloadsContextMenu(popup);
		else if(
			id == this.ids.panelFooterContext
			|| id == "downloadSubPanel"
		)
			this.dpt.da.updateClearDownloads(popup);
	},
	panelShowing: function(popup) {
		// Trick to correctly update height in Firefox 50+
		if(!prefs.get("fixPanelHeight"))
			return;
		var multiView = popup.getElementsByAttribute("id", "downloadsPanel-multiView")[0] || null;
		var mainView = multiView && multiView._mainView;
		var hasFlex = mainView && mainView.getAttribute("flex") == "1";
		if(hasFlex) {
			if(mainView.style.height)
				mainView.style.height = "";
			mainView.removeAttribute("flex");
			popup.ownerDocument.defaultView.setTimeout(function() {
				mainView.setAttribute("flex", "1");
			}, 0);
		}
	},

	panelCloseTime: 0,
	panelHidden: function(e) {
		this.panelCloseTime = Date.now();
	}
};