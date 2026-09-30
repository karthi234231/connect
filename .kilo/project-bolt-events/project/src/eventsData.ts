export type EventFormat = 'Online' | 'In person';
export type EventType = 'workshop' | 'coffee' | 'build night';

export interface EventItem {
  id: string;
  title: string;
  description: string;
  host: string;
  location: string;
  format: EventFormat;
  duration: string;
  attendees: number;
  capacity: number;
  category: string;
  type: EventType;
  tone: string;
  tags: string[];
  event_date: string;
}

export interface NewEventInput {
  title: string;
  description: string;
  host: string;
  location: string;
  format: EventFormat;
  duration: string;
  capacity: number;
  category: string;
  type: EventType;
  tone: string;
  tags: string[];
  event_date: string;
}

export interface CategoryItem {
  label: string;
  count: number;
  tone: string;
  icon: string;
  image: string;
}

export const categories: CategoryItem[] = [
  {
    label: 'Exploring ideas',
    count: 24,
    tone: 'from-[#f5ddc4] to-[#fff5df]',
    icon: '✦',
    image: 'https://images.pexels.com/photos/390426/pexels-photo-390426.png?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    label: 'Developing',
    count: 8,
    tone: 'from-[#d8d0ff] to-[#eeeaff]',
    icon: '◇',
    image: 'https://images.pexels.com/photos/16764124/pexels-photo-16764124.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    label: 'Communities',
    count: 6,
    tone: 'from-[#ffd1dc] to-[#fff0f3]',
    icon: '▦',
    image: 'https://images.pexels.com/photos/99820/pexels-photo-99820.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
  {
    label: 'Creative practice',
    count: 12,
    tone: 'from-[#ccebe4] to-[#eefaf6]',
    icon: '◌',
    image: 'https://images.pexels.com/photos/9787367/pexels-photo-9787367.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  },
];

export const filterOptions = ['For you', 'This week', 'Online', 'Near me'] as const;
export type FilterOption = (typeof filterOptions)[number];

export const eventTypes: EventType[] = ['workshop', 'coffee', 'build night'];
export const eventFormats: EventFormat[] = ['Online', 'In person'];

export const toneOptions = [
  { label: 'Lavender', value: 'from-[#7565b2] via-[#a895d0] to-[#e4b896]' },
  { label: 'Copper', value: 'from-[#875339] via-[#c58c5d] to-[#e7c996]' },
  { label: 'Teal', value: 'from-[#397978] via-[#70aaa0] to-[#c6d7b5]' },
  { label: 'Rose', value: 'from-[#b2536a] via-[#d97a8e] to-[#f0c4b0]' },
  { label: 'Ocean', value: 'from-[#2d5a8e] via-[#5a8fc0] to-[#a8d0e8]' },
  { label: 'Forest', value: 'from-[#2d6e4e] via-[#5fa880] to-[#b8e0c8]' },
];

export const categoryOptions = [
  'Community',
  'Founders',
  'Learning',
  'Creative practice',
  'Exploring ideas',
  'Developing',
];
