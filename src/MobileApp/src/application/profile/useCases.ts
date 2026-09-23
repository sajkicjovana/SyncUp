import type { MyTicketsGateway } from '../myTickets/ports';
import type { ReservationRow, ReservationsGateway } from '../reservations/ports';
import type {
  CurrentProfileGateway,
  LoadPersonalInfoResult,
  LoadProfileDashboardResult,
  ObserveProfileDashboard,
  ObservePersonalInfoUploadFailure,
  PersonalInfoMutationGateway,
  ProfileDashboardGateway,
  ReadProfileToken,
  SavePersonalInfoInput,
  SavePersonalInfoResult,
} from './ports';

export class ProfileDashboardTokenReadError extends Error {
  readonly originalError: unknown;

  constructor(error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.name = 'ProfileDashboardTokenReadError';
    this.originalError = error;
  }
}

export function createLoadPersonalInfo(
  profileGateway: CurrentProfileGateway,
  readToken: ReadProfileToken,
) {
  return async (): Promise<LoadPersonalInfoResult> => {
    const token = await readToken();
    if (!token) return { status: 'missing-token' };

    const result = await profileGateway.loadCurrentProfile(token);
    if (!result.ok) {
      return { status: 'non-ok', responseStatus: result.status };
    }

    return { status: 'loaded', profile: result.profile };
  };
}

export function createSavePersonalInfo(
  mutationGateway: PersonalInfoMutationGateway,
  readToken: ReadProfileToken,
) {
  return async (
    input: SavePersonalInfoInput,
    observeUploadFailure: ObservePersonalInfoUploadFailure,
  ): Promise<SavePersonalInfoResult> => {
    const primaryToken = await readToken();
    if (!primaryToken) return { status: 'missing-token' };

    let profilePicture: string | null;

    if (input.imageChange.kind === 'upload') {
      profilePicture = null;

      try {
        const uploadToken = await readToken();
        if (!uploadToken) {
          observeUploadFailure({ kind: 'missing-token' });
        } else {
          const uploadResult = await mutationGateway.uploadProfileImage(
            uploadToken,
            input.imageChange.uri,
          );
          if (uploadResult.ok) {
            profilePicture = uploadResult.imageUrl;
          } else {
            observeUploadFailure({
              kind: 'error',
              error: new Error(uploadResult.responseText),
            });
          }
        }
      } catch (error) {
        observeUploadFailure({ kind: 'error', error });
      }
    } else if (input.imageChange.kind === 'delete') {
      const deleteToken = await readToken();
      if (!deleteToken) return { status: 'delete-missing-token' };

      const deleteResult = await mutationGateway.deleteProfileImage(deleteToken);
      if (!deleteResult.ok) {
        return {
          status: 'delete-rejected',
          responseText: deleteResult.responseText,
        };
      }
      profilePicture = '';
    } else {
      profilePicture = input.imageChange.profilePicture;
    }

    const updateResult = await mutationGateway.updateProfile(primaryToken, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      profilePicture,
    });

    if (!updateResult.ok) {
      return {
        status: 'update-rejected',
        backendMessage: updateResult.backendMessage,
      };
    }

    return { status: 'saved', profilePicture };
  };
}

function countUniqueResourceAllocations(rows: ReservationRow[]): number {
  const uniqueReservations = new Set<string>();

  rows.forEach((reservation) => {
    if (reservation.EventID && reservation.EventResourceID) {
      uniqueReservations.add(`${reservation.EventID}-${reservation.EventResourceID}`);
    }
  });

  return uniqueReservations.size;
}

export function createLoadProfileDashboard(
  profileGateway: ProfileDashboardGateway,
  ticketsGateway: MyTicketsGateway,
  reservationsGateway: ReservationsGateway,
  readToken: ReadProfileToken,
) {
  return async (observe: ObserveProfileDashboard): Promise<LoadProfileDashboardResult> => {
    let token: string | null;
    try {
      token = await readToken();
    } catch (error) {
      throw new ProfileDashboardTokenReadError(error);
    }

    if (!token) return { status: 'missing-token' };

    observe({ stage: 'authenticated' });

    const profileResult = await profileGateway.loadCurrentProfile(token);
    if (profileResult.ok) {
      const { firstName, lastName, email, profilePicture } = profileResult.profile;
      observe({
        stage: 'profile',
        outcome: 'loaded',
        profile: { firstName, lastName, email, profilePicture },
      });
    } else {
      observe({ stage: 'profile', outcome: 'non-ok', status: profileResult.status });
    }

    const ticketsResult = await ticketsGateway.loadMyTickets(token);
    if (ticketsResult.ok) {
      observe({ stage: 'tickets', outcome: 'loaded', count: ticketsResult.tickets.length });
    } else {
      observe({ stage: 'tickets', outcome: 'non-ok' });
    }

    const reservationsResult = await reservationsGateway.loadMyReservations(token);
    if (reservationsResult.ok) {
      observe({
        stage: 'reservations',
        outcome: 'loaded',
        count: countUniqueResourceAllocations(reservationsResult.rows),
      });
    } else {
      observe({ stage: 'reservations', outcome: 'non-ok' });
    }

    const creditsResult = await profileGateway.loadCredits(token);
    if (!creditsResult.ok) {
      observe({
        stage: 'credits',
        outcome: 'non-ok',
        status: creditsResult.status,
        responseText: creditsResult.responseText,
      });
    } else if (typeof creditsResult.credits === 'number') {
      observe({ stage: 'credits', outcome: 'loaded', credits: creditsResult.credits });
    } else {
      observe({
        stage: 'credits',
        outcome: 'invalid',
        credits: 0,
        invalidValue: creditsResult.credits,
      });
    }

    return { status: 'loaded' };
  };
}
