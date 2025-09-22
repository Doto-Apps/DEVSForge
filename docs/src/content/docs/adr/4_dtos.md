---
title: 4-Usage of DTOs in the backend
description: Explanation of the usage of DTOs in the the backend 
---

# Using DTOs in the Go Backend

## Introduction

In our Go backend, we use the Fiber library to handle HTTP requests and GORM for database interactions. To structure our code efficiently and maintainably, we have adopted the DTO (Data Transfer Object) pattern. This document explains how we use this pattern and its benefits.

## Current Structure

### GORM Models

The models used by GORM are defined in the `models` package. These structures are used for both HTTP responses and GORM queries. This means each data model is directly exposed in the API responses.

### HTTP Requests

HTTP requests use a separate structure in a `requests` package. These structures are named after the corresponding model with a `Request` suffix. For example, if we have a `User` model, we will have a `UserRequest` structure for HTTP requests.

## Potential Improvement

### Isolate Models and Use a `responses` Package

To further improve our code structure, we could isolate the GORM models and use a `responses` package to control the responses sent by the API. This would allow us to:

- **Decouple data models from API responses**: Data models may contain sensitive or irrelevant information for the client. By using DTOs, we can precisely control what is exposed.
- **Facilitate validations and transformations**: DTOs can include validations specific to the API's needs, independent of database constraints.
- **Improve maintainability**: Changing a data model's structure will not directly affect the API responses, thus reducing the risk of regression.

## Why Use the DTO Pattern?

### Benefits of the DTO Pattern

1. **Separation of Concerns**: DTOs allow us to separate concerns between the data layer and the presentation layer. This makes the code more modular and easier to maintain.
2. **Security**: By precisely controlling what is exposed in API responses, we can avoid exposing sensitive information.
3. **Flexibility**: DTOs allow data to be transformed before being sent to the client, which is useful for adapting data to the API's specific needs.

### Comparison with Direct Use of GORM Structures

- **Coupling**: Directly using GORM structures for HTTP responses creates a strong coupling between the database and the API. This can make the code harder to maintain and evolve.
- **Data Exposure**: GORM structures may contain fields that should not be exposed in API responses, such as passwords or foreign keys.
- **Validations**: API-specific validations must be added directly to the GORM structures, which can make the code less clear.

## Conclusion

Using the DTO pattern in our Go backend with Fiber and GORM improves the separation of concerns, security, and flexibility of our code. By isolating data models and using specific structures for requests and responses, we can create a more robust and maintainable API.
