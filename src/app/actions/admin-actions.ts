"use server";

import { z } from "zod";
import { createServerActionClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

const QuickBookingSchema = z.object({
  barbershop_id: z.string().uuid(),
  barber_id: z.string().uuid(),
  starts_at: z.string(),
  service_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um serviço"),
  customer_name: z.string().min(2, "Nome é obrigatório"),
  customer_phone: z.string().min(8, "Telefone é obrigatório"),
  customer_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function createQuickBookingAction(formData: z.infer<typeof QuickBookingSchema>) {
  const parsed = QuickBookingSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = createServerActionClient();

  const { data, error } = await supabase.rpc("admin_create_booking", {
    p_barbershop_id: parsed.data.barbershop_id,
    p_barber_id: parsed.data.barber_id,
    p_starts_at: parsed.data.starts_at,
    p_service_ids: parsed.data.service_ids,
    p_customer_name: parsed.data.customer_name,
    p_customer_phone: parsed.data.customer_phone,
    p_customer_email: parsed.data.customer_email || undefined,
    p_payment_method: "in_person",
    p_notes: parsed.data.notes || undefined,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function completeBookingAction(barbershopId: string, bookingId: string, paymentReceived = true) {
  const supabase = createServerActionClient();

  const { data, error } = await supabase.rpc("admin_complete_booking", {
    p_barbershop_id: barbershopId,
    p_booking_id: bookingId,
    p_payment_received: paymentReceived,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  return { success: true, data };
}

export async function cancelBookingAction(barbershopId: string, bookingId: string, reason?: string) {
  const supabase = createServerActionClient();

  const { data, error } = await supabase.rpc("admin_cancel_booking", {
    p_barbershop_id: barbershopId,
    p_booking_id: bookingId,
    p_reason: reason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { success: true, data };
}

export async function createServiceAction(barbershopId: string, service: {
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category?: string;
}) {
  const supabase = createServerActionClient();

  const { data, error } = await supabase
    .from("services")
    .insert({
      barbershop_id: barbershopId,
      name: service.name,
      description: service.description || null,
      price: service.price,
      duration_minutes: service.duration_minutes,
      category: service.category || "Cabelo",
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/servicos");
  return { success: true, data };
}

export async function toggleServiceActiveAction(barbershopId: string, serviceId: string, currentStatus: boolean) {
  const supabase = createServerActionClient();

  const { error } = await supabase
    .from("services")
    .update({ is_active: !currentStatus })
    .eq("id", serviceId)
    .eq("barbershop_id", barbershopId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/servicos");
  return { success: true };
}

export async function updateSiteSettingsAction(barbershopId: string, settings: {
  brand_name?: string;
  brand_tagline?: string;
  accent_color?: string;
  hero_title?: string;
  hero_subtitle?: string;
  deposit_percentage?: number;
  cancellation_notice_hours?: number;
  about_history?: string;
  about_location?: string;
}) {
  const supabase = createServerActionClient();

  const { error } = await supabase
    .from("site_settings")
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq("barbershop_id", barbershopId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function logoutAction() {
  const supabase = createServerActionClient();
  await supabase.auth.signOut();
}
