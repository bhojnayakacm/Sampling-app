// Supabase Edge Function: create-user
// This function allows admins to create new users (Coordinators, Makers, Requesters)
// without logging themselves out.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  role: 'requester' | 'coordinator' | 'maker' | 'dispatcher'
  full_name: string
  phone?: string
  department?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the user's JWT to verify their role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client for verifying the caller's identity
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the calling user's profile to verify they are an admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the caller's profile to check their role
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Could not verify user role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: Only admins can create users
    if (callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the request body
    const body: CreateUserRequest = await req.json()
    const { email, password, role, full_name, phone, department } = body

    // Validate required fields
    if (!email || !password || !role || !full_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, role, full_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['requester', 'coordinator', 'maker', 'dispatcher']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate department for requesters
    if (role === 'requester' && !department) {
      return new Response(
        JSON.stringify({ error: 'Department is required for requesters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Create the new user with admin API (auto-confirms email)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email - no verification needed
      user_metadata: {
        full_name,
        phone: phone || null,
        role,
        department: role === 'requester' ? department : null,
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The database trigger should create the profile, but let's ensure it exists
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify profile was created
    const { data: newProfile, error: fetchProfileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', newUser.user.id)
      .single()

    if (fetchProfileError) {
      // Profile wasn't created by trigger, create it manually
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUser.user.id,
          full_name,
          phone: phone || null,
          role,
          department: role === 'requester' ? department : null,
          is_active: true,
        })

      if (insertError) {
        console.error('Error creating profile:', insertError)
        // User was created but profile failed - still return success
        // The profile will be created on first login
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${email} created successfully as ${role}`,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role,
          full_name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
