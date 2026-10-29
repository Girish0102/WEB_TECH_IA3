# Haven House — Hotel Booking System (React Upgrade)

Educational hotel booking website using all six requested technologies:

- **HTML** — `index.html` and React page structure
- **CSS** — `src/style.css`
- **JavaScript** — React interactions and API calls in `src/main.jsx`
- **React.js** — component-based frontend
- **Node.js + Express** — `server.js` backend/API
- **MongoDB + Mongoose** — users, rooms, bookings, and customer-care tickets

## Visible UI improvements in this IA3 version
- Redesigned customer profile with a dark-green welcome banner, profile avatar, account information cards, booking/support statistics and a sign-out confirmation.
- Booking history displayed as reservation cards with booking reference, dates, totals, payment status and cancellation controls.
- Travel guide with 20 country options and destination recommendations.
- Customer-care ticket form plus an admin inbox for reading messages, changing ticket status and saving replies.
- Email notifications can be enabled with SMTP settings in `.env`; the support inbox still works through MongoDB without SMTP.

## Features
- Premium hotel-discovery homepage with editorial hero, trust strip, and responsive layouts
- Enhanced room listing cards with guest ratings, room details, amenities, availability, and price presentation
- Room type filters, keyword search, guest-count filtering, and price/capacity sorting
- Date and guest search with availability feedback
- Customer registration, sign-in, password visibility toggle, forgot password, reset password
- Customer booking history and cancellation
- Admin dashboard, booking/payment status updates, customer directory and support-ticket replies
- Customer support tickets and status tracking
- MongoDB sample room data and demo admin seeding

## Run on Windows
1. Install Node.js LTS and MongoDB Community Server.
2. Start the **MongoDB Server** service from `services.msc`.
3. Extract this ZIP, then open the extracted `WebTech IA3` folder (the folder containing `package.json`) in VS Code.
4. In VS Code, choose **Terminal → New Terminal**.
5. Run:
   ```cmd
   npm install
   npm run build
   npm start
   ```
6. Open `http://localhost:3000`.

The React source is in `src/`; `npm run build` creates the production frontend in `dist/`. Node/Express serves the built React app and the existing API. If you change React files, run `npm run build` again before using `npm start`. For development, `npm run dev` starts Vite and the API together.

## Demo admin
- Email: `admin@havenhouse.com`
- Password: `Admin@12345`

The demo admin is created after the first successful MongoDB connection. Change demo credentials before any public deployment.

## Forgot-password email setup
The reset endpoint creates a one-time token that expires in 30 minutes. To send real email, copy `.env.example` to `.env` and set real SMTP values (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) and `APP_BASE_URL=http://localhost:3000`. Without SMTP, the reset link is printed in the terminal running `npm start`; it will not arrive in email. Never share your SMTP app password.

## Social login note
Google, Facebook, and WhatsApp are shown as clearly labelled integration options in the sign-in screen, but authentication through these providers is **not yet connected**. It requires Google/Facebook developer credentials and OAuth callback configuration, or a WhatsApp Business verification provider. The buttons explain this instead of pretending the sign-in succeeded.

## Payment note
The app records payment preferences and admin-updated payment statuses for demonstration. It does not charge real cards, UPI, or bank accounts.

## MongoDB verification
In `mongosh`:
```javascript
use hotelBookingDB
show collections
db.rooms.find().pretty()
db.users.find({}, {name:1,email:1,role:1}).pretty()
db.bookings.find().pretty()
db.tickets.find().pretty()
```

This is a classroom demo, not production-ready software. Before public deployment, add OAuth integrations, persistent sessions, HTTPS, CSRF protection, login rate limiting, stronger validation, audit logging, and a real payment provider if needed.

## New in this assessment upgrade
- Quick room filters: multiple nightly price brackets, property type, Wi-Fi, breakfast and bathtub.
- Travel Guide section: select India, Japan, Italy, Thailand or France to see a short list of places and a travel tip.
- Installable Progressive Web App (PWA): use **Get the app** or **Install Haven House** in a supported browser. On Android Chrome, choose **Install app**; on iPhone Safari, use **Share → Add to Home Screen**. This creates a home-screen app from the website; it is not a native Play Store/App Store release.
- Basic service-worker caching for quicker repeat visits. Booking and account APIs still require an internet connection and the Node/MongoDB backend.
