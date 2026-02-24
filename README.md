# Weavy - AI Workflow Builder

Weavy is a powerful, node-based AI workflow automation platform built with Next.js 15. It allows users to visually chain together AI models (LLMs, Image Generation) and media processing tools (FFmpeg, Sharp) to build complex pipelines.

## 🚀 Features

- **Visual Workflow Builder**: Drag-and-drop React Flow canvas.
- **Node-Based Execution**: Chain nodes and pass data between them.
- **AI Integration**:
  - **Groq (Llama 3)** for ultra-fast text generation and intent classification.
  - **Hugging Face (SDXL)** for high-quality image generation.
- **Media Processing**:
  - **Video**: Frame extraction, resizing, and metadata parsing (FFmpeg).
  - **Image**: Cropping, resizing, and format conversion (Sharp).
- **Production Ready**:
  - **Cloudinary Integration**: Automatic media upload for persistent storage.
  - **PostgreSQL (Prisma)**: Robust data layer for saving workflows and run history.
  - **Authentication**: Secure user management via Clerk.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **UI**: Tailwind CSS + Shadcn UI + Lucide Icons
- **State Management**: Zustand
- **Canvas**: React Flow (xyflow)
- **AI/ML**: Groq SDK, Hugging Face Inference
- **Media**: FFmpeg (fluent-ffmpeg), Sharp

## 📦 Prerequisites

- Node.js 18+
- PostgreSQL Database (Local or Vercel Postgres/Neon)
- Cloudinary Account (Optional for local dev, Required for production)
- Groq & Hugging Face API Keys

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/weavy.git
   cd weavy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   
   > **Note**: For local development, `CLOUDINARY_*` keys are optional (files will be saved to `public/outputs`). For production, they are required.

4. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to start building workflows!

## 🚢 Deployment (Vercel)

1. Push your code to GitHub.
2. Import the project in Vercel.
3. Add the **Environment Variables** from your `.env` file to Vercel Project Settings.
   - ensuring `DATABASE_URL` points to a cloud database (e.g., Vercel Postgres, Neon, Supabase).
   - ensuring `CLOUDINARY_*` keys are set for persistent media storage.
4. Deploy!

## 🧪 Testing

Run production build locally to verify:
```bash
npm run build
npm start
```
