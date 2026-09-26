# Kredibble Backend

Express API built with MongoDB, Cloudinary, AI assistant providers, WordPress content feeds, and Resend email verification.

## Setup

1. Copy `.env.example` to `.env` if not present.
2. Ensure you have a MongoDB Atlas cluster and Cloudinary account.
3. Install dependencies: `npm install`
4. Run locally: `npm run dev`

Default API URL: `http://localhost:4000/api`

## Deployment (Render)

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set the following:
   - **Root Directory:** `kredibble-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your MongoDB Atlas URL)*
   - `JWT_SECRET`: *(A long random string)*
   - `ADMIN_JWT_SECRET`: *(Another long random string)*
   - `CLOUDINARY_CLOUD_NAME`: *(From Cloudinary dashboard)*
   - `CLOUDINARY_API_KEY`: *(From Cloudinary dashboard)*
   - `CLOUDINARY_API_SECRET`: *(From Cloudinary dashboard)*
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: *(For the selected `AI_PROVIDER`)*
   - `INSIGHT_GHANA_WORDPRESS_URL` and `AFRICAN_JOURNAL_WORDPRESS_URL`: *(Publication site roots)*
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: *(Resend API key and verified sender)*
   - `CORS_ORIGIN`: *(The URLs of your deployed admin/web apps, comma-separated)*

## Useful Routes

- `GET /api/health` - Health check (Use this for Render)
- `POST /api/auth/register` - User signup
- `POST /api/auth/login` - User login
- `POST /api/upload` - File upload to Cloudinary (Requires Auth)
- `GET /api/opportunities?type=competition` - Filter opportunity listings by type
- `GET /api/opportunities?type=fellowship` - List fellowship opportunities
- `GET /api/opportunities?type=training-workshop` - List training and workshop opportunities
- `GET /api/opportunity-types` - Available listing type values
- `POST /api/assistant/chat` - AI assistant chat using `openai` or `anthropic` (Requires Auth)
- `GET /api/news?source=insightGhana` - Normalized WordPress posts; omit `source` for both configured sources
- `POST /api/auth/verification-code/send` - Send an email verification code with Resend
- `POST /api/auth/verification-code/verify` - Verify an email code
