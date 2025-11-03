-- ============================================
-- Fix Ambiguous Column Reference in update_kina_booking Function
-- ============================================
-- This fixes the error: "column reference 'id' is ambiguous"
-- The WHERE clause needs to explicitly reference the table column
-- Date: 2025-01-29

-- Fix update_kina_booking function
CREATE OR REPLACE FUNCTION public.update_kina_booking(
    p_id integer, 
    p_user_id uuid DEFAULT NULL::uuid, 
    p_package_id integer DEFAULT NULL::integer, 
    p_check_in date DEFAULT NULL::date, 
    p_check_out date DEFAULT NULL::date, 
    p_guests jsonb DEFAULT NULL::jsonb, 
    p_status text DEFAULT NULL::text, 
    p_total_cost numeric DEFAULT NULL::numeric, 
    p_payment_mode text DEFAULT NULL::text, 
    p_contact_number text DEFAULT NULL::text, 
    p_special_requests text DEFAULT NULL::text, 
    p_per_room_guests jsonb DEFAULT NULL::jsonb, 
    p_selected_cottages jsonb DEFAULT NULL::jsonb, 
    p_function_hall_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(
    id integer, 
    user_id uuid, 
    package_id integer, 
    check_in date, 
    check_out date, 
    guests jsonb, 
    status text, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone, 
    total_cost numeric, 
    payment_mode text, 
    per_room_guests jsonb, 
    contact_number text, 
    special_requests text, 
    selected_cottages jsonb, 
    function_hall_metadata jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking kina.bookings%ROWTYPE;
BEGIN
  UPDATE kina.bookings AS kb SET
    user_id = COALESCE(p_user_id, kb.user_id),
    package_id = COALESCE(p_package_id, kb.package_id),
    check_in = COALESCE(p_check_in, kb.check_in),
    check_out = COALESCE(p_check_out, kb.check_out),
    guests = COALESCE(p_guests, kb.guests),
    status = COALESCE(p_status, kb.status),
    total_cost = COALESCE(p_total_cost, kb.total_cost),
    payment_mode = COALESCE(p_payment_mode, kb.payment_mode),
    contact_number = COALESCE(p_contact_number, kb.contact_number),
    special_requests = COALESCE(p_special_requests, kb.special_requests),
    per_room_guests = COALESCE(p_per_room_guests, kb.per_room_guests),
    selected_cottages = COALESCE(p_selected_cottages, kb.selected_cottages),
    function_hall_metadata = COALESCE(p_function_hall_metadata, kb.function_hall_metadata),
    updated_at = NOW()
  WHERE kb.id = p_id
  RETURNING * INTO v_booking;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking with id % not found', p_id;
  END IF;
  
  RETURN QUERY SELECT 
    v_booking.id, v_booking.user_id, v_booking.package_id,
    v_booking.check_in, v_booking.check_out, v_booking.guests,
    v_booking.status, v_booking.created_at, v_booking.updated_at,
    v_booking.total_cost, v_booking.payment_mode, v_booking.per_room_guests,
    v_booking.contact_number, v_booking.special_requests,
    v_booking.selected_cottages, v_booking.function_hall_metadata;
END;
$function$;

-- Fix delete_kina_booking function (preventive - for consistency)
CREATE OR REPLACE FUNCTION public.delete_kina_booking(p_id integer)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM kina.bookings WHERE kina.bookings.id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking with id % not found', p_id;
  END IF;
END;
$function$;

-- ============================================
-- Verification
-- ============================================
-- Test that the function works:
-- SELECT update_kina_booking(31, NULL, NULL, NULL, NULL, NULL, 'confirmed', NULL, NULL, NULL, NULL, NULL, NULL, NULL);

