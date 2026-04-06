"use client"

import { useSession, signOut } from "next-auth/react"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">My App</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session?.user?.email}
              </span>
              <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Welcome!</CardTitle>
              <CardDescription>
                You're now signed in and can access protected content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                This is a protected dashboard page. Only authenticated users can see this.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Name:</span> {session?.user?.name}
              </div>
              <div className="text-sm">
                <span className="font-medium">Email:</span> {session?.user?.email}
              </div>
              <div className="text-sm">
                <span className="font-medium">User ID:</span> {session?.user?.id}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Edit Profile
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Settings
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Help & Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
