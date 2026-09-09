export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
