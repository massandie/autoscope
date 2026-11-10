export interface OBDSnapshot {
  rpm: number | null;
  dtc: string[];
  coolant_temp: number | null;
  battery_voltage: number | null;
}

export interface Location {
  lat: number | null;
  lon: number | null;
  speed: number | null;
}

export interface ReadingPayload {
  vehicle_id: string;
  timestamp: string;
  location: Location;
  driving_score: number | null;
  events: string[];
  obd: OBDSnapshot;
}

export interface AlertDTO {
  id: number;
  category: 'diagnostic' | 'behavioral' | 'predictive' | 'maintenance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommended_action: string | null;
  created_at: string;
}

export interface IngestResult {
  reading: Record<string, unknown>;
  alerts: AlertDTO[];
  predicted_issue: string | null;
}
