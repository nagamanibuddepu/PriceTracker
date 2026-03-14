"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getDatabase, isMongoAvailable } from "./mongodb"
import type { ObjectId } from "mongodb"

interface User {
  _id?: ObjectId
  id: string
  email: string
  name: string
  createdAt: string
}

interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

// Fallback in-memory storage for preview environment
const fallbackUsers: Map<string, User & { password: string }> = new Map()
const fallbackSessions: Map<string, { userId: string; expiresAt: Date }> = new Map()

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Remove bcrypt import and use simple hashing
function hashPassword(password: string): string {
  // Simple hash for preview environment
  return Buffer.from(password + "salt").toString("base64")
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

// Add the missing testConnection function
export async function testConnection(): Promise<boolean> {
  try {
    const db = await getDatabase()
    if (db && isMongoAvailable()) {
      // Test MongoDB connection
      await db.admin().ping()
      console.log("MongoDB connection successful")
      return true
    } else {
      // Fallback storage is always available
      console.log("Using fallback storage (no MongoDB)")
      return true
    }
  } catch (error) {
    console.error("Connection test failed:", error)
    return false
  }
}

// Update register function to use simple hashing
export async function register(email: string, password: string, name: string): Promise<AuthResult> {
  try {
    console.log("[AUTH] Attempting registration for email:", email)
    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      console.log("[AUTH] Using MongoDB for registration")
      try {
        const bcrypt = await import("bcryptjs")
        const users = db.collection("users")
        const sessions = db.collection("sessions")

        // Check for existing user with case-insensitive email
        const existingUser = await users.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') } 
        })
        console.log("[AUTH] Existing user check:", existingUser ? "Found" : "Not found")
        
        if (existingUser) {
          console.log("[AUTH] User already exists:", email)
          return { success: false, error: "User already exists" }
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        console.log("[AUTH] Password hashed successfully:", {
          originalLength: password.length,
          hashedLength: hashedPassword.length,
          hashedPrefix: hashedPassword.substring(0, 10) + "..."
        })

        const userId = generateId()
        const user = {
          id: userId,
          email: email.toLowerCase(),
          password: hashedPassword,
          name,
          createdAt: new Date().toISOString(),
        }

        await users.insertOne(user)
        console.log("[AUTH] User created successfully:", {
          id: userId,
          email: user.email,
          name: user.name
        })

        const sessionId = generateId()
        const session = {
          id: sessionId,
          userId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        }

        await sessions.insertOne(session)
        console.log("[AUTH] Session created successfully")

        cookies().set("session", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
        })

        return {
          success: true,
          user: { id: userId, email: user.email, name: user.name, createdAt: user.createdAt },
        }
      } catch (error) {
        console.error("[AUTH] Error during MongoDB registration:", error)
        console.warn("bcrypt not available, using fallback")
        // Fall through to fallback storage
      }
    }

    // Use fallback storage with simple hashing
    console.log("[AUTH] Using fallback storage for register")
    for (const user of fallbackUsers.values()) {
      if (user.email === email) {
        return { success: false, error: "User already exists" }
      }
    }

    const userId = generateId()
    const user: User & { password: string } = {
      id: userId,
      email,
      name,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
    }

    fallbackUsers.set(userId, user)

    const sessionId = generateId()
    fallbackSessions.set(sessionId, {
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    cookies().set("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    })

    return {
      success: true,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    }
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, error: "Registration failed" }
  }
}

// Update login function similarly
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    console.log("[AUTH] Attempting login for email:", email)
    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      console.log("[AUTH] Using MongoDB for login")
      try {
        const bcrypt = await import("bcryptjs")
        const users = db.collection("users")
        const sessions = db.collection("sessions")

        // Find user with case-insensitive email
        const user = await users.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') } 
        })
        console.log("[AUTH] User found:", user ? "Yes" : "No")
        
        if (!user) {
          console.log("[AUTH] No user found with email:", email)
          return { success: false, error: "Invalid credentials" }
        }

        console.log("[AUTH] Found user:", {
          id: user.id,
          email: user.email,
          hasPassword: !!user.password,
          passwordLength: user.password?.length
        })

        const isValidPassword = await bcrypt.compare(password, user.password)
        console.log("[AUTH] Password comparison result:", {
          isValid: isValidPassword,
          providedPasswordLength: password.length,
          storedPasswordHash: user.password?.substring(0, 10) + "..."
        })
        
        if (!isValidPassword) {
          console.log("[AUTH] Invalid password for user:", email)
          return { success: false, error: "Invalid credentials" }
        }

        const sessionId = generateId()
        const session = {
          id: sessionId,
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        }

        await sessions.insertOne(session)
        console.log("[AUTH] Session created successfully")

        cookies().set("session", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60,
        })

        return {
          success: true,
          user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        }
      } catch (error) {
        console.error("[AUTH] Error during MongoDB login:", error)
        console.warn("bcrypt not available, using fallback")
        // Fall through to fallback storage
      }
    }

    // Use fallback storage
    console.log("[AUTH] Using fallback storage for login")
    let foundUser: (User & { password: string }) | undefined
    for (const user of fallbackUsers.values()) {
      if (user.email === email) {
        foundUser = user
        break
      }
    }

    if (!foundUser || !verifyPassword(password, foundUser.password)) {
      return { success: false, error: "Invalid credentials" }
    }

    const sessionId = generateId()
    fallbackSessions.set(sessionId, {
      userId: foundUser.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    cookies().set("session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    })

    return {
      success: true,
      user: { id: foundUser.id, email: foundUser.email, name: foundUser.name, createdAt: foundUser.createdAt },
    }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Login failed" }
  }
}

export async function logout(): Promise<void> {
  try {
    const sessionId = cookies().get("session")?.value
    if (sessionId) {
      const db = await getDatabase()

      if (db && isMongoAvailable()) {
        const sessions = db.collection("sessions")
        await sessions.deleteOne({ id: sessionId })
      } else {
        fallbackSessions.delete(sessionId)
      }

      cookies().delete("session")
    }
  } catch (error) {
    console.error("Logout error:", error)
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const sessionId = cookies().get("session")?.value
    if (!sessionId) return null

    const db = await getDatabase()

    if (db && isMongoAvailable()) {
      // Use MongoDB
      const sessions = db.collection("sessions")
      const users = db.collection("users")

      const session = await sessions.findOne({
        id: sessionId,
        expiresAt: { $gt: new Date() },
      })

      if (!session) {
        await sessions.deleteOne({ id: sessionId })
        return null
      }

      const user = await users.findOne({ id: session.userId })
      if (!user) return null

      return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
    } else {
      // Use fallback storage
      const session = fallbackSessions.get(sessionId)
      if (!session || session.expiresAt < new Date()) {
        if (session) fallbackSessions.delete(sessionId)
        return null
      }

      const user = fallbackUsers.get(session.userId)
      if (!user) return null

      return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
    }
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/login")
  }
  return user
}
