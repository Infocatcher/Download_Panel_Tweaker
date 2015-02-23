// Things around "dontRemoveFinishedDownloads" preference
var downloadsEnhancements = {
	dontRemoveFinishedDownloads: function(patch) {
		// See https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5 for details
		var logPrefix = "dontRemoveFinishedDownloads(" + patch + "): ";
		try { // Firefox 26+
			// http://mxr.mozilla.org/mozilla-central/source/toolkit/components/jsdownloads/src/DownloadIntegration.jsm
			var {DownloadIntegration} = Components.utils.import("resource://gre/modules/DownloadIntegration.jsm", {});
			var dcg = Components.utils.import("resource:///modules/DownloadsCommon.jsm", {});
			var {DownloadsDataItem} = dcg;
			if(DownloadsDataItem && DownloadsDataItem.prototype) {
				var ddiPrototype = DownloadsDataItem.prototype;
				var updateFromDownloadProp = "updateFromDownload" in ddiPrototype && "updateFromDownload" // Firefox 28+
					|| "updateFromJSDownload" in ddiPrototype && "updateFromJSDownload";
				var updateFromDownloadKey = updateFromDownloadProp
					&& "DownloadsDataItem.prototype." + updateFromDownloadProp;
			}
			var {DownloadsDataCtor} = dcg;
			if(
				DownloadsDataCtor
				&& DownloadsDataCtor.prototype
				&& "onDownloadChanged" in DownloadsDataCtor.prototype
			) {
				var ddcPrototype = DownloadsDataCtor.prototype;
				var onDownloadChangedProp = "onDownloadChanged";
				var onDownloadChangedKey = "DownloadsDataCtor.prototype." + onDownloadChangedProp;
			}
		}
		catch(e) {
		}
		if(!DownloadIntegration || !("shouldPersistDownload" in DownloadIntegration)) {
			this.dontRemoveFinishedDownloadsLegacy(patch);
			return;
		}
		const bakKey = "_downloadPanelTweaker_shouldPersistDownload";
		if(patch == bakKey in DownloadIntegration)
			return;
		_log(logPrefix + "Will fix DownloadIntegration");
		var store = "_store" in DownloadIntegration && DownloadIntegration._store;
		if(patch) {
			DownloadIntegration[bakKey] = DownloadIntegration.shouldPersistDownload;
			var wrapped = DownloadIntegration.shouldPersistDownload = function downloadPanelTweakerWrapper(download) {
				//if(download.hasPartialData || !download.stopped)
				if(download.hasPartialData || !download.succeeded)
					return true;
				var retentionHours = prefs.get("downloadsMaxRetentionHours");
				if(retentionHours <= 0)
					return false;
				var older = Date.now() - retentionHours*60*60*1000;
				var minStore = prefs.get("downloadsMinStoreThreshold");
				if(minStore >= 0)
					minStore += prefs.get("itemCountLimit");
				if(minStore > 0 && DownloadIntegration._store) try {
					var dlArr = DownloadIntegration._store.list._downloads;
					var dlCount = dlArr.length;
					_dbgv && _log("DownloadIntegration._store.list._downloads.length: " + dlCount + ", min store: " + minStore);
					if(dlCount <= minStore)
						return true;
					if(dlCount) {
						// Assumed older...newest order
						var leaveTime = dlArr[Math.max(0, dlCount - 1 - minStore)].startTime;
						if(leaveTime < older) {
							older = leaveTime;
							_dbgv && _log("Override leave time to " + leaveTime);
						}
					}
				}
				catch(e) {
					Components.utils.reportError(e);
				}
				return download.startTime > older;
			};
			if(store) {
				_log(logPrefix + "Override DownloadStore.onsaveitem()");
				store[bakKey] = store.onsaveitem;
				store.onsaveitem = wrapped;
			}
			if(updateFromDownloadKey) {
				_log(logPrefix + "Patch " + updateFromDownloadKey + "()");
				patcher.wrapFunction(ddiPrototype, updateFromDownloadProp, updateFromDownloadKey,
					function before() {},
					this.fixUpdateFromDownload
				);
			}
			else if(onDownloadChangedKey) {
				_log(logPrefix + "Patch " + onDownloadChangedKey + "()");
				patcher.wrapFunction(ddcPrototype, onDownloadChangedProp, onDownloadChangedKey,
					this.fixOnDownloadChanged.bind(this)
				);
			}
			if(store && "_cleanupDownloads" in this) try { // See migratePrefs()
				delete this._cleanupDownloads;
				_log(logPrefix + "Try cleanup downloads.json");
				store.save();
			}
			catch(e) {
				Components.utils.reportError(e);
			}
		}
		else {
			var orig = DownloadIntegration[bakKey];
			DownloadIntegration.shouldPersistDownload = orig;
			delete DownloadIntegration[bakKey];
			if(store) {
				_log(logPrefix + "Restore DownloadStore.onsaveitem()");
				store.onsaveitem = store[bakKey] || orig;
				delete store[bakKey];
			}
			if(updateFromDownloadKey) {
				_log(logPrefix + "Restore " + updateFromDownloadKey + "()");
				patcher.unwrapFunction(ddiPrototype, updateFromDownloadProp, updateFromDownloadKey);
			}
			else if(onDownloadChangedKey) {
				_log(logPrefix + "Restore " + onDownloadChangedKey + "()");
				patcher.unwrapFunction(ddcPrototype, onDownloadChangedProp, onDownloadChangedKey);
			}
		}
		if(dcg && updateFromDownloadKey) {
			if(patch) delay(function() {
				this.fixLoadDownloadsPerformance(dcg, patch);
			}, this);
			else { // No delay because patcher will be destroyed
				this.fixLoadDownloadsPerformance(dcg, patch);
			}
		}
	},
	fixUpdateFromDownload: function(dl) {
		// this == DownloadsDataItem instance (or download itself in Firefox 38+)
		dl = this._download || dl;
		if(!dl)
			return;
		if(dl.succeeded) {
			var path = dl.target && dl.target.path || dl.target;
			if(!(this.maxBytes > 0)) { // Also detects NaN
				var maxBytes = Math.max(dl.totalBytes || 0, dl.currentBytes || 0);
				if(maxBytes > 0) {
					_dbgv && _log("updateFromDownload(): fix size for " + path + ": " + maxBytes);
					this.maxBytes = maxBytes;
				}
			}
			if(
				this.endTime
				&& Date.now() - this.endTime < 300
				&& dl.startTime
			) {
				var time = dl != this && dl.endTime // Missing for now in Firefox 37.0a1 (2014-12-25)
					|| dl.startTime;
				var ts = new Date(time).getTime();
				if(ts > 0) {
					_dbgv && _log("updateFromDownload(): fix time for " + path + ": " + time);
					this.endTime = ts;
				}
			}
		}
		// Suppress notifications, see _updateDataItemState() in
		// resource:///modules/DownloadsCommon.jsm
		if(
			!this.newDownloadNotified && (
				dl.succeeded
				|| dl.canceled && ( // Paused downloads also have hasPartialData == true
					!dl.hasPartialData
					|| prefs.get("suppressPausedDownloadsNotifications")
				)
				|| dl.error && prefs.get("suppressFailedDownloadsNotifications")
			)
		)
			this.newDownloadNotified = true;
	},
	fixOnDownloadChanged: function(download) {
		this.fixUpdateFromDownload.call(download, download);
	},
	dontRemoveFinishedDownloadsLegacy: function(patch) {
		const bakKey = "_downloadPanelTweaker_downloads";
		const newKey = "_downloadPanelTweaker_downloadsWrapper";
		if(patch == bakKey in Services)
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
	fixLoadDownloads: function(fix) {
		try { // Firefox 26+
			var {DownloadStore} = Components.utils.import("resource://gre/modules/DownloadStore.jsm", {});
		}
		catch(e) {
		}
		if(
			DownloadStore
			&& "prototype" in DownloadStore
			&& "load" in DownloadStore.prototype
		) {
			var dsp = DownloadStore.prototype;
			var bakKey = "_downloadPanelTweaker_load";
			if(fix == bakKey in dsp)
				return;
			_log("fixLoadDownloads(" + fix + ")");
			if(fix) {
				dsp[bakKey] = dsp.load;
				dsp.load = this.loadDownloads;
			}
			else {
				dsp.load = dsp[bakKey];
				delete dsp[bakKey];
			}
		}
	},
	fixLoadDownloadsPerformance: function(dcg, fix) {
		if(fix && !prefs.get("fixDownloadsLoadingPerformance"))
			return;
		this.fixUpdateViews(dcg, fix);
		this.fixOnDownloadAdded(dcg, fix);
	},
	fixUpdateViews: function(dcg, fix) {
		// Create proxy for _updateViews(), see resource:///modules/DownloadsCommon.jsm
		var didcPrototype = "DownloadsIndicatorDataCtor" in dcg
			&& "prototype" in dcg.DownloadsIndicatorDataCtor
			&& "_updateViews" in dcg.DownloadsIndicatorDataCtor.prototype
			&& dcg.DownloadsIndicatorDataCtor.prototype;
		var key = "DownloadsIndicatorDataCtor.prototype._updateViews";
		if(!didcPrototype) {
			_log(key + "() not found!");
			return;
		}
		_log("fixUpdateViews(" + fix + ")");
		if(fix) {
			var pending = "_downloadPanelTweaker_pending";
			var updateViews = didcPrototype._updateViews;
			patcher.wrapFunction(didcPrototype, "_updateViews", key,
				function before() {
					_dbgv && _log(key + "() called");
					if(pending in this)
						return true;
					this[pending] = true;
					var args = arguments;
					delay(function() {
						delete this[pending];
						_dbgv && _log(key + "()");
						updateViews.apply(this, args);
					}, this);
					return true;
				}
			);
		}
		else {
			patcher.unwrapFunction(didcPrototype, "_updateViews", key);
		}
	},
	fixOnDownloadAdded: function(dcg, fix) {
		// Make onDownloadAdded() async, see resource:///modules/DownloadsCommon.jsm
		var ddcPrototype = "DownloadsDataCtor" in dcg
			&& "prototype" in dcg.DownloadsDataCtor
			&& "onDownloadAdded" in dcg.DownloadsDataCtor.prototype
			&& dcg.DownloadsDataCtor.prototype;
		var key = "DownloadsDataCtor.prototype.onDownloadAdded";
		if(!ddcPrototype) {
			_log(key + "() not found!");
			return;
		}
		_log("fixOnDownloadAdded(" + fix + ")");
		if(fix) {
			var onDownloadAdded = ddcPrototype.onDownloadAdded;
			patcher.wrapFunction(ddcPrototype, "onDownloadAdded", key,
				function before() {
					var args = arguments;
					delay(function() {
						_dbgv && _log(key + "()");
						onDownloadAdded.apply(this, args);
					}, this);
					return true;
				}
			);
		}
		else {
			patcher.unwrapFunction(ddcPrototype, "onDownloadAdded", key);
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

	loadDownloads: function() {
		// Based on code from resource://gre/modules/DownloadStore.jsm, Firefox 30.0a1 (2014-02-16)
		// Correctly load large data, see
		// https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5#issuecomment-35358879
		_log("loadDownloads()");
		return {then: function(onSuccess, onFailure) {
			_log("loadDownloads(): start task");
			var startTime = Date.now();
			function onReadFailure(ex) {
				if(ex instanceof OS.File.Error && ex.becauseNoSuchFile) {
					_log("loadDownloads(): file not found");
					onSuccess && onSuccess();
				}
				else {
					onFailure && onFailure(ex);
				}
			}
			var list = this.list;
			var path = this.path;
			var {OS} = Components.utils.import("resource://gre/modules/osfile.jsm", {});
			OS.File.read(path).then(
				function onReadSuccess(bytes) {
					if(!bytes) {
						_log("loadDownloads(): empty file");
						onSuccess && onSuccess();
						return;
					}
					// We don't have TextDecoder in our global object...
					var TextDecoder = Components.utils.getGlobalForObject(OS).TextDecoder;
					var json = new TextDecoder().decode(bytes);
					_log("loadDownloads(): read downloads.json in " + (Date.now() - startTime) + " ms");
					startTime = Date.now();
					var storeData = JSON.parse(json);
					_log("loadDownloads(): parse data from downloads.json in " + (Date.now() - startTime) + " ms");
					startTime = Date.now();
					var data = storeData.list;
					var {Download} = Components.utils.import("resource://gre/modules/DownloadCore.jsm", {});
					var maxIndex = data.length - 1;
					data.forEach(function(downloadData, i) {
						delay(function() {
							var download = Download.fromSerializable(downloadData);
							try {
								if(!download.succeeded && !download.canceled && !download.error)
									download.start();
								else
									download.refresh();
							}
							finally {
								delay(function() {
									list.add(download);
									//_log("list.add() " + i);
									if(i == maxIndex) {
										_log("loadDownloads(): delayed part done in " + (Date.now() - startTime) + " ms");
										onSuccess && onSuccess();
									}
								}, this);
							}
						}, this);
					});
					_log("loadDownloads(): main part done in " + (Date.now() - startTime) + " ms, count: " + data.length);
				},
				onReadFailure
			).then(null, onReadFailure);
		}.bind(this)};
	},
	saveDownloads: function() {
		try { // Firefox 26+
			var {DownloadIntegration} = Components.utils.import("resource://gre/modules/DownloadIntegration.jsm", {});
			if(DownloadIntegration._store) {
				DownloadIntegration._store.save();
				_log("saveDownloads()");
			}
		}
		catch(e) {
			if(!DownloadIntegration)
				Components.utils.reportError(e);
		}
	}
};