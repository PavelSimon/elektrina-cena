Aplikicia (**dam_api3.py**) na stiahnutie údajov z slovenského spotového trhu: [OKTE.sk](https://okte.sk) cenu elektriny od 1. 9. 2009 (začiatok uverejňovania) až do zajtra. Ak je po 13:00 už sú ceny aj na zajtra.

**app.py zobrazí** priebeh ceny za zvolený dátum.

**update_db.py** zasa slúži na pridanie nových dát do databáze

## PHP verzia

Funkčný web interface prepísaný do PHP je na [Energiaweb.energy](https://energiaweb.energy/fullscreen-mapy/)

**update.php** - aktualizuje databázu cez proxy (OKTE API blokuje niektoré hostingy)

**proxy.php** - proxy skript na creativespace.sk pre presmerovanie API volaní

## Frontend (index.html)

Štruktúra je rozdelená na `index.html` + `styles.css` + `app.js`.

Graf (Chart.js) zobrazuje 15-minútové periódy (1..96 za deň, 100 pri DST). Vedľajšie vlastnosti:

- Stat. panely zobrazujú Min/Max aj s časom výskytu (HH:MM) pre aktuálne aj predchádzajúce obdobie.
- Pod grafom sú dátumy dní (perióda 1 každého dňa).
- Ak je zvolený interval **kratší než 3 dni**, na osi X pribudnú popisy `06:00 / 12:00 / 18:00` a každá hodina sa zvýrazní čiarkovanou zvislou čiarou.
- Ak je interval **kratší než 8 dní**, zvislé čiarkované čiary sa kreslia každých 6 hodín.
- Víkendy sú jemne podfarbené.