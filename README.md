# Mall Billing System - Unified Checkout

A Web-Based and Hardware-Ready Smart Mall Shopping and Billing Platform.

## Project Structure

This project follows the structure outlined in the project report:

\`\`\`text
mall-billing-system/
├── frontend/             # React.js Customer and Staff web interfaces
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Main application views (Customer, Checkout, Dashboard)
│   │   ├── services/     # API integration services
│   │   ├── scanner/      # Barcode scanning logic
│   │   ├── cart/         # Unified cart state management
│   │   └── dashboard/    # Manager dashboard widgets
├── backend/              # Node.js + Express.js APIs and business logic
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API route definitions
│   │   ├── models/       # Data models
│   │   ├── services/     # Core business logic
│   │   ├── middleware/   # Custom Express middleware
│   │   ├── websocket/    # Real-time event handlers
│   │   └── payments/     # Payment gateway integrations
│   ├── server.js         # Entry point for the backend
├── database/             # Database schemas, migrations, and seeds
│   ├── schema/
│   ├── migrations/
│   └── seed/
├── hardware/             # IoT integration for physical smart carts (Future Scope)
│   ├── smart-cart/
│   ├── scanner/
│   └── rfid/
└── docs/                 # Project documentation
    ├── architecture/
    └── api/
\`\`\`

## Running the MVP Locally

1. **Start Backend**: Navigate to `backend/` and run `node server.js`
2. **Start Frontend**: Navigate to `frontend/` and run `npm run dev`

Access the application at `http://localhost:5173`.
