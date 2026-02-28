import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { rsvpFieldSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ eventId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: event, error: eventError } = await adminSupabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const { data: fields, error } = await adminSupabase
      .from('rsvp_fields')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(fields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { eventId } = await params;
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    // Verify ownership
    const { data: event, error: eventError } = await adminSupabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an array of RSVP field objects' },
        { status: 400 }
      );
    }

    // Validate ALL fields BEFORE deleting existing ones (atomic approach)
    const fields = [];
    for (let index = 0; index < body.length; index++) {
      const parsed = rsvpFieldSchema.safeParse(body[index]);
      if (!parsed.success) {
        return NextResponse.json(
          { error: `Invalid field at index ${index}`, details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      fields.push({
        event_id: eventId,
        field_name: parsed.data.field_name,
        field_type: parsed.data.field_type,
        field_label: parsed.data.field_label,
        is_required: parsed.data.is_required,
        is_enabled: parsed.data.is_enabled,
        sort_order: index,
        options: parsed.data.options ?? null,
        placeholder: parsed.data.placeholder ?? null,
      });
    }

    // Delete existing RSVP fields for this event (only after validation passes)
    const { error: deleteError } = await adminSupabase
      .from('rsvp_fields')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Insert validated fields
    if (fields.length > 0) {
      const { error: insertError } = await adminSupabase
        .from('rsvp_fields')
        .insert(fields);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    // Return the newly inserted fields
    const { data: updatedFields, error: fetchError } = await adminSupabase
      .from('rsvp_fields')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedFields);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
