# Addresses API Documentation

The **Addresses** module manages the geolocation and physical address data for Clubs, Children, and generic entities.

**Base URL**: `/addresses`

## 📋 Index

1. [Search Addresses](#1-search-addresses)
2. [Get Address](#2-get-address)
3. [Update Address](#3-update-address)

---

## 1. Search Addresses

Find addresses by query (street, district, city).

- **Endpoint**: `GET /addresses`
- **Query**: `?q=Main Street`

---

## 2. Get Address

Retrieve details of a specific address.

- **Endpoint**: `GET /addresses/:id`

---

## 3. Update Address

Modify address details. Note that addresses linked to specific entities (like Clubs) might be updated directly through those entities' endpoints, but this allows direct manipulation.

- **Endpoint**: `PUT /addresses/:id`
- **Body**:

  ```json
  {
    "street": "New Street Name",
    "number": "123",
    "district": "Downtown",
    "city": "Sao Paulo",
    "state": "SP",
    "postalCode": "01234-567",
    "latitude": -23.5505,
    "longitude": -46.6333
  }
  ```

---
⬅️ [Back to Documentation Hub](README.md)
