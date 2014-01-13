#### Download Panel Tweaker: Changelog

`+` - added<br>
`-` - deleted<br>
`x` - fixed<br>
`*` - improved<br>

##### master/HEAD
`+` Added ability to configure actions for downloads command, hotkey (Ctrl+J) and “Show All Downloads” button (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/10">#10</a>).<br> 
`+` Added workaround for line between Navigation and Bookmarks toolbars (<em>extensions.downloadPanelTweaker.fixWrongTabsOnTopAttribute</em> preference) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/3">#3</a>).<br>
`x` Fixed: download panel width option doesn't works with <a href="https://addons.mozilla.org/firefox/addon/nasa-night-launch/">NASA Night Launch</a> theme (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/4">#4</a>).<br>
`*` Improved startup performance.<br>
`x` Correctly set small progress bar height.<br>
`+` Added ability to not remove finished downloads from panel (+ hidden <em>extensions.downloadPanelTweaker.downloadsMaxRetentionDays</em> preference) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5">#5</a>).<br>
`+` Added very compact style for downloads list (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/7">#7</a>).<br>
`*` Improved styles for downloads list.<br>
`+` Added “Clear Downloads” menu item to panel context menu (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/8">#8</a>).<br>
`x` Correctly update download panel in Firefox 28+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/13">#13</a>).<br>
`+` Hide option for <em>browser.download.useToolkitUI</em> in Firefox 26+ (doesn't work anymore, see <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=845403">bug 845403</a>).<br>
`+` Added Greek (el) locale, thanks to <a href="http://forums.mozillazine.org/memberlist.php?mode=viewprofile&u=1595963">Grg68</a>.<br>

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