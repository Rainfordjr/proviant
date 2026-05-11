import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/validation";

const Body = z.object({
  redirect: z.string().min(1).startsWith("/"),
});

export async function POST(request: NextRequest) {
  // Caller must be authenticated (cookie session). We mint a magic link for
  // *that* user's email — never for an arbitrary email — so the resulting QR
  // can only log in as the operator who scanned the button.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = await parseBody(request, Body);
  if (!parsed.ok) return parsed.response;

  const origin = request.nextUrl.origin;
  const redirectTo = `${origin}${parsed.data.redirect}`;

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message || "Could not generate sign-in link" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: data.properties.action_link,
    redirect: redirectTo,
    email: user.email,
  });
}
