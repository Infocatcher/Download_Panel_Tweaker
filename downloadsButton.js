// Tweaks for downloads button
var downloadsButton = {
	dpt: dpTweaker,

	getButton: function(window, id) {
		return window.document.getElementById(id)
			|| window.gNavToolbox.palette.getElementsByAttribute("id", id)[0];
	},
	tweakDlButton: function(window, tweak, forceDestroy, dlInd) {
		var dlBtn = dlInd || this.getButton(window, "downloads-button");
		if(!dlBtn) {
			_log("tweakDlButton(): button not found!");
			return;
		}
		_log("tweakDlButton(" + tweak + "): #" + dlBtn.id);
		if(this.dpt.fxVersion < 27 && !dlInd) {
			dlInd = this.getButton(window, "downloads-indicator");
			if(dlInd)
				this.tweakDlButton(window, tweak, forceDestroy, dlInd);
			if(!dlInd || !tweak && forceDestroy)
				this.waitForDlIndicator(window, dlBtn, tweak);
		}
		this.dontHighlightButton(window, dlBtn, tweak && prefs.get("dontHighlightButton"), forceDestroy);
	},
	waitForDlIndicator: function(window, dlBtn, wait) {
		// Wait for #downloads-indicator (Firefox 26 and older)
		var key = "_downloadPanelTweaker_mutationObserverWaitDlIndicator";
		if(wait == key in dlBtn)
			return;
		_log("waitForDlIndicator(" + wait + ")");
		if(wait) {
			var mo = dlBtn[key] = new window.MutationObserver(function(mutations) {
				var dlInd = this.getButton(window, "downloads-indicator");
				if(dlInd) {
					_log("waitForDlIndicator(): appears #downloads-indicator");
					delete dlBtn[key];
					mo.disconnect();
					this.tweakDlButton(window, true, false, dlInd);
				}
			}.bind(this));
			mo.observe(dlBtn, {
				attributes: true,
				attributeFilter: ["collapsed"]
			});
		}
		else {
			var mo = dlBtn[key];
			delete dlBtn[key];
			mo.disconnect();
		}
	},
	dontHighlightButton: function(window, dlBtn, dontHL, forceDestroy) {
		var key = "_downloadPanelTweaker_mutationObserverDontHL";
		if(dontHL == key in dlBtn)
			return;
		_log("dontHighlightButton(" + dontHL + ") #" + dlBtn.id);
		if(dontHL) {
			this.removeDlAttention(dlBtn);
			var mo = dlBtn[key] = new window.MutationObserver(function(mutations) {
				this.removeDlAttention(dlBtn);
			}.bind(this));
			mo.observe(dlBtn, {
				attributes: true,
				attributeFilter: ["attention"]
			});
		}
		else {
			var mo = dlBtn[key];
			delete dlBtn[key];
			mo.disconnect();
		}
	},
	removeDlAttention: function(dlBtn, force) {
		if(
			!dlBtn.hasAttribute("attention")
			|| "_downloadPanelTweaker_ignore" in dlBtn
		)
			return;
		dlBtn._downloadPanelTweaker_ignore = true;
		dlBtn.removeAttribute("attention");
		delete dlBtn._downloadPanelTweaker_ignore;
		_log('removeDlAttention(): remove "attention" attribute');
		var window = dlBtn.ownerDocument.defaultView;
		try {
			var dlData = window.DownloadsCommon.getIndicatorData(window);
			dlData.attentionSuppressed = true; // See DownloadsPanel.onPopupShown()
			//dlData._attentionSuppressed = dlData._attention = false;
			dlData.attentionSuppressed = false; // See DownloadsPanel.onPopupHidden()
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	}
};