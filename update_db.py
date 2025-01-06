# update_db.py
import sqlite3
from datetime import datetime, timedelta
from dam_api3 import fetch_data, save_data_to_db, DATABASE  # Import necessary functions/constants

def update_database():
    """Fetch new data from the last stored date up to today."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Get the latest date in the database
    cursor.execute("SELECT MAX(deliveryDay) FROM dam_results")
    last_date = cursor.fetchone()[0]
    print(f"Last date in the database: {last_date}")
    
    if last_date is None:
        # If the database is empty, start from a predefined date
        last_date = "2009-09-01"
    
    last_date = datetime.strptime(last_date, "%Y-%m-%d")
    today = datetime.now() + timedelta(days=1)
    print(f"Today's date: {today}")
        
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
    update_database()
