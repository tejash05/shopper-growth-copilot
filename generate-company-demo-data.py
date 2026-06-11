import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

OUTPUT_DIR = Path("company-demo-data")
OUTPUT_DIR.mkdir(exist_ok=True)

random.seed(42)

CHANNELS = ["WHATSAPP", "SMS", "EMAIL", "RCS"]
LOYALTY_TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"]

CITIES = [
    ("Bangalore", "Karnataka"),
    ("Mumbai", "Maharashtra"),
    ("Delhi", "Delhi"),
    ("Hyderabad", "Telangana"),
    ("Pune", "Maharashtra"),
    ("Chennai", "Tamil Nadu"),
    ("Kolkata", "West Bengal"),
    ("Ahmedabad", "Gujarat"),
]

COMPANIES = [
    {
        "name": "Adidas",
        "prefix": "ADI",
        "industry": "Sportswear",
        "categories": [
            "Sneakers",
            "Running Shoes",
            "Sportswear",
            "Training Gear",
            "Accessories",
        ],
        "products": [
            "Ultraboost Running Shoes",
            "Adilette Slides",
            "Training Tracksuit",
            "Performance T-Shirt",
            "Gym Duffel Bag",
            "Football Jersey",
            "Running Shorts",
        ],
    },
    {
        "name": "Nykaa",
        "prefix": "NYK",
        "industry": "Beauty",
        "categories": [
            "Skincare",
            "Makeup",
            "Haircare",
            "Fragrance",
            "Wellness",
        ],
        "products": [
            "Vitamin C Serum",
            "Matte Lipstick",
            "Hydrating Face Cream",
            "Repair Shampoo",
            "Floral Perfume",
            "Kajal Pencil",
            "Sheet Mask",
        ],
    },
    {
        "name": "Myntra",
        "prefix": "MYN",
        "industry": "Fashion",
        "categories": [
            "Dresses",
            "Sneakers",
            "Ethnic Wear",
            "Denim",
            "Accessories",
            "Premium Wear",
        ],
        "products": [
            "Summer Floral Dress",
            "Slim Fit Denim",
            "Casual Sneakers",
            "Printed Kurta",
            "Leather Handbag",
            "Linen Shirt",
            "Premium Blazer",
        ],
    },
]

FIRST_NAMES = [
    "Priya", "Aman", "Riya", "Kabir", "Sneha", "Rahul", "Ananya", "Ishaan",
    "Meera", "Arjun", "Nisha", "Karan", "Tanya", "Dev", "Aditi", "Rohan",
    "Simran", "Yash", "Neha", "Varun", "Kiara", "Aryan", "Pooja", "Samar",
]

LAST_NAMES = [
    "Sharma", "Verma", "Singh", "Mehta", "Iyer", "Reddy", "Kapoor", "Nair",
    "Malhotra", "Das", "Kumar", "Jain", "Gupta", "Bose", "Patel", "Saxena",
]


def bool_value(probability=0.85):
    return random.random() < probability


def random_date(days_back=420):
    date = datetime.now() - timedelta(days=random.randint(1, days_back))
    return date.strftime("%Y-%m-%d")


def get_order_value(industry):
    if industry == "Sportswear":
        return random.randint(1200, 9000)

    if industry == "Beauty":
        return random.randint(350, 5500)

    if industry == "Fashion":
        return random.randint(600, 7500)

    return random.randint(500, 4000)


def generate_phone(index, company_prefix):
    prefix_map = {
        "ADI": "91",
        "NYK": "92",
        "MYN": "93",
    }

    start = prefix_map.get(company_prefix, "90")
    return f"{start}{index:08d}"


def generate_company_data(company, customer_count=500, min_orders=1, max_orders=7):
    customers = []
    orders = []

    for i in range(1, customer_count + 1):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        city, state = random.choice(CITIES)

        external_customer_id = f"{company['prefix']}-CUST-{i:05d}"

        email_company_slug = company["name"].lower().replace(" ", "")
        email = f"{first.lower()}.{last.lower()}.{i}@{email_company_slug}.demo"

        phone = generate_phone(i, company["prefix"])

        customer = {
            "externalCustomerId": external_customer_id,
            "firstName": first,
            "lastName": last,
            "email": email,
            "phone": phone,
            "city": city,
            "state": state,
            "preferredChannel": random.choices(
                CHANNELS,
                weights=[55, 20, 20, 5],
                k=1,
            )[0],
            "loyaltyTier": random.choices(
                LOYALTY_TIERS,
                weights=[40, 30, 20, 10],
                k=1,
            )[0],
            "consentWhatsApp": bool_value(0.9),
            "consentSms": bool_value(0.82),
            "consentEmail": bool_value(0.78),
            "consentRcs": bool_value(0.35),
        }

        customers.append(customer)

        order_count = random.randint(min_orders, max_orders)

        for j in range(1, order_count + 1):
            category = random.choice(company["categories"])
            product_name = random.choice(company["products"])

            external_order_id = f"{company['prefix']}-ORD-{i:05d}-{j:02d}"

            order = {
                "externalOrderId": external_order_id,
                "externalCustomerId": external_customer_id,
                "customerEmail": email,
                "customerPhone": phone,
                "orderDate": random_date(420),
                "orderValue": get_order_value(company["industry"]),
                "currency": "INR",
                "category": category,
                "productName": product_name,
                "quantity": random.randint(1, 3),
                "status": "COMPLETED",
            }

            orders.append(order)

    return customers, orders


def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    customer_fields = [
        "externalCustomerId",
        "firstName",
        "lastName",
        "email",
        "phone",
        "city",
        "state",
        "preferredChannel",
        "loyaltyTier",
        "consentWhatsApp",
        "consentSms",
        "consentEmail",
        "consentRcs",
    ]

    order_fields = [
        "externalOrderId",
        "externalCustomerId",
        "customerEmail",
        "customerPhone",
        "orderDate",
        "orderValue",
        "currency",
        "category",
        "productName",
        "quantity",
        "status",
    ]

    for company in COMPANIES:
        customers, orders = generate_company_data(company)

        slug = company["name"].lower().replace(" ", "-")

        json_path = OUTPUT_DIR / f"{slug}-data.json"
        customers_csv_path = OUTPUT_DIR / f"{slug}-customers.csv"
        orders_csv_path = OUTPUT_DIR / f"{slug}-orders.csv"

        with open(json_path, "w", encoding="utf-8") as file:
            json.dump(
                {
                    "company": {
                        "name": company["name"],
                        "industry": company["industry"],
                        "currency": "INR",
                    },
                    "customers": customers,
                    "orders": orders,
                },
                file,
                indent=2,
            )

        write_csv(customers_csv_path, customers, customer_fields)
        write_csv(orders_csv_path, orders, order_fields)

        print(f"Generated {company['name']}:")
        print(f"  Customers: {len(customers)}")
        print(f"  Orders: {len(orders)}")
        print(f"  JSON: {json_path}")
        print(f"  Customers CSV: {customers_csv_path}")
        print(f"  Orders CSV: {orders_csv_path}")
        print()


if __name__ == "__main__":
    main()
