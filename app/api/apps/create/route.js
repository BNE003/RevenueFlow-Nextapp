import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";

// This function creates a new app for the authenticated user
export async function POST(req) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // User must be authenticated
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to create an app." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "App name is required" },
        { status: 400 }
      );
    }

    // Generate a unique app_id (using a readable format: app_ + random string)
    const app_id = `app_${crypto.randomBytes(16).toString("hex")}`;

    // Insert the new app into the apps table
    const { data, error } = await supabase
      .from("apps")
      .insert([
        {
          app_id: app_id,
          name: name.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating app:", error);
      return NextResponse.json(
        { error: "Failed to create app. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ app: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
