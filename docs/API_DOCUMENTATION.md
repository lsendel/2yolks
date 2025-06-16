# 2yolks API Documentation

## Overview

The 2yolks API provides a comprehensive backend service for the recipe sharing platform, supporting user management, recipe operations, reviews, and administrative functions.

## Base URL
```
Production: https://api.2yolks.com
Development: http://localhost:3000/api
```

## Authentication

### JWT Token Authentication
All authenticated endpoints require a Bearer token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### Sign In
```http
POST /auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "user@example.com",
      "role": "user",
      "permissions": [...]
    },
    "token": "jwt_token_here"
  }
}
```

#### Sign Up
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "johndoe",
  "fullName": "John Doe",
  "role": "user"
}
```

#### Sign Out
```http
POST /auth/signout
Authorization: Bearer <token>
```

## User Management

### Get Users (Admin Only)
```http
GET /users?page=1&limit=20&search=john&role=user
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by username or email
- `role` (optional): Filter by user role

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Get User Profile
```http
GET /users/:id
Authorization: Bearer <token>
```

### Update User Profile
```http
PUT /users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "John Smith",
  "bio": "Passionate home cook",
  "dietary_preferences": ["vegetarian", "gluten-free"]
}
```

### Delete User (Admin Only)
```http
DELETE /users/:id
Authorization: Bearer <admin_token>
```

## Recipe Management

### Get Recipes
```http
GET /recipes?page=1&limit=20&search=pasta&category=italian&difficulty=easy&featured=true
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search in title and description
- `category` (optional): Filter by category
- `difficulty` (optional): easy, medium, hard
- `featured` (optional): true/false
- `author` (optional): Filter by author username
- `rating` (optional): Minimum rating (1-5)
- `maxCookTime` (optional): Maximum cooking time in minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "recipes": [
      {
        "id": "uuid",
        "title": "Classic Pasta Carbonara",
        "description": "Traditional Italian pasta dish",
        "author": {
          "id": "uuid",
          "username": "chef_mario",
          "avatar_url": "https://..."
        },
        "ingredients": [
          {
            "quantity": "400",
            "unit": "g",
            "name": "spaghetti"
          }
        ],
        "steps": [
          {
            "description": "Boil water in a large pot",
            "duration": 300
          }
        ],
        "tags": ["italian", "pasta", "quick"],
        "cook_time": 20,
        "prep_time": 10,
        "servings": 4,
        "difficulty": "easy",
        "nutrition": {
          "calories": 450,
          "protein": "18g",
          "carbs": "65g",
          "fat": "12g",
          "fiber": "3g"
        },
        "rating": 4.7,
        "review_count": 23,
        "image_url": "https://...",
        "gallery_images": ["https://..."],
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "is_published": true,
        "is_featured": false,
        "status": "published"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 500,
      "totalPages": 25
    }
  }
}
```

### Get Single Recipe
```http
GET /recipes/:id
```

### Create Recipe (Content Creator/Admin)
```http
POST /recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Homemade Pizza Margherita",
  "description": "Classic Italian pizza with fresh basil",
  "ingredients": [
    {
      "quantity": "500",
      "unit": "g",
      "name": "pizza dough"
    },
    {
      "quantity": "200",
      "unit": "ml",
      "name": "tomato sauce"
    }
  ],
  "steps": [
    {
      "description": "Preheat oven to 250°C",
      "duration": 900
    },
    {
      "description": "Roll out the dough",
      "duration": 300
    }
  ],
  "tags": ["italian", "pizza", "vegetarian"],
  "cook_time": 15,
  "prep_time": 30,
  "servings": 4,
  "difficulty": "medium",
  "nutrition": {
    "calories": 320,
    "protein": "12g",
    "carbs": "45g",
    "fat": "10g",
    "fiber": "2g"
  },
  "image_url": "https://example.com/pizza.jpg",
  "is_published": true
}
```

### Update Recipe (Owner/Admin)
```http
PUT /recipes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Recipe Title",
  "description": "Updated description"
}
```

### Delete Recipe (Owner/Admin)
```http
DELETE /recipes/:id
Authorization: Bearer <token>
```

## Review System

### Get Recipe Reviews
```http
GET /recipes/:recipeId/reviews?page=1&limit=10
```

### Create Review
```http
POST /recipes/:recipeId/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "comment": "Absolutely delicious! Will make again."
}
```

### Update Review (Owner/Admin)
```http
PUT /recipes/:recipeId/reviews/:reviewId
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 4,
  "comment": "Updated review comment"
}
```

### Delete Review (Owner/Admin)
```http
DELETE /recipes/:recipeId/reviews/:reviewId
Authorization: Bearer <token>
```

## Saved Recipes

### Get User's Saved Recipes
```http
GET /users/:userId/saved-recipes
Authorization: Bearer <token>
```

### Save Recipe
```http
POST /users/:userId/saved-recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipe_id": "recipe_uuid"
}
```

### Remove Saved Recipe
```http
DELETE /users/:userId/saved-recipes/:recipeId
Authorization: Bearer <token>
```

## Meal Planning

### Get Meal Plans
```http
GET /users/:userId/meal-plans?start_date=2024-01-01&end_date=2024-01-07
Authorization: Bearer <token>
```

### Create Meal Plan
```http
POST /users/:userId/meal-plans
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2024-01-15",
  "meal_type": "dinner",
  "recipe_id": "recipe_uuid"
}
```

### Update Meal Plan
```http
PUT /meal-plans/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "meal_type": "lunch",
  "recipe_id": "new_recipe_uuid"
}
```

### Delete Meal Plan
```http
DELETE /meal-plans/:id
Authorization: Bearer <token>
```

## Shopping Lists

### Get Shopping List
```http
GET /users/:userId/shopping-list
Authorization: Bearer <token>
```

### Add Shopping List Item
```http
POST /users/:userId/shopping-list
Authorization: Bearer <token>
Content-Type: application/json

{
  "ingredient": {
    "quantity": "2",
    "unit": "cups",
    "name": "flour"
  },
  "meal_plan_id": "optional_meal_plan_uuid"
}
```

### Update Shopping List Item
```http
PUT /shopping-list/:itemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "is_checked": true
}
```

### Delete Shopping List Item
```http
DELETE /shopping-list/:itemId
Authorization: Bearer <token>
```

## Admin Endpoints

### Analytics Dashboard
```http
GET /admin/analytics
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1247,
    "totalRecipes": 892,
    "totalReviews": 3456,
    "averageRating": 4.6,
    "recentActivity": [
      {
        "id": "uuid",
        "type": "recipe_created",
        "user_id": "uuid",
        "description": "New recipe 'Chocolate Cake' created",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "popularRecipes": [...],
    "userGrowth": [
      {
        "date": "2024-01-01",
        "count": 45
      }
    ],
    "recipeGrowth": [...]
  }
}
```

### Content Moderation
```http
GET /admin/moderation-queue
Authorization: Bearer <admin_token>
```

```http
POST /admin/moderate/:contentId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "approve", // or "reject", "flag"
  "moderator_notes": "Content approved after review"
}
```

### User Management
```http
PUT /admin/users/:userId/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "content_creator",
  "permissions": [
    {
      "resource": "recipes",
      "action": "create"
    }
  ]
}
```

## File Upload

### Upload Recipe Image
```http
POST /upload/recipe-image
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "image": <file>,
  "recipe_id": "recipe_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.example.com/recipes/image.jpg",
    "filename": "recipe_uuid_timestamp.jpg",
    "size": 1024000,
    "mime_type": "image/jpeg"
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  }
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED` (401): Missing or invalid token
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions
- `RESOURCE_NOT_FOUND` (404): Requested resource doesn't exist
- `VALIDATION_ERROR` (400): Invalid input data
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_SERVER_ERROR` (500): Server error

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limits by Role
- **User**: 100 requests per 15 minutes
- **Content Creator**: 200 requests per 15 minutes
- **Admin**: 1000 requests per 15 minutes

## Webhooks

### Recipe Events
```http
POST /webhooks/recipes
Content-Type: application/json

{
  "event": "recipe.created",
  "data": {
    "recipe_id": "uuid",
    "author_id": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### User Events
```http
POST /webhooks/users
Content-Type: application/json

{
  "event": "user.registered",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { ApiClient } from '@2yolks/api-client';

const client = new ApiClient({
  baseURL: 'https://api.2yolks.com',
  apiKey: 'your-api-key'
});

// Get recipes
const recipes = await client.recipes.list({
  page: 1,
  limit: 20,
  search: 'pasta'
});

// Create recipe
const newRecipe = await client.recipes.create({
  title: 'My Recipe',
  description: 'Delicious recipe',
  // ... other fields
});
```

### Python
```python
from twoyolks_api import ApiClient

client = ApiClient(
    base_url='https://api.2yolks.com',
    api_key='your-api-key'
)

# Get recipes
recipes = client.recipes.list(page=1, limit=20, search='pasta')

# Create recipe
new_recipe = client.recipes.create({
    'title': 'My Recipe',
    'description': 'Delicious recipe',
    # ... other fields
})
```

## Testing

### Test Environment
```
Base URL: https://api-test.2yolks.com
```

### Test Data
- Test user credentials available in development environment
- Sample recipes and data for testing
- Mock payment processing for premium features

## Versioning

The API uses semantic versioning. Current version: `v1`

### Version Headers
```http
API-Version: v1
Accept: application/vnd.2yolks.v1+json
```

## Support

For API support and questions:
- Documentation: https://docs.2yolks.com
- Support Email: api-support@2yolks.com
- GitHub Issues: https://github.com/2yolks/api/issues

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- User authentication and management
- Recipe CRUD operations
- Review system
- Admin panel endpoints
- File upload functionality