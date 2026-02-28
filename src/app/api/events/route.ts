import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getApiUser } from '@/lib/auth/api-auth';
import { eventCreateSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/utils';
import { DEFAULT_RSVP_FIELDS } from '@/lib/constants';

export async function GET() {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    const { data: events, error } = await adminSupabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(events);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = eventCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, event_date, event_end_date, location_name, location_address, host_name, dress_code, rsvp_deadline, registry_links, max_attendees, allow_plus_ones, max_guests_per_rsvp, design_url, design_type, customization, status } = parsed.data;

    // Use admin client for DB writes (auth verified above via getUser)
    const adminSupabase = createAdminClient();

    // Retry slug generation on collision (unique constraint)
    let event = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(title);
      const { data, error } = await adminSupabase
        .from('events')
        .insert({
          user_id: user.id,
          title,
          slug,
          description: description ?? null,
          event_date: event_date ?? null,
          event_end_date: event_end_date ?? null,
          location_name: location_name ?? null,
          location_address: location_address ?? null,
          host_name: host_name ?? null,
          dress_code: dress_code ?? null,
          rsvp_deadline: rsvp_deadline ?? null,
          registry_links: registry_links ?? [],
          ...(max_attendees !== undefined && { max_attendees: max_attendees }),
          ...(allow_plus_ones !== undefined && { allow_plus_ones }),
          ...(max_guests_per_rsvp !== undefined && { max_guests_per_rsvp }),
          design_url: design_url ?? null,
          design_type: design_type ?? 'upload',
          customization: customization ?? {},
          status: status ?? 'draft',
        })
        .select()
        .single();

      if (!error) {
        event = data;
        insertError = null;
        break;
      }

      // If not a unique constraint violation, don't retry
      if (error.code !== '23505') {
        insertError = error;
        break;
      }
      insertError = error;
    }

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Insert default RSVP fields for the new event
    const rsvpFields = DEFAULT_RSVP_FIELDS.map((field, index) => ({
      event_id: event.id,
      field_name: field.field_name,
      field_type: field.field_type,
      field_label: field.field_label,
      is_required: field.is_required,
      is_enabled: field.is_enabled,
      sort_order: index,
      options: field.options ?? null,
      placeholder: field.placeholder ?? null,
    }));

    const { error: rsvpError } = await adminSupabase
      .from('rsvp_fields')
      .insert(rsvpFields);

    if (rsvpError) {
      console.error('Failed to insert default RSVP fields:', rsvpError.message);
    }

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
