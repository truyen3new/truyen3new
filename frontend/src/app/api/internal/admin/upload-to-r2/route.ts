import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/server";
import { getServerSupabase } from "@/lib/supabase/server";

type Requester = { ok: boolean; role?: string };

function resolveRequesterRole(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function getRequester(request: NextRequest): Promise<Requester> {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret && process.env.INTERNAL_ADMIN_SECRET && internalSecret === process.env.INTERNAL_ADMIN_SECRET) {
    return { ok: true, role: 'internal' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authClient = supabaseUrl && supabaseKey ? createSupabaseClient(supabaseUrl, supabaseKey) : null;

  try {
    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice('Bearer '.length).trim();
      if (token && authClient) {
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData.user?.id;
        if (userError || !userId) return { ok: false };

        const supabase = getServerSupabase();
        if (supabase) {
          const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
          if (data?.role) return { ok: true, role: data.role };
        }

        const metadataRole =
          resolveRequesterRole(userData.user?.app_metadata?.role) ??
          resolveRequesterRole(userData.user?.user_metadata?.role);
        if (metadataRole) return { ok: true, role: metadataRole };
      }
    }

    const sessionClient = await createSessionClient();
    const { data: userData, error: userError } = await sessionClient.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return { ok: false };

    const supabase = getServerSupabase();
    if (supabase) {
      const { data } = await supabase.from('profiles').select('id,role').eq('id', userId).single();
      if (data?.role) return { ok: true, role: data.role };
    }

    const metadataRole =
      resolveRequesterRole(userData.user?.app_metadata?.role) ??
      resolveRequesterRole(userData.user?.user_metadata?.role);
    if (metadataRole) return { ok: true, role: metadataRole };

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials in environment");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const bucket = request.headers.get("x-r2-bucket")?.trim();
    if (!bucket) {
      return NextResponse.json({ error: "x-r2-bucket header is required" }, { status: 400 });
    }

    const requester = await getRequester(request);
    if (!requester.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['admin', 'superadmin'];
    if (!allowedRoles.includes(requester.role as string)) {
        return NextResponse.json({ error: 'forbidden: insufficient permissions' }, { status: 403 });
    }

    const form = await request.formData();
    const files = Array.from(form.values()).filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No files were uploaded" }, { status: 400 });
    }

    const r2 = getR2Client();
    const urls: string[] = [];

    for (const file of files) {
      const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const key = `${crypto.randomUUID()}${extension}`;
      const body = Buffer.from(await file.arrayBuffer());

      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: file.type || "application/octet-stream",
        }),
      );

      urls.push(`https://${bucket}.r2.cloudflarestorage.com/${key}`);
    }

    return NextResponse.json({ urls }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
