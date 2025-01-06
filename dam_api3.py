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
    url = API_URL + "?deliveryDayFrom=" + date_from + "&deliveryDayTo=" + date_to
    print(url)
    response = requests.get(url)
    if response.status_code == 200:
        print(f"data z obdobia od {date_from} do {date_to} som stiahol")
        try:
            data = response.json()
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict) and "data" in data:
                return pd.DataFrame(data["data"])
            else:
                print("Unexpected data format")
                return None
        except ValueError:
            print("Response could not be parsed as JSON")
            return None
    else:
        print(f"Failed to fetch data for range {date_from} to {date_to}: {response.status_code}")
        return None

def save_data_to_db(dataframe):
    """Save fetched data to the SQLite database."""
    conn = sqlite3.connect(DATABASE)
    dataframe.to_sql("dam_results", conn, if_exists="append", index=False)
    print(f"Dáta v DB.")
    conn.close()

def populate_database():
    """Fetch and save data from the oldest available date to today."""
    start_date = datetime.strptime("2009-09-01", "%Y-%m-%d")  # Adjust if needed
    end_date = datetime.now()

    current_date = start_date
    while current_date <= end_date:
        chunk_end_date = min(current_date + timedelta(days=365), end_date)
        date_from = current_date.strftime("%Y-%m-%d")
        date_to = chunk_end_date.strftime("%Y-%m-%d")

        print(f"Fetching data for range {date_from} to {date_to}")
        dataframe = fetch_data(date_from, date_to)
        if dataframe is not None and not dataframe.empty:
            save_data_to_db(dataframe)
            print(f"Dáta z {date_from} do {date_to} v DB.")
        current_date = chunk_end_date + timedelta(days=1)

        print(f"Completed fetching data for range {date_from} to {date_to}.")

def update_database():
    """Fetch new data from the last stored date up to today."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Get the latest date in the database
    cursor.execute("SELECT MAX(deliveryDay) FROM dam_results")
    last_date = cursor.fetchone()[0]
    
    if last_date is None:
        # If the database is empty, start from a predefined date
        last_date = "2009-09-01"
    
    last_date = datetime.strptime(last_date, "%Y-%m-%d")
    today = datetime.now()
    
    if last_date >= today:
        print("Database is already up to date.")
        conn.close()
        return
    
    # Fetch and save data from the last date + 1 day to today
    current_date = last_date + timedelta(days=1)
    while current_date <= today:
        chunk_end_date = min(current_date + timedelta(days=5 * 365), today)
        date_from = current_date.strftime("%Y-%m-%d")
        date_to = chunk_end_date.strftime("%Y-%m-%d")
        
        print(f"Fetching data from {date_from} to {date_to}")
        dataframe = fetch_data(date_from, date_to)
        if dataframe is not None and not dataframe.empty:
            save_data_to_db(dataframe)
        
        current_date = chunk_end_date + timedelta(days=1)
    
    conn.close()
    print("Database update complete.")

if __name__ == "__main__":
    create_database()
    populate_database()
