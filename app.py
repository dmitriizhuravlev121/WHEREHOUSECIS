from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

BASE_ID = os.getenv("BASE_ID")
API_KEY = os.getenv("API_KEY")

if not BASE_ID or not API_KEY:
    raise ValueError("BASE_ID и API_KEY должны быть установлены в переменных окружения.")

def get_current_stock(product_name):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    supply_url = f"https://api.airtable.com/v0/{BASE_ID}/Поставки?filterByFormula={{Товар}}='{product_name}'"
    try:
        supply_response = requests.get(supply_url, headers=headers)
        supply_response.raise_for_status()
        supply_records = supply_response.json().get("records", [])
        total_supply = sum(record["fields"].get("Количество", 0) for record in supply_records)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка получения поставок: {str(e)}")

    withdraw_url = f"https://api.airtable.com/v0/{BASE_ID}/Списания?filterByFormula={{Товар}}='{product_name}'"
    try:
        withdraw_response = requests.get(withdraw_url, headers=headers)
        withdraw_response.raise_for_status()
        withdraw_records = withdraw_response.json().get("records", [])
        total_withdraw = sum(record["fields"].get("Количество", 0) for record in withdraw_records)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ошибка получения списаний: {str(e)}")

    return max(total_supply - total_withdraw, 0)

@app.route('/add_stock', methods=['POST'])
def add_stock():
    data = request.json
    product_name = data.get("product_name")
    quantity = data.get("quantity")

    if not product_name or not quantity:
        return jsonify({"error": "Укажите товар и количество"}), 400

    try:
        quantity = int(quantity)
        if quantity <= 0:
            return jsonify({"error": "Количество должно быть положительным"}), 400
    except ValueError:
        return jsonify({"error": "Некорректное количество"}), 400

    url = f"https://api.airtable.com/v0/{BASE_ID}/Поставки"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "records": [
            {
                "fields": {
                    "Товар": [product_name],
                    "Количество": quantity
                }
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return jsonify({"message": "Товар добавлен", "quantity": quantity}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Ошибка Airtable: {str(e)}"}), 500

@app.route('/subtract_stock', methods=['POST'])
def subtract_stock():
    data = request.json
    product_name = data.get("product_name")
    quantity = data.get("quantity")

    if not product_name or not quantity:
        return jsonify({"error": "Укажите товар и количество"}), 400

    try:
        quantity = int(quantity)
        if quantity <= 0:
            return jsonify({"error": "Количество должно быть положительным"}), 400
    except ValueError:
        return jsonify({"error": "Некорректное количество"}), 400

    # Проверка остатка
    try:
        current_stock = get_current_stock(product_name)
        if quantity > current_stock:
            return jsonify({"error": f"Недостаточно товара. На складе: {current_stock} ед."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    url = f"https://api.airtable.com/v0/{BASE_ID}/Списания"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "records": [
            {
                "fields": {
                    "Товар": [product_name],
                    "Количество": quantity
                }
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return jsonify({"message": "Товар списан", "quantity": quantity}), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Ошибка Airtable: {str(e)}"}), 500

@app.route('/get_stock', methods=['POST'])
def get_stock():
    data = request.json
    product_name = data.get("product_name")

    if not product_name:
        return jsonify({"error": "Укажите товар"}), 400

    try:
        quantity = get_current_stock(product_name)
        return jsonify({"quantity": quantity}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
