var downloadsStyles = {
	dpt: dpTweaker,

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
		this.loadStyleFile("compactDownloads.css", "_compactStyleLoaded", compact == 1);
		this.loadStyleFile("compactDownloadsForce.css", "_forceCompactStyleLoaded", compact == 2);
	},
	loadStyleFile: function(file, key, load) {
		if(load == this[key])
			return;
		this[key] = load;
		this.loadSheet(Services.io.newURI("chrome://downloadpaneltweaker/content/" + file, null, null), load);
		_log((load ? "Load" : "Unload") + " " + file);
	},
	_tweakStyleLoaded: false,
	tweakCssURI: null,
	minPanelWidth: 5,
	minPanelHeight: 30,
	minProgressBarHeight: 6,
	maxProgressBarHeight: 50,
	loadTweakStyle: function(add) {
		if(add == this._tweakStyleLoaded)
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
			var containerSelector = this.dpt.fxVersion >= 20
				? ".downloadContainer"
				: ".download-state > vbox";
			var window = Services.wm.getMostRecentWindow(null);
			var tdsPrefix = window && "textDecorationStyle" in window.document.documentElement.style
				? ""
				: "-moz-";
			var grayscaleFilter = this.dpt.fxVersion >= 36
				? "grayscale(1)"
				: 'url("chrome://mozapps/skin/extensions/extensions.svg#greyscale")';
			var cssStr = '\
				/* Download Panel Tweaker */\n\
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n\
				@-moz-document url("chrome://browser/content/browser.xul"),\n\
					url("chrome://browser/content/places/places.xul"),\n\
					url("about:downloads"),\n\
					url("chrome://browser/content/downloads/contentAreaDownloadsView.xul") {\n\
					#downloadsListBox {\n\
						/* Set width for Firefox 19 and older and NASA Night Launch theme */\n\
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
					#downloadsSummary[' + this.dpt.pausedAttr + '] .downloadProgress {\n\
						filter: ' + grayscaleFilter + ';\n\
					}\n\
					.download-state[state="4"] .downloadProgress > .progress-bar,\n\
					.download-state[state="4"] .downloadProgress > .progress-remainder,\n\
					#downloadsSummary[' + this.dpt.pausedAttr + '] .downloadProgress > .progress-bar,\n\
					#downloadsSummary[' + this.dpt.pausedAttr + '] .downloadProgress > .progress-remainder {\n\
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
					.downloadPanelTweaker-indent .preferences-title {\n\
						-moz-margin-start: 4ch !important;\n\
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
		if(load == sss.sheetRegistered(cssURI, sss.USER_SHEET))
			return;
		if(load)
			sss.loadAndRegisterSheet(cssURI, sss.USER_SHEET);
		else
			sss.unregisterSheet(cssURI, sss.USER_SHEET);
	}
};