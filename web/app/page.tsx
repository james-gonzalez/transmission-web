"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const { data: session, status } = useSession()
  const isAuthenticated = status === "authenticated"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">My App</h1>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-600">
                    {session?.user?.email}
                  </span>
                  <Button variant="outline" onClick={() => signOut()}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline">Sign in</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Welcome to My App
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            A modern web application built with Next.js, featuring secure authentication
            and a beautiful user interface powered by shadcn/ui.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg">Go to Dashboard</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg">Get Started</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Secure Authentication</CardTitle>
              <CardDescription>
                Built with NextAuth.js for secure session management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Support for credentials, OAuth providers, and JWT sessions out of the box.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern UI</CardTitle>
              <CardDescription>
                Beautiful components with shadcn/ui
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Accessible, customizable components built on Radix UI and Tailwind CSS.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Type Safe</CardTitle>
              <CardDescription>
                Full TypeScript support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Type-safe APIs, components, and database queries for robust applications.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Demo Credentials */}
        {!isAuthenticated && (
          <div className="mt-16 text-center">
            <p className="text-sm text-gray-500">
              Try it out with demo credentials: <strong>user@example.com</strong> / <strong>password</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
