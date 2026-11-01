# DeepSeek Usage Monitor — landing page

Статический лендинг для расширения
[DeepSeek Usage Monitor](https://chromewebstore.google.com/detail/deepseek-usage-monitor/bgnofdddgahndpccpfnlddggfmcjbcco)
(`D:\Projects\deepseek-usage-monitor`).

Чистый HTML + CSS + JS, без сборки и зависимостей.

## Структура

```
index.html        — шаблон и русская версия (hand-edited)
styles.css        — стили (тёмная тема, адаптив, reduced-motion)
script.js         — sticky-навигация, меню, язык, reveal-анимации
scripts/build-i18n.js — генератор локализованных страниц
i18n/*.json       — тексты: 10 локалей (ru, en, de, es, fr, hi, id, ja, pt_BR, zh_CN)
en/ de/ es/ ...   — сгенерированные страницы (не править руками)
assets/images/    — иконки расширения и скриншоты попапа/настроек
CNAME             — deepseek-usage-monitor.rodevich.com
```

## Локализация

Локали: 10 — ровно те, что есть в самом расширении (`_locales/`).

1. Тексты правятся **только** в `i18n/<locale>.json` (и в `index.html` для русского).
2. В разметке используется разметка-маркер:
   `data-i18n` (текст), `data-i18n-html` (HTML внутри), `data-i18n-alt`,
   `data-i18n-content`, `data-i18n-aria-label`.
3. Сборка:

```bash
node scripts/build-i18n.js          # сгенерировать en/ de/ es/ fr/ hi/ id/ ja/ pt_BR/ zh_CN/
node scripts/build-i18n.js --check  # только проверка ключей (падает при расхождении)
```

Добавили ключ в `i18n/ru.json` → добавьте его во все остальные файлы, иначе `--check`
вернёт ошибку. Новый язык: скопировать `i18n/en.json`, добавить локаль в массив
`LOCALES` и в блок `hreflang` в `index.html`.

Переключатель языка живёт в шапке (`#langSwitch`); на каждой странице он показывает
свой код (RU/EN/DE/…) и ведёт на `../<locale>/`.

`index.html` в корне остаётся русской версией — его правим руками, остальные страницы пересобираются.

## Локальный просмотр

Открыть `index.html` в браузере (или `npx serve .`). Локальные страницы из `en/`, `de/`
и т.д. открываются напрямую без сервера; в `file://` переход по переключателю языка
показывает подсказку вместо 404.

## Деплой

GitHub Pages: ветка `main`, корень репозитория. В настройках DNS у
`rodevich.com` нужна CNAME-запись:

```
deepseek-usage-monitor  ->  rodewitsch.github.io
```

## Обновление скриншотов

Скриншоты (`popup.png`, `options.png`) берутся из расширения. При изменении
попапа/настроек положите новые файлы в `assets/images/` (ширина попапа — 432 px).

## Ссылки, которые нужно поддерживать

- Chrome Web Store id: `bgnofdddgahndpccpfnlddggfmcjbcco`
- GitHub: `https://github.com/rodewitsch/deepseek-usage-monitor`
- Privacy: `https://github.com/rodewitsch/deepseek-usage-monitor/blob/main/PRIVACY.md`
