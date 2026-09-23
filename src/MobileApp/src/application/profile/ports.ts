export type CurrentProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profilePicture: string | null;
};

export type ProfileDashboardProfile = Omit<CurrentProfile, 'phoneNumber'>;

export type ProfileDashboardGatewayResult =
  | { ok: true; profile: CurrentProfile }
  | { ok: false; status: number };

export type CreditsGatewayResult =
  | { ok: true; credits: unknown }
  | { ok: false; status: number; responseText: string };

export interface CurrentProfileGateway {
  loadCurrentProfile(token: string): Promise<ProfileDashboardGatewayResult>;
}

export interface ProfileDashboardGateway extends CurrentProfileGateway {
  loadCredits(token: string): Promise<CreditsGatewayResult>;
}

export type CreditPurchaseResult =
  | { ok: true }
  | { ok: false; responseText: string };

export interface CreditPurchaseGateway {
  purchaseCredits(token: string | null, amount: number): Promise<CreditPurchaseResult>;
}

export type ReadProfileToken = () => Promise<string | null>;

export type ProfileDashboardUpdate =
  | { stage: 'authenticated' }
  | { stage: 'profile'; outcome: 'loaded'; profile: ProfileDashboardProfile }
  | { stage: 'profile'; outcome: 'non-ok'; status: number }
  | { stage: 'tickets'; outcome: 'loaded'; count: number }
  | { stage: 'tickets'; outcome: 'non-ok' }
  | { stage: 'reservations'; outcome: 'loaded'; count: number }
  | { stage: 'reservations'; outcome: 'non-ok' }
  | { stage: 'credits'; outcome: 'loaded'; credits: number }
  | { stage: 'credits'; outcome: 'invalid'; credits: 0; invalidValue: unknown }
  | { stage: 'credits'; outcome: 'non-ok'; status: number; responseText: string };

export type ObserveProfileDashboard = (update: ProfileDashboardUpdate) => void;

export type LoadProfileDashboardResult =
  | { status: 'missing-token' }
  | { status: 'loaded' };

export type LoadPersonalInfoResult =
  | { status: 'missing-token' }
  | { status: 'non-ok'; responseStatus: number }
  | { status: 'loaded'; profile: CurrentProfile };

export type PersonalInfoImageChange =
  | { kind: 'keep'; profilePicture: string | null }
  | { kind: 'upload'; uri: string }
  | { kind: 'delete' };

export type SavePersonalInfoInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageChange: PersonalInfoImageChange;
};

export type UpdatePersonalInfoInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profilePicture: string | null;
};

export type UpdatePersonalInfoResult =
  | { ok: true }
  | { ok: false; backendMessage: unknown };

export type UploadProfileImageResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; responseText: string };

export type DeleteProfileImageResult =
  | { ok: true }
  | { ok: false; responseText: string };

export interface PersonalInfoMutationGateway {
  updateProfile(
    token: string,
    profile: UpdatePersonalInfoInput,
  ): Promise<UpdatePersonalInfoResult>;
  uploadProfileImage(token: string, uri: string): Promise<UploadProfileImageResult>;
  deleteProfileImage(token: string): Promise<DeleteProfileImageResult>;
}

export type PersonalInfoUploadFailure =
  | { kind: 'missing-token' }
  | { kind: 'error'; error: unknown };

export type ObservePersonalInfoUploadFailure = (
  failure: PersonalInfoUploadFailure,
) => void;

export type SavePersonalInfoResult =
  | { status: 'missing-token' }
  | { status: 'delete-missing-token' }
  | { status: 'delete-rejected'; responseText: string }
  | { status: 'update-rejected'; backendMessage: unknown }
  | { status: 'saved'; profilePicture: string | null };
