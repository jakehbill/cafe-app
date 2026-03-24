export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  coffeeScore: number;
  workScore: number;
  vibeScore: number;
  tags: string[];
  summary: string;
  googleMapsUrl: string;
  /** Optional MVP “community” counts for trending (local seed data; no backend). */
  communityStats?: {
    saves: number;
    visits: number;
  };
};

export const cafes: Cafe[] = [
  {
    id: '1',
    name: 'Moss & Co. Coffee',
    neighborhood: 'Downtown • Elm Street',
    latitude: 51.5256,
    longitude: -0.0754,
    coffeeScore: 9.4,
    workScore: 8.7,
    vibeScore: 9.1,
    tags: ['Quiet', 'Specialty Coffee', 'Laptop Friendly', 'Quick'],
    summary: 'Cozy light-filled seating with consistently great pour-overs.',
    googleMapsUrl: 'https://maps.google.com/?q=Moss+%26+Co.+Coffee',
    communityStats: { saves: 182, visits: 940 },
  },
  {
    id: '2',
    name: 'Hearthline Cafe',
    neighborhood: 'Old Town • Cedar Ave',
    latitude: 51.5239,
    longitude: -0.0782,
    coffeeScore: 9.0,
    workScore: 8.9,
    vibeScore: 8.8,
    tags: ['Fast Service', 'Great Seating', 'Laptop Friendly'],
    summary: 'Warm wood interiors and roomy tables make long work sessions easy.',
    googleMapsUrl: 'https://maps.google.com/?q=Hearthline+Cafe',
    communityStats: { saves: 156, visits: 812 },
  },
  {
    id: '3',
    name: 'Juniper Brew Bar',
    neighborhood: 'Riverside • Maple Row',
    latitude: 51.5271,
    longitude: -0.0718,
    coffeeScore: 9.6,
    workScore: 8.2,
    vibeScore: 8.9,
    tags: ['Specialty Coffee', 'Busy', 'Easy Grab & Go'],
    summary: 'A specialty-forward bar with fast espresso service and lively energy.',
    googleMapsUrl: 'https://maps.google.com/?q=Juniper+Brew+Bar',
    communityStats: { saves: 203, visits: 1105 },
  },
  {
    id: '4',
    name: 'Clay & Steam',
    neighborhood: 'Midtown • Willow Street',
    latitude: 51.5218,
    longitude: -0.0739,
    coffeeScore: 8.8,
    workScore: 9.1,
    vibeScore: 9.0,
    tags: ['Quiet', 'Good for Calls', 'Great Seating'],
    summary: 'Minimal, calm atmosphere with dependable Wi-Fi and soft ambient music.',
    googleMapsUrl: 'https://maps.google.com/?q=Clay+%26+Steam',
    communityStats: { saves: 141, visits: 678 },
  },
  {
    id: '5',
    name: 'Golden Hour Cafe',
    neighborhood: 'West End • Pine Lane',
    latitude: 51.5245,
    longitude: -0.0698,
    coffeeScore: 8.9,
    workScore: 8.4,
    vibeScore: 9.3,
    tags: ['Social Spot', 'Fast Service', 'Quick'],
    summary: 'Bright and social spot that is perfect for quick coffee meetups.',
    googleMapsUrl: 'https://maps.google.com/?q=Golden+Hour+Cafe',
    communityStats: { saves: 124, visits: 590 },
  },
];

