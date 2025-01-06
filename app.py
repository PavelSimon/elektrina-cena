import requests
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request

# Constants
API_URL = "https://isot.okte.sk/api/v1/dam/results"
DATABASE = "C:\\Users\\pavel\\Documents\\dev\\elektrina-cena\\dam_data.db"

# Flask app
app = Flask(__name__)

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

def fetch_data_from_db(start_date, end_date):
    """Fetch data from SQLite database for a given date range."""
    conn = sqlite3.connect(DATABASE)
    query = '''
        SELECT deliveryDay, period, price FROM dam_results 
        WHERE deliveryDay BETWEEN ? AND ?
        ORDER BY deliveryDay, period
    '''
    df = pd.read_sql_query(query, conn, params=(start_date, end_date))
    print(f"data from {df}")
    conn.close()
    return df

@app.route("/api/data", methods=["GET"])
def get_data():
    """API endpoint to fetch data from the database."""
    start_date = request.args.get("start_date", "2009-09-01")
    end_date = request.args.get("end_date", datetime.now().strftime("%Y-%m-%d"))
    df = fetch_data_from_db(start_date, end_date)
    return df.to_json(orient="records")

@app.route("/")
def index():
    """Render the main page."""
    return render_template("index.html")

if __name__ == "__main__":
    create_database()
    app.run(debug=True)
