import requests
import sqlite3
import pandas as pd
from datetime import datetime, timedelta

# Constants
API_URL = "https://isot.okte.sk/api/v1/dam/results"
DATABASE = "C:\\Users\\pavel\\Documents\\dev\\elektrina-cena\\dam_data.db"

def create_database():
    """Creates the SQLite database and the necessary table."""
    print(f"vytváram databázu")
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dam_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deliveryDay TEXT,
            period INTEGER,
            deliveryStart TEXT,
            deliveryEnd TEXT,
            publicationStatus TEXT,
            price REAL,
            purchaseTotalVolume REAL,
            purchaseSuccessfulVolume REAL,
            purchaseUnsuccessfulVolume REAL,
            saleTotalVolume REAL,
            saleSuccessfulVolume REAL,
            saleUnsuccessfulVolume REAL,
            priceRo REAL,
            priceHu REAL,
            priceCz REAL,
            atcSkCz REAL,
            atcCzSk REAL,
            atcSkPl REAL,
            atcPlSk REAL,
            atcSkPlc REAL,
            atcPlcSk REAL,
            atcSkHu REAL,
            atcHuSk REAL,
            atcHuRo REAL,
            atcRoHu REAL,
            flowSkCz REAL,
            flowCzSk REAL,
            flowSkPl REAL,
            flowPlSk REAL,
            flowSkPlc REAL,
            flowPlcSk REAL,
            flowSkHu REAL,
            flowHuSk REAL,
            flowHuRo REAL,
            flowRoHu REAL
        )
    ''')
    conn.commit()
    conn.close()

def fetch_data(date_from, date_to):
    """Fetch data from the API for a specific date range."""
    url=API_URL + "?" + "deliveryDayFrom=" + date_from + "&deliveryDayTo=" + date_to
    print(url)
    response = requests.get(url)
    if response.status_code == 200:
        print(f"data z obdobia od {date_from} do {date_to} som stiahol")
        return response.json()
    else:
        print(f"Failed to fetch data for range {date_from} to {date_to}: {response.status_code}")
        return None

def save_data_to_db(data):
    """Save fetched data to the SQLite database."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    if "data" in data:
        for entry in data["data"]:
            print(f'entry: {entry}')
            cursor.execute('''
                INSERT INTO dam_results (
                    deliveryDay, period, deliveryStart, deliveryEnd, publicationStatus,
                    price, purchaseTotalVolume, purchaseSuccessfulVolume, purchaseUnsuccessfulVolume,
                    saleTotalVolume, saleSuccessfulVolume, saleUnsuccessfulVolume,
                    priceRo, priceHu, priceCz,
                    atcSkCz, atcCzSk, atcSkPl, atcPlSk, atcSkPlc, atcPlcSk,
                    atcSkHu, atcHuSk, atcHuRo, atcRoHu,
                    flowSkCz, flowCzSk, flowSkPl, flowPlSk, flowSkPlc, flowPlcSk,
                    flowSkHu, flowHuSk, flowHuRo, flowRoHu
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                entry.get("deliveryDay"), entry.get("period"), entry.get("deliveryStart"), entry.get("deliveryEnd"),
                entry.get("publicationStatus"), entry.get("price"), entry.get("purchaseTotalVolume"),
                entry.get("purchaseSuccessfulVolume"), entry.get("purchaseUnsuccessfulVolume"),
                entry.get("saleTotalVolume"), entry.get("saleSuccessfulVolume"), entry.get("saleUnsuccessfulVolume"),
                entry.get("priceRo"), entry.get("priceHu"), entry.get("priceCz"),
                entry.get("atcSkCz"), entry.get("atcCzSk"), entry.get("atcSkPl"), entry.get("atcPlSk"),
                entry.get("atcSkPlc"), entry.get("atcPlcSk"), entry.get("atcSkHu"), entry.get("atcHuSk"),
                entry.get("atcHuRo"), entry.get("atcRoHu"), entry.get("flowSkCz"), entry.get("flowCzSk"),
                entry.get("flowSkPl"), entry.get("flowPlSk"), entry.get("flowSkPlc"), entry.get("flowPlcSk"),
                entry.get("flowSkHu"), entry.get("flowHuSk"), entry.get("flowHuRo"), entry.get("flowRoHu")
            ))
    conn.commit()
    print(f"Dáta v DB.")
    conn.close()

def populate_database():
    """Fetch and save data from the oldest available date to today."""
    start_date = datetime.strptime("2009-09-01", "%Y-%m-%d")  # Adjust if needed
    end_date = datetime.now()

    current_date = start_date
    while current_date <= end_date:
        chunk_end_date = min(current_date + timedelta(days= 365), end_date)
        date_from = current_date.strftime("%Y-%m-%d")
        date_to = chunk_end_date.strftime("%Y-%m-%d")

        print(f"Fetching data for range {date_from} to {date_to}")
        data = fetch_data(date_from, date_to)
        if data:
            # print(data)
            save_data_to_db(data)
            print(f"Dáta z {date_from} do {date_to} v DB.")
        current_date = chunk_end_date + timedelta(days=1)

        print(f"Completed fetching data for range {date_from} to {date_to}.")

if __name__ == "__main__":
    create_database()
    populate_database()
