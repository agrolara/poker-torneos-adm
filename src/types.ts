export interface Player {
  id: string;
  organizer_id: string;
  name: string;
  created_at: string;
}

export interface Level {
  level: number;
  small_blind: number;
  big_blind: number;
  ante: number;
  duration: number; // in minutes
}

export interface BlindStructure {
  id: string;
  organizer_id: string;
  name: string;
  levels: Level[];
  created_at: string;
}

export type TournamentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface Tournament {
  id: string;
  organizer_id: string;
  name: string;
  status: TournamentStatus;
  buy_in_amount: number;
  buy_in_chips: number;
  rebuy_amount: number;
  rebuy_chips: number;
  add_on_amount: number;
  add_on_chips: number;
  current_level_index: number;
  seconds_remaining: number;
  is_timer_running: boolean;
  max_players_per_table: number;
  payout_structure: number[]; // e.g. [50, 30, 20]
  structure_id?: string;
  created_at: string;
}

export type TournamentPlayerStatus = 'active' | 'eliminated';

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  player_id: string | null;
  guest_name: string | null;
  status: TournamentPlayerStatus;
  rebuys_count: number;
  has_add_on: boolean;
  table_number: number | null;
  seat_number: number | null;
  elimination_position: number | null;
  payout_amount: number;
  created_at?: string;
  
  // Joined fields for convenience
  player?: {
    name: string;
  };
}

export interface TournamentLog {
  id: string;
  tournament_id: string;
  event_type: 'elimination' | 'rebuy' | 'addon' | 'level_change' | 'timer_action';
  payload: any;
  created_at: string;
}
