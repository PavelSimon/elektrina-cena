Aplikicia (**dam_api3.py**) na stiahnutie údajov z slovenského spotového trhu: [OKTE.sk](https://okte.sk) cenu elektriny od 1. 9. 2009 (začiatok uverejňovania) až do zajtra. Ak je po 13:00 už sú ceny aj na zajtra.

**app.py zobrazí** priebeh ceny za zvolený dátum.

**update_db.py** zasa slúži na pridanie nových dát do databáze

## PHP verzia

Funkčný web interface prepísaný do PHP je na [Energiaweb.energy](https://energiaweb.energy/fullscreen-mapy/)

**update.php** - aktualizuje databázu cez proxy (OKTE API blokuje niektoré hostingy)

Ak OKTE API neodpovie (napr. údržba, HTTP 503), proxy vráti `{"error": ..., "http_code": ...}` a `update.php` vypíše `Chyba: ... (OKTE HTTP 503)` bez zápisu do databázy. Aktualizáciu stačí zopakovať neskôr.

## Automatická aktualizácia

Dáta sa aktualizujú dvoma cestami, ručné tlačidlo ostáva ako tretia:

- **Cron na hostingu** (Websupport WebAdmin) volá `update.php` denne po 13:00, keď OKTE zverejní ceny na ďalší deň.
- **Poistka pri otvorení stránky** (`autoUpdate` v `app.js`): stránka cez `api.php` zistí, či je v databáze očakávaný posledný deň (dnes, po 13:00 slovenského času zajtra). Ak chýba, zavolá `update.php` a po vložení nových dát prekreslí zobrazený graf. Pokus sa v jednom prehliadači opakuje najskôr po 15 minútach (kľúč `damAutoUpdateAttempt` v localStorage), aby sa OKTE nevolalo pri každom načítaní.

## Databáza

Tabuľka `dam_results` má UNIQUE index `idx_dam_day_period` na `(deliveryDay, period)`. Bráni duplicitným záznamom pri opakovanej aktualizácii a zrýchľuje dopyty podľa dátumu v `api.php`.

Index si `update.php` aj Python skripty (`dam_api3.py`) vytvoria samy pri prvom spustení, ak chýba. Pred vytvorením zmažú prípadné duplicitné riadky (ostane najstarší). Nové záznamy sa vkladajú cez `INSERT OR IGNORE`, takže už uložená perióda sa preskočí.

**proxy.php** - proxy skript na creativespace.sk pre presmerovanie API volaní

## Frontend (index.html)

Štruktúra je rozdelená na `index.html` + `styles.css` + `app.js`. Pri zmene v `app.js` alebo `styles.css` zvýš `?v=N` v `index.html`, aby prehliadač obišiel cache.

Graf (Chart.js) je schodovitý (`stepped: 'before'`, v Chart.js to znamená držať hodnotu bodu až po nasledujúci bod): cena je počas celého intervalu dodávky vodorovná čiara a mení sa až na jeho hranici. Posledný interval uzatvára pomocný bod navyše, aby sa vykreslil celý.

Časy intervalov sa berú zo skutočných časových značiek OKTE (`deliveryStart`, `deliveryEnd` v UTC, vracia ich `api.php`) a prepočítavajú sa na slovenský čas. Perióda 1 je 00:00 – 00:15, perióda 96 je 23:45 – 00:00, rovnako ako v tabuľke [Celkové výsledky DT](https://okte.sk/sk/kratkodoby-trh/zverejnenie-udajov-dt/celkove-vysledky-dt/). Vďaka tomu sedia aj hodinové dáta spred 1. 10. 2025 (24 periód za deň) a dni so zmenou času (92 alebo 100 periód, pri hodinových dátach 23 alebo 25).

Tooltip aj časy pri Min/Max ukazujú celý interval (`2026-11-10 15:45 – 16:00`). Tooltip patrí intervalu, v ktorom je kurzor, nie najbližšiemu bodu. Vedľajšie vlastnosti:

- Stat. panely zobrazujú Min/Max aj s intervalom výskytu pre hlavné aj porovnávacie obdobie.
- **Max. denný rozdiel**: pre každý deň obdobia sa vypočíta rozdiel medzi najvyššou a najnižšou cenou a zobrazí sa deň s najväčším rozdielom, napr. `435.16 € (2026-11-09: 201.99 – 637.15)`.
- **Porovnávacie obdobie** (druhá, čiarkovaná krivka) sa zadáva v riadku pod hlavnými dátumami:
  - Stačí zadať začiatok alebo koniec, druhý dátum sa dopočíta podľa dĺžky hlavného obdobia. Platí naposledy zmenené pole.
  - Ak nie je zadané nič, použije sa obdobie tesne pred hlavným (dnešok sa porovná so včerajškom). Automaticky doplnené dátumy sú sivé.
  - Zadaný dátum ostáva pevný aj pri posúvaní hlavného obdobia šípkami; pri zmene dĺžky hlavného obdobia sa druhý koniec prepočíta. Tlačidlo Automaticky alebo vymazanie poľa vráti predvolené správanie.
  - V URL sa dá odovzdať ako `comp_start=YYYY-MM-DD` alebo `comp_end=YYYY-MM-DD` popri `start_date` a `end_date`.
- Pod grafom sú dátumy dní (perióda 1 každého dňa).
- Ak je zvolený interval **kratší než 3 dni**, na osi X pribudnú popisy `06:00 / 12:00 / 18:00` a každá hodina sa zvýrazní čiarkovanou zvislou čiarou.
- Ak je interval **kratší než 8 dní**, zvislé čiarkované čiary sa kreslia každých 6 hodín.
- Víkendy sú jemne podfarbené.