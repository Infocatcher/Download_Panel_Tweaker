// Tweaks for downloads panel
var downloadsPanel = {
	dpt: dpTweaker,

	handleEvent: function(e) {
		switch(e.type) {
			case "mouseover":   this.panelMouseOver(e); break;
			case "click":       this.panelClick(e);     break;
			case "popuphidden": this.panelHidden(e);
		}
	},

	clearDownloadsId: "downloadPanelTweaker-menuItem-clearDownloads",
	clearDownloads2Id: "downloadPanelTweaker-menuItem-clearDownloads2",
	copyReferrerId: "downloadPanelTweaker-menuItem-copyReferrer",
	removeFileId: "downloadPanelTweaker-menuItem-removeFile",
	removeFileSepId: "downloadPanelTweaker-menuItem-removeFile-separator",
	panelFooterContextId: "downloadPanelTweaker-popup-panelFooterContext",
	origTtAttr: "downloadPanelTweaker_origTooltiptext",
	initPanel: function(document, popup) {
		_log("initPanel()");
		popup.addEventListener("click", this, true);
		popup.addEventListener("mouseover", this, false);
		popup.addEventListener("popuphidden", this, false);
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

		var clearDownloads = this.createMenuItem(document, {
			id: this.clearDownloadsId,
			label: labels["dpt.clearDownloads"],
			accesskey: labels["dpt.clearDownloads.accesskey"],
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
		var removeFileSep = document.createElement("menuseparator");
		removeFileSep.id = this.removeFileSepId;
		removeFileSep.setAttribute("downloadPanelTweaker-command", "<nothing>");

		var footer = document.getElementById("downloadsFooter")
			|| document.getElementById("downloadsHistory"); // Firefox < 20
		if(footer) {
			var footerContext = document.createElement("menupopup");
			footerContext.id = this.panelFooterContextId;
			var clearDownloads2 = clearDownloads.cloneNode(true);
			clearDownloads2.id = this.clearDownloads2Id;
			clearDownloads2.addEventListener("command", this.dpt, false);
			footerContext.appendChild(clearDownloads2);
			var popupSet = document.getElementById("mainPopupSet") || document.documentElement;
			popupSet.appendChild(footerContext);
			if(footer.hasAttribute("context"))
				footer.setAttribute("downloadPanelTweaker-origContext", footer.getAttribute("context"));
			footer.setAttribute("context", this.panelFooterContextId);
			_log("Add context menu for download panel footer");
		}

		var contextMenu = document.getElementById("downloadsContextMenu");
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
			contextMenu.addEventListener("popupshowing", this.dpt, false);
			_log("Add menu items to panel context menu");
		}
	},
	destroyPanel: function(document, force) {
		var popup = document.getElementById("downloadsPanel");
		if(popup) {
			popup.removeEventListener("click", this, true);
			popup.removeEventListener("mouseover", this, false);
			popup.removeEventListener("popuphidden", this, false);
			// Note: following may be not needed, looks like we somehow cause XBL binding reattaching
			force && this.restoreDlItemsTooltips(document, popup);
		}
		var contextMenu = document.getElementById("downloadsContextMenu");
		if(contextMenu) {
			contextMenu.removeEventListener("popupshowing", this.dpt, false);
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
		var footer = document.getElementById("downloadsFooter")
			|| document.getElementById("downloadsHistory"); // Firefox < 20
		if(footer) {
			if(footer.hasAttribute("downloadPanelTweaker-origContext"))
				footer.setAttribute("context", footer.getAttribute("downloadPanelTweaker-origContext"));
			else
				footer.removeAttribute("context");
			var clearDownloads2 = document.getElementById(this.clearDownloads2Id);
			if(clearDownloads2)
				clearDownloads2.removeEventListener("command", this.dpt, false);
			var footerContext = document.getElementById(this.panelFooterContextId);
			if(footerContext && force)
				footerContext.parentNode.removeChild(footerContext);
		}
		Array.slice(document.getElementsByAttribute("downloadPanelTweaker-command", "*"))
			.forEach(function(mi) {
				mi.removeEventListener("command", this.dpt, false);
				force && mi.parentNode.removeChild(mi);
			}, this);
	},
	createMenuItem: function(document, attrs) {
		var mi = document.createElement("menuitem");
		for(var attr in attrs)
			mi.setAttribute(attr, attrs[attr]);
		return mi;
	},

	panelMouseOver: function(e) {
		var trg = e.originalTarget;
		if(
			!trg.classList.contains("downloadTarget")
			|| trg.hasAttribute(this.origTtAttr)
			|| !prefs.get("showFullPathInTooltip")
		)
			return;
		var window = trg.ownerDocument.defaultView;
		window.setTimeout(function() {
			this.updateDlItemTooltip(trg);
		}.bind(this), 0);
	},
	updateDlItemTooltip: function(trg) {
		var dlController = this.dpt.da.getDlController(trg);
		var dataItem = dlController.dataItem;
		var path = this.dpt.da.getDataItemPath(dataItem);
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
		Array.forEach(
			panel.getElementsByTagName("richlistitem"),
			function(rli) {
				var trg = document.getAnonymousElementByAttribute(rli, "class", "downloadTarget");
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
		for(var window in this.dpt.windows)
			this.restoreDlItemsTooltips(window.document);
	},

	panelClick: function(e) {
		if(e.button != 1 || !prefs.get("middleClickToRemoveFromPanel"))
			return;
		var dlController = this.dpt.da.getDlController(e.target);
		if(!dlController)
			return;
		this.dpt.da.removeFromPanel(dlController, prefs.get("middleClickToRemoveFromPanel.clearHistory"));
		this.dpt.stopEvent(e);
	},

	panelCloseTime: 0,
	panelHidden: function(e) {
		this.panelCloseTime = Date.now();
	}
};