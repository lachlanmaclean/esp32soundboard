export const MAX_SOUNDS_PER_USER = 8;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const PAIRING_CODE_LENGTH = 6;

/** A single button as the CYD renders it. Mirrors a subset of the Sound model. */
export interface SoundButtonConfig {
  id: string;
  displayName: string;
  color: string;
  icon: string | null;
}

/** Response body for GET /api/devices/:cuid/config — what the CYD polls for. */
export interface DeviceConfig {
  buttons: SoundButtonConfig[];
  /** Bump whenever config changes, so the CYD can skip a re-render if unchanged. */
  version: number;
}

/** Body the CYD posts on first boot / whenever it has no paired user yet. */
export interface DeviceRegisterRequest {
  cuid: string;
  firmwareVersion?: string;
}

export interface DeviceRegisterResponse {
  cuid: string;
  /** Present only while the device is unpaired and awaiting pairing. */
  pairingCode: string | null;
  paired: boolean;
}

/** Body the CYD posts when a button is tapped. */
export interface TriggerSoundRequest {
  cuid: string;
  soundId: string;
}

export type OAuthGuildSummary = {
  id: string;
  name: string;
  icon: string | null;
  /** True if the bitwise permissions on this guild include Administrator or ManageGuild. */
  canManage: boolean;
};
