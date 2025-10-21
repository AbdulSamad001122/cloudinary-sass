import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// ✅ Define public page routes
const isPublicRoute = createRouteMatcher([
  "/",               // Landing page
  "/sign-in",        // Sign in page
  "/sign-up",        // Sign up page
])

// ✅ Define public API routes
const isPublicApiRoute = createRouteMatcher([
  "/api/videos",     // Example: public API route
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  const currentUrl = new URL(req.url)
  const pathname = currentUrl.pathname

  const isAccessingDashboard = pathname === "/home"     // Protected route
  const isApiRequest = pathname.startsWith("/api")      // API check

  // ✅ If user is logged in and trying to access a public page (excluding /sign-in and /sign-up)
  if (
    userId &&
    isPublicRoute(req) &&
    !isAccessingDashboard &&
    pathname !== "/sign-in" &&
    pathname !== "/sign-up"
  ) {
    return NextResponse.redirect(new URL("/home", req.url))
  }

  // ✅ If user is NOT logged in
  if (!userId) {
    // If trying to access a protected page
    if (!isPublicRoute(req) && !isPublicApiRoute(req)) {
      return NextResponse.redirect(new URL("/sign-in", req.url))
    }

    // If trying to call a protected API
    if (isApiRequest && !isPublicApiRoute(req)) {
      return NextResponse.redirect(new URL("/sign-in", req.url))
    }
  }

  // ✅ Allow request to continue normally
  return NextResponse.next()
})

// ✅ Middleware matcher: Run middleware only on app routes and APIs
export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
