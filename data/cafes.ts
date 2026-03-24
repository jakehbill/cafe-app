export type Cafe = {
  id: string;
  name: string;
  neighborhood: string;
  coffeeScore: number;
  workScore: number;
  vibeScore: number;
  tags: string[];
  summary: string;
  googleMapsUrl: string;
};

export const cafes: Cafe[] = [
  {
    id: '1',
    name: 'Moss & Co. Coffee',
    neighborhood: 'Downtown • Elm Street',
    coffeeScore: 9.4,
    workScore: 8.7,
    vibeScore: 9.1,
    tags: ['Quiet', 'Specialty Coffee', 'Laptop Friendly', 'Quick'],
    summary: 'Cozy light-filled seating with consistently great pour-overs.',
    googleMapsUrl: 'https://maps.google.com/?q=Moss+%26+Co.+Coffee',
  },
  {
    id: '2',
    name: 'Hearthline Cafe',
    neighborhood: 'Old Town • Cedar Ave',
    coffeeScore: 9.0,
    workScore: 8.9,
    vibeScore: 8.8,
    tags: ['Fast Service', 'Great Seating', 'Laptop Friendly'],
    summary: 'Warm wood interiors and roomy tables make long work sessions easy.',
    googleMapsUrl: 'https://maps.google.com/?q=Hearthline+Cafe',
  },
  {
    id: '3',
    name: 'Juniper Brew Bar',
    neighborhood: 'Riverside • Maple Row',
    coffeeScore: 9.6,
    workScore: 8.2,
    vibeScore: 8.9,
    tags: ['Specialty Coffee', 'Busy', 'Easy Grab & Go'],
    summary: 'A specialty-forward bar with fast espresso service and lively energy.',
    googleMapsUrl: 'https://maps.google.com/?q=Juniper+Brew+Bar',
  },
  {
    id: '4',
    name: 'Clay & Steam',
    neighborhood: 'Midtown • Willow Street',
    coffeeScore: 8.8,
    workScore: 9.1,
    vibeScore: 9.0,
    tags: ['Quiet', 'Good for Calls', 'Great Seating'],
    summary: 'Minimal, calm atmosphere with dependable Wi-Fi and soft ambient music.',
    googleMapsUrl: 'https://maps.google.com/?q=Clay+%26+Steam',
  },
  {
    id: '5',
    name: 'Golden Hour Cafe',
    neighborhood: 'West End • Pine Lane',
    coffeeScore: 8.9,
    workScore: 8.4,
    vibeScore: 9.3,
    tags: ['Social Spot', 'Fast Service', 'Quick'],
    summary: 'Bright and social spot that is perfect for quick coffee meetups.',
    googleMapsUrl: 'https://maps.google.com/?q=Golden+Hour+Cafe',
  },
];

