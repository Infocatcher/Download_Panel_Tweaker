#### Download Panel Tweaker: История изменений

`+` - добавлено<br>
`-` - удалено<br>
`x` - исправлено<br>
`*` - улучшено<br>

##### master/HEAD
`+` Добавлена возможность настроить действия для команды загрузок, сочетания клавиш (Ctrl+J) и кнопки «Показать все загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/10">#10</a>).<br> 
`+` Добавлен workaround для исправления полоски между панелями навигации и закладок (настройка <em>extensions.downloadPanelTweaker.fixWrongTabsOnTopAttribute</em>) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/3">#3</a>).<br>
`x` Исправлено: настройка ширины панели загрузок не работала с темой <a href="https://addons.mozilla.org/firefox/addon/nasa-night-launch/">NASA Night Launch</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/4">#4</a>).<br>
`*` Улучшена производительность при запуске.<br>
`x` Исправлена установка маленькой высоты полосы прогресса.<br>
`+` Добавлена возможность не удалять завершенные загрузки из панели (+ скрытая настройка <em>extensions.downloadPanelTweaker.downloadsMaxRetentionDays</em>) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5">#5</a>).<br>
`+` Добавлен очень компактный стиль для списка загрузок (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/7">#7</a>).<br>
`*` Улучшены стили для списка загрузок.<br>
`+` В контекстное меню панели загрузок добавлен пункт «Очистить загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/8">#8</a>).<br>
`x` Исправлено обновление панели загрузок в Firefox 28+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/13">#13</a>).<br>
`+` Настройка <em>browser.download.useToolkitUI</em> теперь скрывается в Firefox 26+ (больше не работает, см. <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=845403">bug 845403</a>).<br>
`+` Добавлена греческая (el) локаль, спасибо <a href="http://forums.mozillazine.org/memberlist.php?mode=viewprofile&u=1595963">Grg68</a>.<br>

##### 0.1.0 (2013-05-29)
`*` Опубликовано на <a href="https://addons.mozilla.org/">AMO</a>, первый стабильный релиз.<br>

##### 0.1.0pre6 (2013-05-02)
`+` Добавлена поддержка about:downloads.<br>
`*` Улучшена поддержка для пункта «ещё N загрузок» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/1">#1</a>).<br>
`*` Переименована настройка: <em>extensions.downloadPanelTweaker.detailedText</em> -> <em>extensions.downloadPanelTweaker.showDownloadRate</em> (будьте внимательны!).<br>
`*` Улучшена обработка изменений настроек: добавлено ожидание, пока пользователь вводит новое значение.<br>

##### 0.1.0pre5 (2013-04-28)
`*` Патчер: улучшена совместимость с директивой "use strict".<br>
`x` Исправлена утечка памяти (из-за не восстановленных патчей из закрывающихся окон).<br>

##### 0.1.0pre4 (2013-04-27)
`*` Опубликовано на GitHub.<br>