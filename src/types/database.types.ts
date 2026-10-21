export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BookingStatus =
  | "hold"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | "partially_refunded"
  | "expired";

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "cash" | "in_person";

export type ShopMemberRole = "owner" | "staff";

export interface Database {
  public: {
    Tables: {
      barbershops: {
        Row: {
          id: string;
          name: string;
          slug: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          timezone?: string;
          updated_at?: string;
        };
      };
      shop_members: {
        Row: {
          id: string;
          barbershop_id: string;
          user_id: string;
          role: ShopMemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          user_id: string;
          role?: ShopMemberRole;
          created_at?: string;
        };
        Update: {
          role?: ShopMemberRole;
        };
      };
      barbers: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          bio: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          name: string;
          bio?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          buffer_minutes: number;
          price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          buffer_minutes?: number;
          price: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          buffer_minutes?: number;
          price?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      barber_services: {
        Row: {
          barber_id: string;
          service_id: string;
        };
        Insert: {
          barber_id: string;
          service_id: string;
        };
        Update: {
          barber_id?: string;
          service_id?: string;
        };
      };
      working_hours: {
        Row: {
          id: string;
          barber_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_off: boolean;
        };
        Insert: {
          id?: string;
          barber_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_off?: boolean;
        };
        Update: {
          start_time?: string;
          end_time?: string;
          is_off?: boolean;
        };
      };
      breaks: {
        Row: {
          id: string;
          working_hour_id: string;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          working_hour_id: string;
          start_time: string;
          end_time: string;
        };
        Update: {
          start_time?: string;
          end_time?: string;
        };
      };
      closed_days: {
        Row: {
          id: string;
          barbershop_id: string;
          date: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          date: string;
          reason?: string | null;
        };
        Update: {
          date?: string;
          reason?: string | null;
        };
      };
      time_off: {
        Row: {
          id: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          barber_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
        };
        Update: {
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
        };
      };
      customers: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          phone: string;
          email: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          name: string;
          phone: string;
          email: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          phone?: string;
          email?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          barbershop_id: string;
          barber_id: string;
          customer_id: string;
          starts_at: string;
          ends_at: string;
          total_price: number;
          deposit_amount: number;
          status: BookingStatus;
          hold_expires_at: string | null;
          cancellation_token_hash: string | null;
          cancellation_token_expires_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          barber_id: string;
          customer_id: string;
          starts_at: string;
          ends_at: string;
          total_price: number;
          deposit_amount?: number;
          status?: BookingStatus;
          hold_expires_at?: string | null;
          cancellation_token_hash?: string | null;
          cancellation_token_expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          starts_at?: string;
          ends_at?: string;
          total_price?: number;
          deposit_amount?: number;
          status?: BookingStatus;
          hold_expires_at?: string | null;
          cancellation_token_hash?: string | null;
          cancellation_token_expires_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      booking_items: {
        Row: {
          id: string;
          booking_id: string;
          service_id: string;
          service_name: string;
          price: number;
          duration_minutes: number;
        };
        Insert: {
          id?: string;
          booking_id: string;
          service_id: string;
          service_name: string;
          price: number;
          duration_minutes: number;
        };
        Update: {
          service_name?: string;
          price?: number;
          duration_minutes?: number;
        };
      };
      payments: {
        Row: {
          id: string;
          barbershop_id: string;
          booking_id: string;
          amount: number;
          method: PaymentMethod;
          status: PaymentStatus;
          external_payment_id: string | null;
          pix_qr_code: string | null;
          pix_copy_paste: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          booking_id: string;
          amount: number;
          method: PaymentMethod;
          status?: PaymentStatus;
          external_payment_id?: string | null;
          pix_qr_code?: string | null;
          pix_copy_paste?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          method?: PaymentMethod;
          status?: PaymentStatus;
          external_payment_id?: string | null;
          pix_qr_code?: string | null;
          pix_copy_paste?: string | null;
          updated_at?: string;
        };
      };
      payment_events: {
        Row: {
          id: string;
          event_key: string;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_key: string;
          event_type: string;
          payload: Json;
          created_at?: string;
        };
      };
      site_settings: {
        Row: {
          barbershop_id: string;
          brand_name: string;
          brand_tagline: string | null;
          accent_color: string;
          hero_title: string;
          hero_subtitle: string;
          hero_image_url: string | null;
          deposit_percentage: number;
          min_booking_notice_hours: number;
          max_booking_ahead_days: number;
          cancellation_notice_hours: number;
          instagram_url: string | null;
          maps_embed_url: string | null;
          about_history: string | null;
          about_location: string | null;
          about_payment_methods: string | null;
          updated_at: string;
        };
        Insert: {
          barbershop_id: string;
          brand_name?: string;
          brand_tagline?: string | null;
          accent_color?: string;
          hero_title?: string;
          hero_subtitle?: string;
          hero_image_url?: string | null;
          deposit_percentage?: number;
          min_booking_notice_hours?: number;
          max_booking_ahead_days?: number;
          cancellation_notice_hours?: number;
          instagram_url?: string | null;
          maps_embed_url?: string | null;
          about_history?: string | null;
          about_location?: string | null;
          about_payment_methods?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_name?: string;
          brand_tagline?: string | null;
          accent_color?: string;
          hero_title?: string;
          hero_subtitle?: string;
          hero_image_url?: string | null;
          deposit_percentage?: number;
          min_booking_notice_hours?: number;
          max_booking_ahead_days?: number;
          cancellation_notice_hours?: number;
          instagram_url?: string | null;
          maps_embed_url?: string | null;
          about_history?: string | null;
          about_location?: string | null;
          about_payment_methods?: string | null;
          updated_at?: string;
        };
      };
      faq_items: {
        Row: {
          id: string;
          barbershop_id: string;
          question: string;
          answer: string;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          question: string;
          answer: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          question?: string;
          answer?: string;
          sort_order?: number;
          is_active?: boolean;
        };
      };
      gallery_items: {
        Row: {
          id: string;
          barbershop_id: string;
          image_url: string;
          title: string | null;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          image_url: string;
          title?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          image_url?: string;
          title?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
      };
      reviews: {
        Row: {
          id: string;
          barbershop_id: string;
          customer_name: string;
          rating: number;
          comment: string;
          is_approved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          barbershop_id: string;
          customer_name: string;
          rating: number;
          comment: string;
          is_approved?: boolean;
          created_at?: string;
        };
        Update: {
          is_approved?: boolean;
        };
      };
    };
    Views: {
      public_barbers: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          bio: string | null;
          avatar_url: string | null;
        };
      };
      public_services: {
        Row: {
          id: string;
          barbershop_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price: number;
        };
      };
      public_site_settings: {
        Row: {
          barbershop_id: string;
          brand_name: string;
          brand_tagline: string | null;
          accent_color: string;
          hero_title: string;
          hero_subtitle: string;
          hero_image_url: string | null;
          deposit_percentage: number;
          instagram_url: string | null;
          maps_embed_url: string | null;
          about_history: string | null;
          about_location: string | null;
          about_payment_methods: string | null;
        };
      };
      public_faq_items: {
        Row: {
          id: string;
          barbershop_id: string;
          question: string;
          answer: string;
          sort_order: number;
        };
      };
      public_gallery_items: {
        Row: {
          id: string;
          barbershop_id: string;
          image_url: string;
          title: string | null;
          sort_order: number;
        };
      };
      public_reviews: {
        Row: {
          id: string;
          barbershop_id: string;
          customer_name: string;
          rating: number;
          comment: string;
          created_at: string;
        };
      };
    };
    Functions: {
      get_availability: {
        Args: {
          p_barbershop_id: string;
          p_barber_id: string | null;
          p_date: string;
          p_service_ids: string[];
        };
        Returns: {
          barber_id: string;
          start_time: string;
          end_time: string;
        }[];
      };
      create_booking_hold: {
        Args: {
          p_barbershop_id: string;
          p_barber_id: string | null;
          p_starts_at: string;
          p_service_ids: string[];
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email: string;
          p_marketing_consent?: boolean;
        };
        Returns: {
          booking_id: string;
          barber_id: string;
          hold_expires_at: string;
          total_price: number;
          deposit_amount: number;
          cancellation_token: string;
        };
      };
      get_booking_by_token: {
        Args: {
          p_token: string;
        };
        Returns: {
          id: string;
          status: BookingStatus;
          starts_at: string;
          ends_at: string;
          barber_name: string;
          customer_name: string;
          services: string[];
          total_price: number;
          deposit_amount: number;
          can_cancel: boolean;
          can_reschedule: boolean;
        };
      };
      cancel_booking_by_token: {
        Args: {
          p_token: string;
          p_reason?: string;
        };
        Returns: {
          success: boolean;
          message: string;
        };
      };
      reschedule_booking_by_token: {
        Args: {
          p_token: string;
          p_new_starts_at: string;
          p_new_barber_id?: string;
        };
        Returns: {
          success: boolean;
          message: string;
          new_starts_at: string;
          new_ends_at: string;
        };
      };
      admin_create_booking: {
        Args: {
          p_barbershop_id: string;
          p_barber_id: string;
          p_starts_at: string;
          p_service_ids: string[];
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email?: string;
          p_payment_method?: PaymentMethod;
          p_notes?: string;
        };
        Returns: {
          success: boolean;
          booking_id: string;
          starts_at: string;
          ends_at: string;
          total_price: number;
        };
      };
      admin_complete_booking: {
        Args: {
          p_barbershop_id: string;
          p_booking_id: string;
          p_payment_received?: boolean;
        };
        Returns: {
          success: boolean;
        };
      };
      admin_cancel_booking: {
        Args: {
          p_barbershop_id: string;
          p_booking_id: string;
          p_reason?: string;
        };
        Returns: {
          success: boolean;
        };
      };
      admin_mark_no_show: {
        Args: {
          p_barbershop_id: string;
          p_booking_id: string;
        };
        Returns: {
          success: boolean;
        };
      };
      admin_block_time: {
        Args: {
          p_barbershop_id: string;
          p_barber_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_reason?: string;
        };
        Returns: {
          success: boolean;
          time_off_id: string;
        };
      };
    };
  };
}
