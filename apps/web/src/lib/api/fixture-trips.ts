import type { LonLat } from "./contracts";

export interface FixtureTrip {
  id: FixtureTripId;
  origin: LonLat;
  destination: LonLat;
  originName: string;
  destinationName: string;
}

export type FixtureTripId = "corridor" | "york-u-finch-west" | "north-york-centre-sheppard-yonge";

/** Endpoints of the fixture trips (OSM station nodes), kept apart so pages can offer them without loading routes. */
export const FIXTURE_TRIPS: Record<FixtureTripId, FixtureTrip> = {
  corridor: { id: "corridor", origin: [-79.49963, 43.77412], destination: [-79.41091, 43.76145], originName: "York University", destinationName: "Sheppard-Yonge" },
  "york-u-finch-west": { id: "york-u-finch-west", origin: [-79.49963, 43.77412], destination: [-79.49154, 43.76397], originName: "York University", destinationName: "Finch West" },
  "north-york-centre-sheppard-yonge": { id: "north-york-centre-sheppard-yonge", origin: [-79.41263, 43.76868], destination: [-79.41091, 43.76145], originName: "North York Centre", destinationName: "Sheppard-Yonge" },
};

export const FIXTURE_TRIPS_PUBLIC = Object.values(FIXTURE_TRIPS);
