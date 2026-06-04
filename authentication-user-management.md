# Authentication & User Management Module

## Overview

This module is responsible for handling user authentication, authorization, and role-based access control within the Textbook Sharing & Print Tracking Dashboard.

The objective is to ensure that only authorized users can access the system and perform actions according to their assigned roles.

---

# Module Owner

**Developer:** Authentication & User Management Team

---

# Functional Requirements

## User Login

### Description

Allow registered users to securely log in to the system.

### Inputs

* Email Address
* Password

### Validation

* Email must exist in the system.
* Password must match the stored password.
* Empty fields are not allowed.

### Expected Outcome

* User is authenticated.
* User session is created.
* User is redirected to the dashboard.

---

## User Logout

### Description

Allow authenticated users to securely end their session.

### Expected Outcome

* Session is destroyed.
* User is redirected to the login page.

---

## User Registration (Admin Controlled)

### Description

Allow administrators to create user accounts.

### Inputs

* Full Name
* Email Address
* Password
* Role

### Validation

* Email must be unique.
* Password must meet minimum security requirements.
* Role must be selected.

### Expected Outcome

* New user account is created.
* User can log in using provided credentials.

---

# Role Management

## Supported Roles

### Creator / Sharer

Permissions:

* Login to the system
* View dashboard
* Add textbooks
* Edit textbooks
* Update textbook status up to:

  * Created
  * Requested by Learner
  * Shared with Manager
* View own textbook records

Restrictions:

* Cannot mark books as Sent to Print
* Cannot mark books as Printed

---

### Manager

Permissions:

* Login to the system
* View dashboard
* View all textbooks
* Mark textbooks as:

  * Sent to Print
  * Printed / Completed
* Access reporting features

Restrictions:

* Cannot manage system users unless given admin privileges

---

### Viewer / Learner (Optional)

Permissions:

* Login to the system
* View textbook statuses
* Search textbooks

Restrictions:

* Cannot create textbooks
* Cannot modify textbook statuses

---

### Administrator (Recommended)

Permissions:

* Full system access
* Create users
* Update users
* Disable users
* Assign roles
* View all records

---

# Access Control Matrix

| Feature            | Creator | Manager | Viewer | Admin |
| ------------------ | ------- | ------- | ------ | ----- |
| Login              | Yes     | Yes     | Yes    | Yes   |
| Logout             | Yes     | Yes     | Yes    | Yes   |
| View Dashboard     | Yes     | Yes     | Yes    | Yes   |
| Create Textbook    | Yes     | No      | No     | Yes   |
| Edit Textbook      | Yes     | No      | No     | Yes   |
| View Textbooks     | Yes     | Yes     | Yes    | Yes   |
| Share With Manager | Yes     | No      | No     | Yes   |
| Mark Sent To Print | No      | Yes     | No     | Yes   |
| Mark Printed       | No      | Yes     | No     | Yes   |
| Manage Users       | No      | No      | No     | Yes   |

---

# User Management Screens

## Login Page

### Components

* Email Input
* Password Input
* Login Button
* Forgot Password Link (Optional)

### Actions

* Authenticate user
* Redirect based on role

---

## User List Page (Admin Only)

### Display Columns

* User ID
* Name
* Email
* Role
* Status
* Created Date
* Actions

### Actions

* View User
* Edit User
* Disable User

---

## Create User Page

### Fields

* Full Name
* Email
* Password
* Confirm Password
* Role Dropdown

### Actions

* Save User
* Cancel

---

## Edit User Page

### Editable Fields

* Full Name
* Email
* Role
* Account Status

### Actions

* Update User
* Cancel

---

# Database Design

## Table: users

| Column        | Type         |
| ------------- | ------------ |
| user_id       | BIGINT       |
| full_name     | VARCHAR(255) |
| email         | VARCHAR(255) |
| password_hash | VARCHAR(255) |
| role          | ENUM         |
| status        | ENUM         |
| created_at    | TIMESTAMP    |
| updated_at    | TIMESTAMP    |

---

## Role Values

```text
ADMIN
CREATOR
MANAGER
VIEWER
```

---

## Status Values

```text
ACTIVE
INACTIVE
SUSPENDED
```

---

# Security Requirements

## Password Storage

Passwords must never be stored in plain text.

Recommended:

* BCrypt
* Argon2

Store only password hashes.

---

## Session Management

Authenticated users must have:

* Secure session handling
* Session expiration after inactivity
* Automatic logout after timeout

---

## Authorization

All protected routes must verify:

* User is authenticated
* User has required permissions

Example:

```text
/admin/users
ADMIN only

/textbooks/create
CREATOR or ADMIN

/textbooks/print
MANAGER or ADMIN
```

---

# API Endpoints

## Authentication

### POST /api/auth/login

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "token": "jwt-token",
  "role": "CREATOR"
}
```

---

### POST /api/auth/logout

Response:

```json
{
  "message": "Logged out successfully"
}
```

---

## User Management

### GET /api/users

Get all users.

---

### GET /api/users/{id}

Get user details.

---

### POST /api/users

Create user.

---

### PUT /api/users/{id}

Update user.

---

### DELETE /api/users/{id}

Disable user account.

---

# Deliverables

The Authentication & User Management module should provide:

* Secure login/logout functionality
* Role-based authorization
* User creation and management
* Route protection
* Session management
* User account administration
* Database schema implementation

---

# Out of Scope (Handled by Other Modules)

The following features are not part of this module:

* Textbook creation
* Textbook status tracking
* Dashboard analytics
* Reporting
* File uploads
* Notifications
* Printing workflow
