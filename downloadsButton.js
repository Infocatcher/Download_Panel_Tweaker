// Tweaks for downloads button
var downloadsButton = {
	dpt: dpTweaker,

	handleEvent: function(e) {
		switch(e.type) {
			case "mousedown": this.handleMouseDown(e); break;
			case "mouseup":   this.handleMouseUp(e);
		}
	},

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
		this.menuButtonBehavior(window, dlBtn, tweak && prefs.get("menuButtonBehavior"), forceDestroy);
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
			var mo = dlBtn[key] = new window.MutationObserver(this.onDlAttentionChanged);
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
	get onDlAttentionChanged() {
		delete this.onDlAttentionChanged;
		return this.onDlAttentionChanged = function(mutations) {
			var dlBtn = mutations[0].target;
			this.removeDlAttention(dlBtn);
		}.bind(this);
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
	},
	menuButtonBehavior: function(window, dlBtn, enable, forceDestroy) {
		if(enable)
			dlBtn.addEventListener("mousedown", this, false);
		else
			dlBtn.removeEventListener("mousedown", this, false);
		var panel = window.document.getElementById("downloadsPanel");
		panel && this.menuPanelBehavior(panel, enable);
	},
	menuPanelBehavior: function(panel, enable) {
		if(enable)
			panel.addEventListener("mouseup", this, true);
		else
			panel.removeEventListener("mouseup", this, true);
	},
	handleMouseDown: function(e) {
		if(e.button != 0 || e.target != e.currentTarget)
			return;
		var window = e.view;
		_log(e.type + " on #" + e.target.id + " => toggleDownloadPanel()");
		// Note: we can't hide panel after double click (due to opening animation?)
		this.dpt.da.toggleDownloadPanel(window);
		this.dpt.stopEvent(e);
	},
	handleMouseUp: function(e) {
		if(e.button != 0)
			return;
		var trg = e.originalTarget;
		var panel = e.currentTarget;
		var window = panel.ownerDocument.defaultView;
		var nativeEvent = false;
		function waitNativeEvent(e) {
			_dbgv && _log(e.type + " in #" + panel.id + " => do nothing");
			destroy();
			nativeEvent = true;
		}
		function destroy() {
			window.removeEventListener("click", waitNativeEvent, true);
			window.removeEventListener("command", waitNativeEvent, true);
			window.clearTimeout(timer);
		}
		window.addEventListener("click", waitNativeEvent, true);
		window.addEventListener("command", waitNativeEvent, true);
		var timer = window.setTimeout(function() {
			destroy();
			if(nativeEvent)
				return;
			for(var node = trg; node && node != panel; node = node.parentNode) {
				if(node.hasAttribute("command") || node.hasAttribute("oncommand")) {
					_log(e.type + " in #" + panel.id + " => doCommand()");
					trg.doCommand();
					return;
				}
			}
			_log(e.type + " in #" + panel.id + " => click()");
			trg.click();
		}, 0);
	}
};