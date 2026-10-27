"use server";

import { requireShopClient, requireBarberInShop } from "@/lib/authorization";
import { z } from "zod";
import { createServerActionClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

const QuickBookingSchema = z.object({
  barbershop_id: z.string().uuid(),
  barber_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  service_ids: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos um serviço"),
  customer_name: z.string().min(2, "Nome é obrigatório"),
  customer_phone: z.string().min(8, "Telefone é obrigatório"),
  customer_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function createQuickBookingAction(
  formData: z.infer<typeof QuickBookingSchema>,
) {
  const parsed = QuickBookingSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await requireShopClient(parsed.data.barbershop_id, [
    "owner",
    "admin",
    "barber",
    "receptionist",
  ]);

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

export async function completeBookingAction(
  barbershopId: string,
  bookingId: string,
  paymentReceived = true,
) {
  const supabase = await requireShopClient(barbershopId, [
    "owner",
    "admin",
    "barber",
    "receptionist",
  ]);

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

export async function cancelBookingAction(
  barbershopId: string,
  bookingId: string,
  reason?: string,
) {
  const supabase = await requireShopClient(barbershopId, [
    "owner",
    "admin",
    "barber",
    "receptionist",
  ]);

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

export async function createServiceAction(
  barbershopId: string,
  service: {
    name: string;
    description?: string;
    price: number;
    duration_minutes: number;
    category?: string;
  },
) {
  z.object({
    name: z.string().trim().min(2).max(100),
    price: z.number().nonnegative().finite(),
    duration_minutes: z.number().int().min(5).max(480),
  }).parse(service);
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

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

export async function toggleServiceActiveAction(
  barbershopId: string,
  serviceId: string,
  currentStatus: boolean,
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

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

export async function updateSiteSettingsAction(
  barbershopId: string,
  settings: {
    brand_name?: string;
    brand_tagline?: string;
    accent_color?: string;
    hero_title?: string;
    hero_subtitle?: string;
    deposit_percentage?: number;
    cancellation_notice_hours?: number;
    about_history?: string;
    about_location?: string;
  },
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

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
  const supabase = await createServerActionClient();
  await supabase.auth.signOut();
}

export async function toggleShopClosedTodayAction(
  barbershopId: string,
  shouldClose: boolean,
  targetDate?: string,
  reason = "Fechado pelo administrador",
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);
  const dateStr = targetDate || new Date().toISOString().split("T")[0];

  if (shouldClose) {
    const { error } = await supabase.from("closed_days").upsert(
      {
        barbershop_id: barbershopId,
        date: dateStr,
        reason,
      },
      { onConflict: "barbershop_id, date" },
    );

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("closed_days")
      .delete()
      .eq("barbershop_id", barbershopId)
      .eq("date", dateStr);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/equipe");
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  return { success: true };
}

export async function createBarberAction(
  barbershopId: string,
  barber: { name: string; bio?: string; avatar_url?: string },
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

  const { data: newBarber, error } = await supabase
    .from("barbers")
    .insert({
      barbershop_id: barbershopId,
      name: barber.name,
      bio: barber.bio || null,
      avatar_url: barber.avatar_url || null,
      is_active: true,
    })
    .select()
    .single();

  if (error || !newBarber) {
    return {
      success: false,
      error: error?.message || "Falha ao criar barbeiro",
    };
  }

  // Criar expediente padrão (Segunda a Sábado 09:00 - 19:00 com almoço 12:00 - 13:00, Domingo folga)
  const defaultHours = [
    {
      barber_id: newBarber.id,
      day_of_week: 0,
      start_time: "09:00",
      end_time: "19:00",
      is_off: true,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 1,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 2,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 3,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 4,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 5,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
    {
      barber_id: newBarber.id,
      day_of_week: 6,
      start_time: "09:00",
      end_time: "19:00",
      is_off: false,
      lunch_start: "12:00",
      lunch_end: "13:00",
    },
  ];

  await supabase.from("working_hours").insert(defaultHours);

  // Vincular a todos os serviços ativos da barbearia por padrão
  const { data: allServices } = await supabase
    .from("services")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .eq("is_active", true);

  if (allServices && allServices.length > 0) {
    const barberServicesData = allServices.map((s) => ({
      barber_id: newBarber.id,
      service_id: s.id,
    }));
    await supabase.from("barber_services").insert(barberServicesData);
  }

  revalidatePath("/equipe");
  revalidatePath("/agenda");
  return { success: true, data: newBarber };
}

export async function toggleBarberActiveAction(
  barbershopId: string,
  barberId: string,
  currentStatus: boolean,
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

  const { error } = await supabase
    .from("barbers")
    .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
    .eq("id", barberId)
    .eq("barbershop_id", barbershopId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/equipe");
  revalidatePath("/agenda");
  return { success: true };
}

export async function deleteBarberAction(
  barbershopId: string,
  barberId: string,
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);

  const { error } = await supabase
    .from("barbers")
    .delete()
    .eq("id", barberId)
    .eq("barbershop_id", barbershopId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/equipe");
  revalidatePath("/agenda");
  return { success: true };
}

export async function saveWorkingHoursAction(
  barbershopId: string,
  barberId: string,
  hours: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_off: boolean;
    lunch_start?: string | null;
    lunch_end?: string | null;
  }>,
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);
  await requireBarberInShop(supabase, barbershopId, barberId);

  for (const h of hours) {
    const { error } = await supabase.from("working_hours").upsert(
      {
        barber_id: barberId,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_off: h.is_off,
        lunch_start: h.lunch_start || null,
        lunch_end: h.lunch_end || null,
      },
      { onConflict: "barber_id, day_of_week" },
    );

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/equipe");
  revalidatePath("/agenda");
  return { success: true };
}

export async function saveBarberServicesAction(
  barbershopId: string,
  barberId: string,
  serviceIds: string[],
) {
  const supabase = await requireShopClient(barbershopId, ["owner", "admin"]);
  await requireBarberInShop(supabase, barbershopId, barberId);

  z.array(z.string().uuid()).max(100).parse(serviceIds);
  if (serviceIds.length) {
    const { data, error } = await supabase
      .from("services")
      .select("id")
      .eq("barbershop_id", barbershopId)
      .in("id", serviceIds);
    if (error || data?.length !== new Set(serviceIds).size)
      throw new Error("Serviço não pertence à barbearia.");
  }
  // Remove vínculos atuais
  await supabase.from("barber_services").delete().eq("barber_id", barberId);

  // Insere novos vínculos
  if (serviceIds.length > 0) {
    const toInsert = serviceIds.map((sid) => ({
      barber_id: barberId,
      service_id: sid,
    }));
    const { error } = await supabase.from("barber_services").insert(toInsert);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/equipe");
  revalidatePath("/agenda");
  return { success: true };
}

export async function markNoShowAction(
  barbershopId: string,
  bookingId: string,
) {
  const supabase = await requireShopClient(barbershopId, [
    "owner",
    "admin",
    "barber",
    "receptionist",
  ]);
  const { error } = await supabase.rpc("admin_mark_no_show", {
    p_barbershop_id: barbershopId,
    p_booking_id: bookingId,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/agenda");
  return { success: true };
}
