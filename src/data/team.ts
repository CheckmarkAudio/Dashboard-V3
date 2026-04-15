export type TeamProfile = {
  id: string
  name: string
  initial: string
  role: string
  positions: string[]
  bio: string
  email: string
  website?: string
  socials?: { platform: string; url: string }[]
  // Admin-only fields
  dateJoined: string
  status: 'Active' | 'Inactive'
}

export const TEAM: TeamProfile[] = [
  {
    id: 'jordan',
    name: 'Jordan Lee',
    initial: 'J',
    role: 'Lead Engineer',
    positions: ['Engineer', 'Producer'],
    bio: 'Lead audio engineer with 8+ years of experience in studio recording, mixing, and mastering. Specializes in music production and podcast engineering.',
    email: 'jordan@checkmarkaudio.com',
    website: 'https://jordanlee.audio',
    socials: [
      { platform: 'Instagram', url: 'https://instagram.com/jordanleeaudio' },
      { platform: 'LinkedIn', url: 'https://linkedin.com/in/jordanlee' },
    ],
    dateJoined: 'Jan 15, 2024',
    status: 'Active',
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    initial: 'S',
    role: 'Audio Intern',
    positions: ['Intern', 'Media'],
    bio: 'Audio production intern learning the ropes of studio engineering, content creation, and media workflows. Currently completing the Audio Fundamentals certification.',
    email: 'sam@checkmarkaudio.com',
    socials: [
      { platform: 'Instagram', url: 'https://instagram.com/samrivera' },
    ],
    dateJoined: 'Mar 1, 2026',
    status: 'Active',
  },
  {
    id: 'alex',
    name: 'Alex Kim',
    initial: 'A',
    role: 'Marketing',
    positions: ['Marketing', 'Media'],
    bio: 'Handles social media strategy, brand content, platform analytics, and marketing campaigns for Checkmark Audio. Focused on growing the studio\'s digital presence.',
    email: 'alex@checkmarkaudio.com',
    website: 'https://alexkim.co',
    socials: [
      { platform: 'Instagram', url: 'https://instagram.com/alexkimco' },
      { platform: 'TikTok', url: 'https://tiktok.com/@alexkimco' },
    ],
    dateJoined: 'Jun 10, 2025',
    status: 'Active',
  },
  {
    id: 'taylor',
    name: 'Taylor Morgan',
    initial: 'T',
    role: 'Operations',
    positions: ['Administration', 'Operations'],
    bio: 'Manages studio operations, scheduling, invoicing, and equipment inventory. Keeps everything running smoothly behind the scenes.',
    email: 'taylor@checkmarkaudio.com',
    dateJoined: 'Feb 20, 2024',
    status: 'Active',
  },
  {
    id: 'taylor2',
    name: 'Taylor Morganson',
    initial: 'T',
    role: 'Operations',
    positions: ['Administration'],
    bio: 'Operations support handling team availability, software licenses, and administrative workflows.',
    email: 'tmorganson@checkmarkaudio.com',
    dateJoined: 'Nov 5, 2025',
    status: 'Inactive',
  },
]

export function getTeamMember(id: string): TeamProfile | undefined {
  return TEAM.find(m => m.id === id)
}
