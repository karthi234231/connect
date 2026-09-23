export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null;
          body: string | null;
          created_at: string;
          dedupe_key: string | null;
          expires_at: string | null;
          id: string;
          is_security: boolean;
          link: string | null;
          severity: Database['public']['Enums']['alert_severity'];
          source: Database['public']['Enums']['alert_source'];
          title: string;
          user_id: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          expires_at?: string | null;
          id?: string;
          is_security?: boolean;
          link?: string | null;
          severity?: Database['public']['Enums']['alert_severity'];
          source?: Database['public']['Enums']['alert_source'];
          title: string;
          user_id?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          expires_at?: string | null;
          id?: string;
          is_security?: boolean;
          link?: string | null;
          severity?: Database['public']['Enums']['alert_severity'];
          source?: Database['public']['Enums']['alert_source'];
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alerts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_daily: {
        Row: {
          count: number;
          created_at: string;
          day: string;
          event_name: string;
          updated_at: string;
        };
        Insert: {
          count?: number;
          created_at?: string;
          day: string;
          event_name: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          day?: string;
          event_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          error_code: string | null;
          event_name: string;
          id: string;
          latency_ms: number | null;
          profile_state: string | null;
          result: string | null;
          role: string | null;
          surface: string | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_code?: string | null;
          event_name: string;
          id?: string;
          latency_ms?: number | null;
          profile_state?: string | null;
          result?: string | null;
          role?: string | null;
          surface?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_code?: string | null;
          event_name?: string;
          id?: string;
          latency_ms?: number | null;
          profile_state?: string | null;
          result?: string | null;
          role?: string | null;
          surface?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          last_message_at: string | null;
          last_message_content: string | null;
          last_message_id: string | null;
          last_message_sender_id: string | null;
          match_id: string;
          unread_user1: number;
          unread_user2: number;
          updated_at: string;
        };
        Insert: {
          last_message_at?: string | null;
          last_message_content?: string | null;
          last_message_id?: string | null;
          last_message_sender_id?: string | null;
          match_id: string;
          unread_user1?: number;
          unread_user2?: number;
          updated_at?: string;
        };
        Update: {
          last_message_at?: string | null;
          last_message_content?: string | null;
          last_message_id?: string | null;
          last_message_sender_id?: string | null;
          match_id?: string;
          unread_user1?: number;
          unread_user2?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_threads_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: true;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      connection_requests: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          message: string | null;
          requester_id: string;
          responded_at: string | null;
          status: Database['public']['Enums']['connection_status'];
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          requester_id: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['connection_status'];
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          requester_id?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['connection_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'connection_requests_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connection_requests_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connection_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connection_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      device_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          is_active: boolean;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          is_active?: boolean;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          is_active?: boolean;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'device_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'device_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_agenda: {
        Row: {
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          ends_at: string | null;
          event_id: string;
          id: string;
          sort_order: number;
          speaker_ids: Json;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          ends_at?: string | null;
          event_id: string;
          id?: string;
          sort_order?: number;
          speaker_ids?: Json;
          starts_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          ends_at?: string | null;
          event_id?: string;
          id?: string;
          sort_order?: number;
          speaker_ids?: Json;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_agenda_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_agenda_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_attendees: {
        Row: {
          created_at: string;
          event_id: string;
          group_id: string | null;
          status: Database['public']['Enums']['event_attendee_status'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          group_id?: string | null;
          status?: Database['public']['Enums']['event_attendee_status'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          group_id?: string | null;
          status?: Database['public']['Enums']['event_attendee_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_attendees_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_attendees_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_attendees_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'event_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_attendees_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_attendees_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_groups: {
        Row: {
          capacity: number | null;
          created_at: string;
          event_id: string;
          id: string;
          label: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          event_id: string;
          id?: string;
          label: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_groups_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_groups_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_media: {
        Row: {
          allow_download: boolean;
          created_at: string;
          description: string | null;
          duration_seconds: number | null;
          event_id: string;
          file_size: number | null;
          id: string;
          is_public: boolean;
          lifecycle_status: string;
          mime_type: string | null;
          sort_order: number;
          storage_path: string | null;
          thumbnail_url: string | null;
          title: string | null;
          type: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          allow_download?: boolean;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          event_id: string;
          file_size?: number | null;
          id?: string;
          is_public?: boolean;
          lifecycle_status?: string;
          mime_type?: string | null;
          sort_order?: number;
          storage_path?: string | null;
          thumbnail_url?: string | null;
          title?: string | null;
          type: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          allow_download?: boolean;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          event_id?: string;
          file_size?: number | null;
          id?: string;
          is_public?: boolean;
          lifecycle_status?: string;
          mime_type?: string | null;
          sort_order?: number;
          storage_path?: string | null;
          thumbnail_url?: string | null;
          title?: string | null;
          type?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_media_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_media_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_registration_idempotency: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          operation: string;
          outcome: string;
          registration_id: string;
          request_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          operation: string;
          outcome: string;
          registration_id: string;
          request_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          operation?: string;
          outcome?: string;
          registration_id?: string;
          request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_registration_idempotency_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registration_idempotency_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registration_idempotency_registration_id_fkey';
            columns: ['registration_id'];
            isOneToOne: false;
            referencedRelation: 'event_registrations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registration_idempotency_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registration_idempotency_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_registrations: {
        Row: {
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          event_id: string;
          id: string;
          registered_at: string;
          status: string;
          updated_at: string;
          user_id: string;
          waitlist_position: number | null;
        };
        Insert: {
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          registered_at?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          waitlist_position?: number | null;
        };
        Update: {
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          registered_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          waitlist_position?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_registrations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registrations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registrations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_registrations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_speakers: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          company: string | null;
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          profile_url: string | null;
          role: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          company?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          profile_url?: string | null;
          role?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          company?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          profile_url?: string | null;
          role?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_speakers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_speakers_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          capacity: number;
          category: string;
          cover_image: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          duration_minutes: number;
          format: Database['public']['Enums']['event_format'];
          id: string;
          location_or_link: string;
          organizer_id: string;
          parent_event_id: string | null;
          price: number;
          published_at: string | null;
          recurrence: Database['public']['Enums']['event_recurrence'];
          recurrence_end: string | null;
          registration_deadline: string | null;
          registration_open: boolean;
          starts_at: string;
          status: string;
          tags: Json;
          timezone: string;
          title: string;
          type: Database['public']['Enums']['event_type'];
          updated_at: string;
          venue: Json | null;
          visibility: string;
        };
        Insert: {
          capacity?: number;
          category?: string;
          cover_image?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_minutes?: number;
          format?: Database['public']['Enums']['event_format'];
          id?: string;
          location_or_link?: string;
          organizer_id: string;
          parent_event_id?: string | null;
          price?: number;
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['event_recurrence'];
          recurrence_end?: string | null;
          registration_deadline?: string | null;
          registration_open?: boolean;
          starts_at: string;
          status?: string;
          tags?: Json;
          timezone?: string;
          title: string;
          type?: Database['public']['Enums']['event_type'];
          updated_at?: string;
          venue?: Json | null;
          visibility?: string;
        };
        Update: {
          capacity?: number;
          category?: string;
          cover_image?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_minutes?: number;
          format?: Database['public']['Enums']['event_format'];
          id?: string;
          location_or_link?: string;
          organizer_id?: string;
          parent_event_id?: string | null;
          price?: number;
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['event_recurrence'];
          recurrence_end?: string | null;
          registration_deadline?: string | null;
          registration_open?: boolean;
          starts_at?: string;
          status?: string;
          tags?: Json;
          timezone?: string;
          title?: string;
          type?: Database['public']['Enums']['event_type'];
          updated_at?: string;
          venue?: Json | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      export_requests: {
        Row: {
          checksum: string | null;
          created_at: string;
          expires_at: string | null;
          fulfilled_at: string | null;
          id: string;
          object_key: string | null;
          request_type: string;
          size_bytes: number | null;
          status: Database['public']['Enums']['export_request_status'];
          user_id: string | null;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          expires_at?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          object_key?: string | null;
          request_type?: string;
          size_bytes?: number | null;
          status?: Database['public']['Enums']['export_request_status'];
          user_id?: string | null;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          expires_at?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          object_key?: string | null;
          request_type?: string;
          size_bytes?: number | null;
          status?: Database['public']['Enums']['export_request_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'export_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'export_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      feedback: {
        Row: {
          context: string;
          created_at: string;
          id: string;
          message: string;
          user_id: string;
        };
        Insert: {
          context: string;
          created_at?: string;
          id?: string;
          message: string;
          user_id: string;
        };
        Update: {
          context?: string;
          created_at?: string;
          id?: string;
          message?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feedback_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feedback_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      idea_interests: {
        Row: {
          action: Database['public']['Enums']['recommendation_action'];
          created_at: string;
          id: string;
          idea_id: string;
          user_id: string;
        };
        Insert: {
          action?: Database['public']['Enums']['recommendation_action'];
          created_at?: string;
          id?: string;
          idea_id: string;
          user_id: string;
        };
        Update: {
          action?: Database['public']['Enums']['recommendation_action'];
          created_at?: string;
          id?: string;
          idea_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'idea_interests_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_interests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'idea_interests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ideas: {
        Row: {
          ask: string;
          created_at: string;
          id: string;
          image_url: string | null;
          join_enabled: boolean;
          owner_id: string;
          problem: string;
          solution: string;
          stage: Database['public']['Enums']['idea_stage'];
          tags: string[];
          team_needed: string[];
          title: string;
          updated_at: string;
          validation_count: number;
          visibility: Database['public']['Enums']['idea_visibility'];
        };
        Insert: {
          ask: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          join_enabled?: boolean;
          owner_id: string;
          problem: string;
          solution: string;
          stage?: Database['public']['Enums']['idea_stage'];
          tags?: string[];
          team_needed?: string[];
          title: string;
          updated_at?: string;
          validation_count?: number;
          visibility?: Database['public']['Enums']['idea_visibility'];
        };
        Update: {
          ask?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          join_enabled?: boolean;
          owner_id?: string;
          problem?: string;
          solution?: string;
          stage?: Database['public']['Enums']['idea_stage'];
          tags?: string[];
          team_needed?: string[];
          title?: string;
          updated_at?: string;
          validation_count?: number;
          visibility?: Database['public']['Enums']['idea_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'ideas_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ideas_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      join_requests: {
        Row: {
          created_at: string;
          id: string;
          idea_id: string;
          message: string | null;
          status: Database['public']['Enums']['join_request_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idea_id: string;
          message?: string | null;
          status?: Database['public']['Enums']['join_request_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idea_id?: string;
          message?: string | null;
          status?: Database['public']['Enums']['join_request_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'join_requests_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'join_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'join_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      match_timeline: {
        Row: {
          created_at: string;
          event_type: Database['public']['Enums']['match_timeline_event_type'];
          id: string;
          match_id: string;
          meta: Json;
        };
        Insert: {
          created_at?: string;
          event_type: Database['public']['Enums']['match_timeline_event_type'];
          id?: string;
          match_id: string;
          meta?: Json;
        };
        Update: {
          created_at?: string;
          event_type?: Database['public']['Enums']['match_timeline_event_type'];
          id?: string;
          match_id?: string;
          meta?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'match_timeline_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          algorithm_version: string | null;
          created_at: string;
          id: string;
          score: number | null;
          status: Database['public']['Enums']['match_status'];
          updated_at: string;
          user1_id: string;
          user2_id: string;
        };
        Insert: {
          algorithm_version?: string | null;
          created_at?: string;
          id?: string;
          score?: number | null;
          status?: Database['public']['Enums']['match_status'];
          updated_at?: string;
          user1_id: string;
          user2_id: string;
        };
        Update: {
          algorithm_version?: string | null;
          created_at?: string;
          id?: string;
          score?: number | null;
          status?: Database['public']['Enums']['match_status'];
          updated_at?: string;
          user1_id?: string;
          user2_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_user1_id_fkey';
            columns: ['user1_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user1_id_fkey';
            columns: ['user1_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user2_id_fkey';
            columns: ['user2_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_user2_id_fkey';
            columns: ['user2_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      matching_weights: {
        Row: {
          activity: number;
          availability: number;
          diversity: number;
          intent: number;
          role: number;
          skill: number;
          timezone: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          activity?: number;
          availability?: number;
          diversity?: number;
          intent?: number;
          role?: number;
          skill?: number;
          timezone?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          activity?: number;
          availability?: number;
          diversity?: number;
          intent?: number;
          role?: number;
          skill?: number;
          timezone?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'matching_weights_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matching_weights_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          attachment_url: string | null;
          client_message_id: string;
          content: string;
          created_at: string;
          id: string;
          match_id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          attachment_url?: string | null;
          client_message_id: string;
          content: string;
          created_at?: string;
          id?: string;
          match_id: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          attachment_url?: string | null;
          client_message_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          notification_id: string;
          provider_message_id: string | null;
          status: string;
          to_email: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          notification_id: string;
          provider_message_id?: string | null;
          status?: string;
          to_email?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          notification_id?: string;
          provider_message_id?: string | null;
          status?: string;
          to_email?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_deliveries_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email: boolean;
          enabled: boolean;
          id: string;
          in_app: boolean;
          push: boolean;
          type: Database['public']['Enums']['notification_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: boolean;
          enabled?: boolean;
          id?: string;
          in_app?: boolean;
          push?: boolean;
          type: Database['public']['Enums']['notification_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: boolean;
          enabled?: boolean;
          id?: string;
          in_app?: boolean;
          push?: boolean;
          type?: Database['public']['Enums']['notification_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_settings: {
        Row: {
          digest_cadence: Database['public']['Enums']['notification_digest_cadence'];
          digest_hour: number;
          digest_timezone: string;
          quiet_hours_enabled: boolean;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          quiet_hours_timezone: string;
          security_alerts: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          digest_cadence?: Database['public']['Enums']['notification_digest_cadence'];
          digest_hour?: number;
          digest_timezone?: string;
          quiet_hours_enabled?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_timezone?: string;
          security_alerts?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          digest_cadence?: Database['public']['Enums']['notification_digest_cadence'];
          digest_hour?: number;
          digest_timezone?: string;
          quiet_hours_enabled?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_timezone?: string;
          security_alerts?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          dedupe_key: string | null;
          entity_id: string | null;
          entity_type: string | null;
          expires_at: string | null;
          id: string;
          read_at: string | null;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          read_at?: string | null;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          read_at?: string | null;
          title?: string;
          type?: Database['public']['Enums']['notification_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          app_role: Database['public']['Enums']['app_role'];
          availability: Json;
          avatar_url: string | null;
          bio: string | null;
          commitment_level: Database['public']['Enums']['commitment_level'];
          created_at: string;
          full_name: string;
          id: string;
          last_active_at: string | null;
          looking_for: Json;
          notification_prefs: Json;
          onboarding_completed_at: string | null;
          onboarding_status: string;
          role: Database['public']['Enums']['role'] | null;
          skills: string[];
          suspended_at: string | null;
          timezone: string;
          updated_at: string;
          visibility: Database['public']['Enums']['profile_visibility'];
          work_style: Database['public']['Enums']['work_style'];
        };
        Insert: {
          app_role?: Database['public']['Enums']['app_role'];
          availability?: Json;
          avatar_url?: string | null;
          bio?: string | null;
          commitment_level?: Database['public']['Enums']['commitment_level'];
          created_at?: string;
          full_name: string;
          id: string;
          last_active_at?: string | null;
          looking_for?: Json;
          notification_prefs?: Json;
          onboarding_completed_at?: string | null;
          onboarding_status?: string;
          role?: Database['public']['Enums']['role'] | null;
          skills?: string[];
          suspended_at?: string | null;
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['profile_visibility'];
          work_style?: Database['public']['Enums']['work_style'];
        };
        Update: {
          app_role?: Database['public']['Enums']['app_role'];
          availability?: Json;
          avatar_url?: string | null;
          bio?: string | null;
          commitment_level?: Database['public']['Enums']['commitment_level'];
          created_at?: string;
          full_name?: string;
          id?: string;
          last_active_at?: string | null;
          looking_for?: Json;
          notification_prefs?: Json;
          onboarding_completed_at?: string | null;
          onboarding_status?: string;
          role?: Database['public']['Enums']['role'] | null;
          skills?: string[];
          suspended_at?: string | null;
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['profile_visibility'];
          work_style?: Database['public']['Enums']['work_style'];
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          action: Database['public']['Enums']['recommendation_action'];
          algorithm_version: string | null;
          breakdown: Json;
          candidate_id: string;
          candidate_pool_version: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          rank_position: number | null;
          reasons: Json;
          score: number;
          user_id: string;
          weights_version: string | null;
        };
        Insert: {
          action: Database['public']['Enums']['recommendation_action'];
          algorithm_version?: string | null;
          breakdown?: Json;
          candidate_id: string;
          candidate_pool_version?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          rank_position?: number | null;
          reasons?: Json;
          score: number;
          user_id: string;
          weights_version?: string | null;
        };
        Update: {
          action?: Database['public']['Enums']['recommendation_action'];
          algorithm_version?: string | null;
          breakdown?: Json;
          candidate_id?: string;
          candidate_pool_version?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          rank_position?: number | null;
          reasons?: Json;
          score?: number;
          user_id?: string;
          weights_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recommendations_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recommendations_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recommendations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recommendations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          priority: number;
          reason: string;
          reported_id: string;
          reporter_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          priority?: number;
          reason: string;
          reported_id: string;
          reporter_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          priority?: number;
          reason?: string;
          reported_id?: string;
          reporter_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      team_memberships: {
        Row: {
          created_at: string;
          id: string;
          idea_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idea_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idea_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_memberships_idea_id_fkey';
            columns: ['idea_id'];
            isOneToOne: false;
            referencedRelation: 'ideas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_skills: {
        Row: {
          proficiency: number;
          skill: string;
          user_id: string;
        };
        Insert: {
          proficiency: number;
          skill: string;
          user_id: string;
        };
        Update: {
          proficiency?: number;
          skill?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_skills_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_skills_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      event_discovery_index: {
        Row: {
          capacity: number | null;
          category: string | null;
          cover_image: string | null;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          duration_minutes: number | null;
          format: Database['public']['Enums']['event_format'] | null;
          id: string | null;
          location_or_link: string | null;
          organizer_id: string | null;
          parent_event_id: string | null;
          popularity_score: number | null;
          price: number | null;
          published_at: string | null;
          recurrence: Database['public']['Enums']['event_recurrence'] | null;
          recurrence_end: string | null;
          registration_count: number | null;
          registration_deadline: string | null;
          registration_open: boolean | null;
          relevance_score: number | null;
          starts_at: string | null;
          status: string | null;
          tags: Json | null;
          timezone: string | null;
          title: string | null;
          type: Database['public']['Enums']['event_type'] | null;
          updated_at: string | null;
          venue: Json | null;
          visibility: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['organizer_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'event_discovery_index';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      public_profiles: {
        Row: {
          availability: Json | null;
          avatar_url: string | null;
          bio: string | null;
          commitment_level:
            Database['public']['Enums']['commitment_level'] | null;
          created_at: string | null;
          full_name: string | null;
          id: string | null;
          last_active_at: string | null;
          looking_for: Json | null;
          role: Database['public']['Enums']['role'] | null;
          skills: string[] | null;
          timezone: string | null;
          updated_at: string | null;
          visibility: Database['public']['Enums']['profile_visibility'] | null;
          work_style: Database['public']['Enums']['work_style'] | null;
        };
        Insert: {
          availability?: Json | null;
          avatar_url?: string | null;
          bio?: string | null;
          commitment_level?:
            Database['public']['Enums']['commitment_level'] | null;
          created_at?: string | null;
          full_name?: string | null;
          id?: string | null;
          last_active_at?: string | null;
          looking_for?: Json | null;
          role?: Database['public']['Enums']['role'] | null;
          skills?: string[] | null;
          timezone?: string | null;
          updated_at?: string | null;
          visibility?: Database['public']['Enums']['profile_visibility'] | null;
          work_style?: Database['public']['Enums']['work_style'] | null;
        };
        Update: {
          availability?: Json | null;
          avatar_url?: string | null;
          bio?: string | null;
          commitment_level?:
            Database['public']['Enums']['commitment_level'] | null;
          created_at?: string | null;
          full_name?: string | null;
          id?: string | null;
          last_active_at?: string | null;
          looking_for?: Json | null;
          role?: Database['public']['Enums']['role'] | null;
          skills?: string[] | null;
          timezone?: string | null;
          updated_at?: string | null;
          visibility?: Database['public']['Enums']['profile_visibility'] | null;
          work_style?: Database['public']['Enums']['work_style'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_access_match_attachment: {
        Args: { bucket: string; object_name: string };
        Returns: boolean;
      };
      cancel_event_registration: {
        Args: { p_registration_id: string; p_user_id: string };
        Returns: {
          capacity: number;
          event_id: string;
          previous_status: string;
          promoted_registration_id: string;
          promoted_user_id: string;
          registered_count: number;
          registration_id: string;
          remaining_capacity: number;
          spots_remaining: number;
          status: string;
          user_id: string;
          waitlisted_count: number;
        }[];
      };
      duplicate_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: string;
      };
      event_registration_analytics: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      get_event_registration_capacity: {
        Args: { p_event_id: string };
        Returns: {
          available_seats: number;
          capacity: number;
          is_full: boolean;
          is_waitlist_open: boolean;
          registered_count: number;
          registration_open: boolean;
          waitlisted_count: number;
        }[];
      };
      is_authenticated: { Args: never; Returns: boolean };
      is_match_participant: { Args: { match_id: string }; Returns: boolean };
      perform_swipe:
        | {
            Args: {
              p_action: Database['public']['Enums']['recommendation_action'];
              p_candidate_id: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_action: Database['public']['Enums']['recommendation_action'];
              p_candidate_id: string;
              p_score?: number;
            };
            Returns: Json;
          };
      refresh_analytics_daily: { Args: { since: string }; Returns: undefined };
      register_event: {
        Args: { p_event_id: string; p_request_id?: string; p_user_id: string };
        Returns: {
          capacity: number;
          event_id: string;
          is_full: boolean;
          outcome: string;
          promoted_registration_id: string;
          registered_count: number;
          registration_id: string;
          remaining_capacity: number;
          spots_remaining: number;
          status: string;
          user_id: string;
          waitlist_position: number;
          waitlisted_count: number;
        }[];
      };
      register_event_full: {
        Args: { p_event_id: string; p_request_id?: string; p_user_id: string };
        Returns: Json;
      };
      respond_connection_request: {
        Args: { p_decision: string; p_request_id: string };
        Returns: Json;
      };
      review_idea_join_request: {
        Args: {
          p_decision: string;
          p_idea_id: string;
          p_join_request_id: string;
        };
        Returns: Json;
      };
      search_messages: {
        Args: {
          p_before?: string;
          p_limit?: number;
          p_match_id?: string;
          p_query: string;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          match_id: string;
          sender_id: string;
        }[];
      };
      sp_accept_match: { Args: { p_match_id: string }; Returns: undefined };
      sp_hard_erase_user: {
        Args: { p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      validate_idea: {
        Args: {
          p_action: Database['public']['Enums']['recommendation_action'];
          p_idea_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      alert_severity: 'info' | 'success' | 'warning' | 'critical';
      alert_source: 'system' | 'security' | 'moderation' | 'account' | 'safety';
      app_role: 'user' | 'admin';
      commitment_level:
        'exploring' | 'nights_weekends' | 'part_time' | 'full_time';
      connection_status: 'pending' | 'accepted' | 'declined';
      event_attendee_status: 'going' | 'waitlisted' | 'cancelled';
      event_format:
        | 'build_night'
        | 'coffee'
        | 'challenge'
        | 'office_hours'
        | 'workshop'
        | 'social';
      event_recurrence: 'none' | 'weekly' | 'biweekly' | 'monthly';
      event_type: 'virtual' | 'irl';
      export_request_status:
        'pending' | 'fulfilled' | 'processing' | 'completed';
      idea_stage: 'idea' | 'prototype' | 'mvp' | 'launched';
      idea_visibility: 'published' | 'draft' | 'archived';
      join_request_status: 'pending' | 'approved' | 'rejected';
      match_status: 'pending' | 'active' | 'declined';
      match_timeline_event_type:
        'match_created' | 'match_accepted' | 'first_reply' | 'intro_requested';
      notification_channel: 'in_app' | 'email' | 'push';
      notification_digest_cadence: 'never' | 'daily' | 'weekly';
      notification_type:
        | 'match_created'
        | 'intro_requested'
        | 'message_received'
        | 'event_reminder'
        | 'event_group_assigned';
      profile_visibility: 'public' | 'recruiting' | 'private' | 'stealth';
      recommendation_action: 'like' | 'pass' | 'spark';
      role:
        | 'founder'
        | 'engineer'
        | 'designer'
        | 'product'
        | 'growth'
        | 'operations'
        | 'data_ml'
        | 'other';
      work_style: 'structured' | 'flexible' | 'fast_iterate' | 'deliberate';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_severity: ['info', 'success', 'warning', 'critical'],
      alert_source: ['system', 'security', 'moderation', 'account', 'safety'],
      app_role: ['user', 'admin'],
      commitment_level: [
        'exploring',
        'nights_weekends',
        'part_time',
        'full_time',
      ],
      connection_status: ['pending', 'accepted', 'declined'],
      event_attendee_status: ['going', 'waitlisted', 'cancelled'],
      event_format: [
        'build_night',
        'coffee',
        'challenge',
        'office_hours',
        'workshop',
        'social',
      ],
      event_recurrence: ['none', 'weekly', 'biweekly', 'monthly'],
      event_type: ['virtual', 'irl'],
      export_request_status: [
        'pending',
        'fulfilled',
        'processing',
        'completed',
      ],
      idea_stage: ['idea', 'prototype', 'mvp', 'launched'],
      idea_visibility: ['published', 'draft', 'archived'],
      join_request_status: ['pending', 'approved', 'rejected'],
      match_status: ['pending', 'active', 'declined'],
      match_timeline_event_type: [
        'match_created',
        'match_accepted',
        'first_reply',
        'intro_requested',
      ],
      notification_channel: ['in_app', 'email', 'push'],
      notification_digest_cadence: ['never', 'daily', 'weekly'],
      notification_type: [
        'match_created',
        'intro_requested',
        'message_received',
        'event_reminder',
        'event_group_assigned',
      ],
      profile_visibility: ['public', 'recruiting', 'private', 'stealth'],
      recommendation_action: ['like', 'pass', 'spark'],
      role: [
        'founder',
        'engineer',
        'designer',
        'product',
        'growth',
        'operations',
        'data_ml',
        'other',
      ],
      work_style: ['structured', 'flexible', 'fast_iterate', 'deliberate'],
    },
  },
} as const;
