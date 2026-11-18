export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  show_first_name?: boolean;
  is_deactivated?: boolean;
  age: number | null;
  gender: string | null;
  education_level?: string | null;
  family_status?: string | null;
  children_status?: string | null;
  children_count?: number | null;
  smoker_status?: string | null;
  alcohol_status?: string | null;
  is_restricted?: boolean;
  last_active_at?: string | null;
  city: string | null;
  neighborhood: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  profession: string | null;
  languages: string[];
  interests: string[];
  emojis: string[];
  values: string[];
  verified_at: string | null;
};

export type Post = {
  id: string;
  author_id: string;
  caption: string;
  image_url: string | null;
  interests: string[];
  activity: string | null;
  neighborhood: string | null;
  destination_url?: string | null;
  status: "active" | "archived" | "removed";
  visible_until: string;
  created_at: string;
  is_sponsored?: boolean;
  is_admin_post?: boolean;
  view_count?: number;
  pinned_until?: string | null;
  profiles?: Pick<Profile, "id" | "display_name" | "age" | "city" | "neighborhood" | "avatar_url" | "verified_at" | "profession"> & Pick<Profile, "education_level">;
};

export const interests = [
  "Voyage", "Cuisine", "Sport", "Musique", "Manga", "Lecture", "Art", "Nature",
  "Photo", "Danse", "Jeux vidéo", "Randonnée", "Tradition", "Mode", "Vouga", "Chill",
  "Création de contenu", "After-partie",
];

export const personalValues = [
  "Famille", "Respect", "Fidélité", "Honnêteté", "Obéissance", "Loyauté", "Ambition",
  "Solidarité", "Tolérance", "Responsabilité", "Spiritualité", "Liberté", "Confiance", "Simplicité",
];

export const relationshipTypes = ["Relation sérieuse", "Rencontre ouverte", "Amitié", "Pas de pression"];
export const activities = ["Café", "Promenade", "Restaurant", "Sport", "Concert", "Expo", "Cinéma", "Brunch"];
