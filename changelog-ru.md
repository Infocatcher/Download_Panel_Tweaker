#### Download Panel Tweaker: История изменений

`+` - добавлено<br>
`-` - удалено<br>
`x` - исправлено<br>
`*` - улучшено<br>

##### master/HEAD
`x` Исправлена совместимость с будущими версиями Firefox: прекращено использование Array generics вида `Array.forEach()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1222547">bug 1222547</a>).<br>
`x` Исправлен патчер при наличии оберток от других расширений (TypeError: Array is undefined) (<a href="https://forum.mozilla-russia.org/viewtopic.php?pid=728469#p728469">спасибо Dumby</a>).<br>
`x` Исправлена совместимость с будущими версиями Firefox: прекращено использование `Date.prototype.toLocaleFormat()` (<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=818634">bug 818634</a>).<br>
`x` Исправлено удаление оберток для функций из других расширений в Firefox 45+ (теперь для расширений используется «песочница», и будет использован трюк для получения ссылки на актуальный объект `window` для сохранения внутренних данных).<br>

##### 0.2.6 (2016-11-08)
`x` Исправлена совместимость с Firefox 51+ (SyntaxError: non-generator method definitions may not contain yield).<br>
`x` Исправлена работа настройки «Удалять загрузки из панели по клику средней кнопкой мыши» в Firefox 38+.<br>
`x` Исправлено обновление высоты панели в Firefox 50+ (настройка <em>extensions.downloadPanelTweaker.fixPanelHeight</em>).<br>
`+` Добавлен трюк для принудительной блокировки ложных оповещений о загрузках при запуске (настройка <em>extensions.downloadPanelTweaker.suppressDownloadsNotificationsAtStartup</em>, задержка от запуска до включения оповещений, в миллисекундах).<br>
`x` Исправления для совместимости с мультипроцессным режимом (Electrolysis aka e10s) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/32">#32</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/33">#33</a>).<br>
`x` Исправлена настройка «Не удалять завершённые загрузки» в Firefox 49+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/47">#47</a>).<br>
`x` Откорректированы «Компактный» и «Очень компактный» стили в Firefox 52+ (также подкорректирован вид нижней части панели загрузок в Firefox 50+) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/48">#48</a>).<br>
`+` Добавлен пункт «Очистить загрузки» в меню нижней части панели загрузок (Firefox 51+) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/50">#50</a>).<br>
`x` Исправлено: скрытая панель меню показывалась при открытии настроек (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/49">#49</a>).<br>
`x` Исправлено переопределение действия кнопки «Показать все загрузки» в Firefox 50+.<br>
`x` Исправлено закрытие панели кликом средней кнопки мыши в Firefox 50+ (настройка <em>extensions.downloadPanelTweaker.middleClickToClosePanel</em>).<br>
`*` Пункт меню «Очистить загрузки» теперь отключается в случае пустой истории загрузок.<br>
`*` Панель загрузок теперь открывается под адресной строкой, если кнопка загрузок скрыта (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/51">#51</a>).<br>

##### 0.2.5 (2016-06-10)
`x` Исправлена работа при выключенной настройке «Также удалять из истории» в Firefox 38+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/39">#39</a>).<br>
`x` Исправлена обработка элементов панели загрузок в Firefox 47+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/41">#41</a>).<br>
`+` Добавлена французская (fr) локаль, спасибо <a href="https://github.com/charlesmilette">Charles Milette</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/pull/40">#40</a>).<br>
`+` Добавлено <a href="https://github.com/Infocatcher/Download_Panel_Tweaker#api">API-событие</a> `DownloadPanelTweaker:OpenDownloadTab`.<br>

##### 0.2.4 (2015-05-11)
`x` Исправлена совместимость с Firefox 38+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/34">#34</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/35">#35</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/36">#36</a>, <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/37">#37</a>).<br>
`+` Добавлена Chinese Simplified (zh-CN) локаль, спасибо <a href="https://github.com/fang5566">fang5566</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/pull/38">#38</a>).<br>
`*` Улучшена страница настроек: «Также удалять из истории» будет заблокирован при снятии галочки с родительского пункта.<br>
`+` Добавлены всплывающие подсказки для пунктов контекстного меню «Перейти на страницу загрузки» и «Копировать ссылку на загрузку».<br>

##### 0.2.3 (2015-02-16)
`+` Добавлена возможность всегда сохранять последние загрузки в панели, даже если они очень старые (настройка <em>extensions.downloadPanelTweaker.downloadsMinStoreThreshold</em>) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/28">#28</a>).<br>
`x` Исправлена настройка «Обесцвечивать полосу прогресса приостановленных загрузок» в Firefox 36+.<br>
`*` Немного улучшена производительность при закрытии браузера при использовании настройки «Не удалять завершённые загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/29">#29</a>).<br>
`+` Добавлена экспериментальная (и по умолчанию выключенная) возможность переоткрывать панель после открытия файла или папки с файлом (настройки <em>extensions.downloadPanelTweaker.reopenPanel.</em>\*) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/18">#18</a>).<br>
`*` Улучшена производительность при запуске: код для применения стилей перемещен в отдельный лениво загружаемый файл (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/31">#31</a>).<br>
`x` Исправлена обработка загрузок в панели в Firefox 38+.<br>

##### 0.2.2 (2014-09-03)
`+` Добавлена возможность не подсвечивать кнопку с новыми завершенными загрузками (по умолчанию отключено) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/23">#23</a>).<br>
`+` Добавлена возможность открывать панель сразу после нажатия мыши на кнопке загрузок (как обычные меню) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/25">#25</a>).<br>
`*` Улучшена производительность при запуске: код для модификаций панели загрузок перемещен в отдельный лениво загружаемый файл (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/26">#26</a>).<br>

##### 0.2.1 (2014-06-04)
`+` Добавлена возможность удалять загрузки из панели кликом средней кнопкой мыши (по умолчанию отключено) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/9">#9</a>).<br>
`+` Добавлено подавление оповещений о добавлении неудавшихся загрузок (только если сохраняются завершенные загрузки, настройка <em>extensions.downloadPanelTweaker.suppressFailedDownloadsNotifications</em>).<br>
`+` В контекстное меню панели добавлен пункт «Копировать ссылку на страницу загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/14">#14</a>).<br>
`+` В контекстное меню панели добавлен пункт «Удалить файл с диска» (скрытые настройки: <em>extensions.downloadPanelTweaker.removeFile.clearHistory</em> для дополнительного удаления из панели/истории, <em>extensions.downloadPanelTweaker.removeFile.removeFilesDirectoryForHTML</em> для удаления \*\_files папок для \*.html файлов и <em>extensions.downloadPanelTweaker.removeFile.confirm</em> для отключения подтверждения) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/15">#15</a>).<br>
`x` Исправлено закрытие боковой панели загрузок от расширения <a href="https://addons.mozilla.org/addon/omnisidebar/">OmniSidebar</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/21">#21</a>).<br>
`+` Добавлена возможность показывать полный путь к файлу во всплывающей подсказке для имени файла (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/22">#22</a>).<br>
`+` Добавлен запрос подтверждения для команды «Очистить загрузки» (<em>extensions.downloadPanelTweaker.clearDownloads.confirm</em> preference).<br>
`*` Улучшена производительность при запуске: код для различных действий с загрузками перемещен в отдельный лениво загружаемый файл (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/24">#24</a>).<br>

##### 0.2.0 (2014-02-28)
`+` Добавлена возможность настроить действия для команды загрузок, сочетания клавиш (Ctrl+J) и кнопки «Показать все загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/10">#10</a>).<br>
`+` Добавлен workaround для исправления полоски между панелями навигации и закладок (настройка <em>extensions.downloadPanelTweaker.fixWrongTabsOnTopAttribute</em>) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/3">#3</a>).<br>
`x` Исправлено: настройка ширины панели загрузок не работала с темой <a href="https://addons.mozilla.org/firefox/addon/nasa-night-launch/">NASA Night Launch</a> (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/4">#4</a>).<br>
`*` Улучшена производительность при запуске.<br>
`x` Исправлена установка маленькой высоты полосы прогресса.<br>
`+` Добавлена возможность не удалять завершенные загрузки из панели (настройка <em>extensions.downloadPanelTweaker.dontRemoveFinishedDownloads</em> + см. описание некоторых скрытых настроек в <a href="https://github.com/Infocatcher/Download_Panel_Tweaker/blob/master/defaults/preferences/prefs.js">defaults/preferences/prefs.js</a>) (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/5">#5</a>).<br>
`+` Добавлен очень компактный стиль для списка загрузок (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/7">#7</a>).<br>
`*` Улучшены стили для списка загрузок.<br>
`+` В контекстное меню панели загрузок добавлен пункт «Очистить загрузки» (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/8">#8</a>).<br>
`x` Исправлено обновление панели загрузок в Firefox 28+ (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/13">#13</a>).<br>
`+` Настройка <em>browser.download.useToolkitUI</em> теперь скрывается в Firefox 26+ (больше не работает, см. <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=845403">bug 845403</a>).<br>
`+` Добавлена возможность ограничить высоту панели загрузок (<a href="https://github.com/Infocatcher/Download_Panel_Tweaker/issues/20">#20</a>).<br>
`+` Добавлена греческая (el) локаль, спасибо <a href="http://forums.mozillazine.org/memberlist.php?mode=viewprofile&u=1595963">Grg68</a> (перевод не полный, извините).<br>

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