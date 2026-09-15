export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
export type RequestRow = {
  accepted_at: string | null;
  delivery_due_at: string | null;
  id: string;
  creator_id: string;
  service_id: string;
  requester_id: string;
  idempotency_key: string;
  snapshot: Json;
  requester_name: string;
  requester_email: string;
  notes: string;
  answers: Json;
  preferred_date: string | null;
  start_at: string | null;
  end_at: string | null;
  reserved_from: string | null;
  reserved_until: string | null;
  visitor_timezone: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Database = {
  public: {
    Tables: {
      dt_page_drafts: Table<{
        creator_id: string;
        document: Json;
        revision: number;
        updated_at: string;
      }>;
      dt_services: Table<{
        id: string;
        creator_id: string;
        definition: Json;
        active: boolean;
      }>;
      dt_requests: Table<RequestRow>;
      profiles_private: {
        Row: {
          id: string;
          whatsapp_number: string | null;
          whatsapp_verified_at: string | null;
          is_adult: boolean;
          terms_accepted_at: string | null;
          privacy_accepted_at: string | null;
          whatsapp_notifications_consent_at: string | null;
          requests_paused_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          whatsapp_number?: string | null;
          whatsapp_verified_at?: string | null;
          is_adult?: boolean;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          whatsapp_notifications_consent_at?: string | null;
          requests_paused_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          whatsapp_number?: string | null;
          whatsapp_verified_at?: string | null;
          is_adult?: boolean;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          whatsapp_notifications_consent_at?: string | null;
          requests_paused_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles_public: {
        Row: {
          document: Json | null;
          username_locked: boolean;
          creator_id: string;
          username: string;
          display_name: string;
          bio: string | null;
          profile_image_path: string | null;
          cover_image_path: string | null;
          instagram_handle: string | null;
          tiktok_handle: string | null;
          theme_preset: string;
          accent_color: string;
          background_type: string;
          background_value: string;
          button_style: string;
          card_style: string;
          font_preset: string;
          color_scheme: string;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          creator_id: string;
          username: string;
          display_name: string;
          bio?: string | null;
          profile_image_path?: string | null;
          cover_image_path?: string | null;
          instagram_handle?: string | null;
          tiktok_handle?: string | null;
          theme_preset?: string;
          accent_color?: string;
          background_type?: string;
          background_value?: string;
          button_style?: string;
          card_style?: string;
          font_preset?: string;
          color_scheme?: string;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Database['public']['Tables']['profiles_public']['Insert'], 'creator_id'>
        >;
        Relationships: [
          {
            foreignKeyName: 'profiles_public_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: true;
            referencedRelation: 'profiles_private';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      dt_request_contacts: {
        Args: Record<string, never>;
        Returns: { request_id: string; email: string }[];
      };
      dt_request_details: {
        Args: Record<string, never>;
        Returns: { request_id: string; details: string }[];
      };
      dt_save_page: {
        Args: { document: Json; expected_revision: number };
        Returns: number;
      };
      dt_publish_page: {
        Args: { publish: boolean; expected_revision: number };
        Returns: undefined;
      };
      dt_available_slots: {
        Args: { service: string; from_date: string };
        Returns: { start_at: string; end_at: string }[];
      };
      dt_submit_request: { Args: { payload: Json }; Returns: string };
      dt_transition_request: {
        Args: {
          rid: string;
          operation: string;
          expected_version: number;
          proposed_start?: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
