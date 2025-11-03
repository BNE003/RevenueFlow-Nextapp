import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// This function fetches all apps for the authenticated user
export async function GET(req) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // User must be authenticated
    if (!session) {
      return NextResponse.json(
        { error: "You must be logged in to view apps." },
        { status: 401 }
      );
    }

    // Fetch all apps, ordered by creation date (newest first)
    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching apps:", error);
      return NextResponse.json(
        { error: "Failed to fetch apps. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ apps: data || [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
