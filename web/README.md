# Next.js Web Application

A modern web application built with Next.js 15, featuring secure authentication with NextAuth.js and beautiful UI components from shadcn/ui.

## Features

- ✅ **Authentication** - Secure login with NextAuth.js (credentials provider)
- ✅ **Protected Routes** - Dashboard accessible only to authenticated users
- ✅ **Modern UI** - Beautiful components using shadcn/ui and Tailwind CSS
- ✅ **Type Safe** - Full TypeScript support
- ✅ **Responsive** - Mobile-friendly design

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# The .env.local file is already created with default values
# For production, generate a secure secret:
openssl rand -base64 32
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Credentials

Use these credentials to test the authentication:

- **Email:** `user@example.com`
- **Password:** `password`

## Project Structure

```
app/
├── api/auth/[...nextauth]/   # NextAuth.js API routes
├── dashboard/                 # Protected dashboard page
├── login/                     # Login page
├── layout.tsx                 # Root layout with AuthProvider
├── page.tsx                   # Landing page
├── globals.css                # Global styles
components/
├── auth-provider.tsx          # NextAuth session provider
├── ui/                        # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── label.tsx
lib/
└── utils.ts                   # Utility functions
types/
└── next-auth.d.ts             # TypeScript types for NextAuth
```

## Customization

### Adding OAuth Providers

To add OAuth providers (Google, GitHub, etc.), update `app/api/auth/[...nextauth]/route.ts`:

```typescript
import GoogleProvider from "next-auth/providers/google"

providers: [
  CredentialsProvider({...}),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
]
```

### Adding Database

For production, replace the hardcoded credentials with database queries:

```typescript
async authorize(credentials) {
  const user = await db.user.findUnique({
    where: { email: credentials.email }
  })
  
  if (user && await compare(credentials.password, user.password)) {
    return { id: user.id, name: user.name, email: user.email }
  }
  
  return null
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

Build for production:
```bash
npm run build
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [shadcn/ui Documentation](https://ui.shadcn.com)
