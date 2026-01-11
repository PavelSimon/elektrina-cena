Aplikicia (**dam_api3.py**) na stiahnutie údajov z slovenského spotového trhu: [OKTE.sk](https://okte.sk) cenu elektriny od 1. 9. 2009 (začiatok uverejňovania) až do zajtra. Ak je po 13:00 už sú ceny aj na zajtra.

**app.py zobrazí** priebeh ceny za zvolený dátum.

**update_db.py** zasa slúži na pridanie nových dát do databáze

## PHP verzia

Funkčný web interface prepísaný do PHP je na [Energiaweb.energy](https://energiaweb.energy/fullscreen-mapy/)

**update.php** - aktualizuje databázu cez proxy (OKTE API blokuje niektoré hostingy)

**proxy.php** - proxy skript na creativespace.sk pre presmerovanie API volaní