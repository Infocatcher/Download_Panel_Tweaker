#### Download Panel Tweaker: Changelog

`+` - added<br>
`-` - deleted<br>
`x` - fixed<br>
`*` - improved<br>

##### master/HEAD
`x` Fixed compatibility with Firefox 38+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/34">#34</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/35">#35</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/36">#36</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/37">#37</a>).<br>
`+` Added Chinese Simplified (zh-CN) locale, thanks to <a href="https://github.com/fang5566">fang5566</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/pull/38">#38</a>).<br>

##### 0.2.3 (2015-02-16)
`+` Added ability to always leave last downloads in panel, even very old ones (<em>extensions.downloadPanelTweaker.downloadsMinStoreThreshold</em> preference) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/28">#28</a>).<br>
`x` Fixed “Decolorize progress bar of paused downloads” option in Firefox 36+.<br>
`*` Slightly improved shutdown performance around “Don't remove finished downloads” option (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/29">#29</a>).<br>
`+` Added experimental (and disabled by default) ability to reopen panel after open file or containing folder (<em>extensions.downloadPanelTweaker.reopenPanel.</em>\* preferences) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/18">#18</a>).<br>
`*` Improved startup performance: code around styles was moved into lazily loaded separate file (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/31">#31</a>).<br>
`x` Fixed handling of downloads inside panel in Firefox 38+.<br>

##### 0.2.2 (2014-09-03)
`+` Added ability to not highlight toolbar button with new finished downloads (disabled by default) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/23">#23</a>).<br>
`+` Added ability to open panel right after mouse down on download button (just like regular menus) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/25">#25</a>).<br>
`*` Improved startup performance: code for download panel modifications was moved into lazily loaded separate file (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/26">#26</a>).<br>

##### 0.2.1 (2014-06-04)
`+` Added ability to remove downloads from panel using middle-click (disabled by default) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/9">#9</a>).<br>
`+` Suppress notifications about adding of failed downloads (only if saved finished downloads, <em>extensions.downloadPanelTweaker.suppressFailedDownloadsNotifications</em> preference).<br>
`+` Added “Copy Download Page Link” item to panel context menu (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/14">#14</a>).<br>
`+` Added “Remove File From Disk” item to panel context menu (hidden preferences: <em>extensions.downloadPanelTweaker.removeFile.clearHistory</em> to also remove from panel/history, <em>extensions.downloadPanelTweaker.removeFile.removeFilesDirectoryForHTML</em> to also remove \*\_files folders for \*.html files and <em>extensions.downloadPanelTweaker.removeFile.confirm</em> to disable confirmation) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/15">#15</a>).<br>
`x` Fixed: correctly close downloads sidebar from <a href="https://addons.mozilla.org/addon/omnisidebar/">OmniSidebar</a> extension (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/21">#21</a>).<br>
`+` Added ability to show full patch to file in tooltip for file name (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/22">#22</a>).<br>
`+` Added confirmation dialog to “Clear Downloads” command (<em>extensions.downloadPanelTweaker.clearDownloads.confirm</em> preference).<br>
`*` Improved startup performance: code around various download actions was moved into lazily loaded separate file (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/24">#24</a>).<br>

##### 0.2.0 (2014-02-28)
`+` Added ability to configure actions for downloads command, hotkey (Ctrl+J) and “Show All Downloads” button (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/10">#10</a>).<br>
`+` Added workaround for line between Navigation and Bookmarks toolbars (<em>extensions.downloadPanelTweaker.fixWrongTabsOnTopAttribute</em> preference) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/3">#3</a>).<br>
`x` Fixed: download panel width option doesn't work with <a href="https://addons.mozilla.org/firefox/addon/nasa-night-launch/">NASA Night Launch</a> theme (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/4">#4</a>).<br>
`*` Improved startup performance.<br>
`x` Correctly set small progress bar height.<br>
`+` Added ability to not remove finished downloads from panel (<em>extensions.downloadPanelTweaker.dontRemoveFinishedDownloads</em> preference + see <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/blob/master/defaults/preferences/prefs.js">defaults/preferences/prefs.js</a> for some hidden preferences) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5">#5</a>).<br>
`+` Added very compact style for downloads list (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/7">#7</a>).<br>
`*` Improved styles for downloads list.<br>
`+` Added “Clear Downloads” menu item to panel context menu (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/8">#8</a>).<br>
`x` Correctly update download panel in Firefox 28+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/13">#13</a>).<br>
`+` Hide option for <em>browser.download.useToolkitUI</em> in Firefox 26+ (doesn't work anymore, see <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=845403">bug 845403</a>).<br>
`+` Added ability to limit download panel height (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/20">#20</a>).<br>
`+` Added Greek (el) locale, thanks to <a href="http://forums.mozillazine.org/memberlist.php?mode=viewprofile&u=1595963">Grg68</a> (translation isn't complete, sorry).<br>

##### 0.1.0 (2013-05-29)
`*` Published on <a href="https://addons.mozilla.org/">AMO</a>, first stable release.<br>

##### 0.1.0pre6 (2013-05-02)
`+` Added support for about:downloads<br>
`*` Improved support for “+ N other downloads” (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/1">#1</a>).<br>
`*` Renamed preference: <em>extensions.downloadPanelTweaker.detailedText</em> -> <em>extensions.downloadPanelTweaker.showDownloadRate</em> (be careful!).<br>
`*` Better handle preferences changes: wait, while user typed new value.<br>

##### 0.1.0pre5 (2013-04-28)
`*` Patcher: improved compatibility with "use strict" directive.<br>
`x` Fixed memory leak (due to not restored patches from closing windows).<br>

##### 0.1.0pre4 (2013-04-27)
`*` Published on GitHub.<br>