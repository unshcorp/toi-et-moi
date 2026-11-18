import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, BadgeCheck, Bell, ChevronDown, ChevronLeft, ChevronRight, Compass, Flag, Gift,
  Eye, Heart, Home as HomeIcon, Image as ImageIcon, LockKeyhole, MapPin, MessageCircle, Plus, Search, Settings as SettingsIcon, Share2,
  Shield, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, User as UserIcon, Users, X,
} from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { activities, interests, personalValues, relationshipTypes } from "./lib/types";
import type { Post, Profile } from "./lib/types";
import { supabase } from "./lib/supabase";

function displayName(profile?: Partial<Profile> | null) {
  if (profile?.show_first_name && profile.first_name) return profile.first_name;
  return profile?.display_name || profile?.first_name || "Profil";
}

function appUrl(path: string) {
  return new URL(`${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`, window.location.origin).toString();
}

function authErrorMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "email_address_invalid") return "Cette adresse e-mail semble invalide. Vérifie l’orthographe et le domaine, puis réessaie.";
  if (code === "email_address_not_authorized") return "L’envoi vers cette adresse n’est pas encore autorisé par Supabase. Un serveur SMTP personnalisé doit être configuré.";
  if (code === "over_email_send_rate_limit" || (error && typeof error === "object" && "status" in error && error.status === 429)) return "La limite d’envoi d’e-mails est atteinte. Réessaie un peu plus tard.";
  if (code === "email_exists") return "Cette adresse a déjà un compte. Connecte-toi ou réinitialise ton mot de passe.";
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessaie.";
}

function compatibilityScore(viewer?: Partial<Profile> | null, candidate?: Partial<Profile> | null) {
  const interestsA = viewer?.interests ?? [];
  const interestsB = candidate?.interests ?? [];
  const valuesA = viewer?.values ?? [];
  const valuesB = candidate?.values ?? [];
  const scores: number[] = [];
  if (interestsA.length && interestsB.length) {
    const shared = interestsA.filter((item) => interestsB.includes(item)).length;
    scores.push(shared / Math.max(interestsA.length, interestsB.length));
  }
  if (valuesA.length && valuesB.length) {
    const shared = valuesA.filter((item) => valuesB.includes(item)).length;
    scores.push(shared / Math.max(valuesA.length, valuesB.length));
  }
  return scores.length ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 100) : null;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function BrandLogo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return <img className={`brand-logo ${light ? "brand-logo-light" : "brand-logo-blue"} ${className}`} src={`${import.meta.env.BASE_URL}brand/toi-moi-${light ? "white" : "blue"}.png`} alt="TOI&MOI" />;
}

function ageFromBirthDate(value: string) {
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

function Avatar({ profile, size = "md" }: { profile?: Partial<Profile> | null; size?: "sm" | "md" | "lg" }) {
  return profile?.avatar_url
    ? <img className={`avatar avatar-${size}`} src={profile.avatar_url} alt="" />
    : <span className={`avatar avatar-${size} avatar-placeholder`}>{initials(displayName(profile))}</span>;
}

function ConfigNotice() {
  return <main className="auth-screen"><section className="auth-card config-card">
    <div className="brand-mark"><BrandLogo light /></div>
    <h1>La base arrive bientôt</h1>
    <p>Cette copie démarre sans données importées. Configure Supabase dans <code>.env</code> pour activer les comptes, les publications et l’administration.</p>
    <p className="muted">Copie <code>.env.example</code> vers <code>.env</code>, puis renseigne l’URL du projet et sa clé publique.</p>
  </section></main>;
}

function AuthPage({ mode }: { mode: "login" | "register" | "forgot" }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setError(""); setMessage(""); setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
        navigate("/");
      } else if (mode === "register") {
        if (password !== confirm) throw new Error("Les mots de passe ne correspondent pas.");
        const { data, error: authError } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { phone: phone.trim() }, emailRedirectTo: appUrl("onboarding") } });
        if (authError) throw authError;
        if (data.session) navigate("/onboarding");
        else if (data.user && !data.user.email_confirmed_at) {
          setConfirmationEmail(normalizedEmail);
          setMessage("Demande reçue par Supabase. Cela ne confirme pas la livraison du mail : vérifie aussi tes courriers indésirables.");
        } else setMessage("Si cette adresse peut être inscrite, un e-mail de confirmation va être envoyé.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: appUrl("login") });
        if (authError) throw authError;
        setMessage("Si cette adresse existe, un lien de réinitialisation a été envoyé.");
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (!supabase || !confirmationEmail) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: appUrl("onboarding") },
      });
      if (resendError) throw resendError;
      setMessage("Supabase a accepté la demande de renvoi. La livraison du mail n’est pas confirmée.");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally { setBusy(false); }
  }

  async function google() {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl("onboarding") } });
    if (authError) setError(authError.message);
  }

  const title = mode === "login" ? "Bon retour" : mode === "register" ? "Crée ton compte" : "Réinitialiser le mot de passe";
  const subtitle = mode === "login" ? "Connecte-toi à ton compte" : mode === "register" ? "Inscris-toi pour commencer" : "Nous t’enverrons un lien pour le réinitialiser";

  return <main className="auth-screen">
    <Link to="/welcome" className="auth-back"><ArrowLeft size={17} /> Retour à l’accueil</Link>
    <section className="auth-card">
      <div className="brand-mark"><BrandLogo light /></div>
      <h1>{title}</h1><p className="subtitle">{subtitle}</p>
      {mode !== "forgot" && <>
        <button className="google-button" type="button" onClick={() => void google()}><span className="google-g">G</span> Continuer avec Google</button>
        <div className="separator"><span>OU</span></div>
      </>}
      <form onSubmit={(event) => void submit(event)} className="form-stack">
        <label>Email<input type="email" autoComplete="email" placeholder="toi@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {mode === "register" && <label>Numéro de téléphone<input type="tel" autoComplete="tel" placeholder="+33 6 00 00 00 00" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>}
        {mode !== "forgot" && <label className="password-label">Mot de passe<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />{mode === "login" && <Link className="inline-link" to="/forgot-password">Mot de passe oublié ?</Link>}</label>}
        {mode === "register" && <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success">{message}</p>}
      {confirmationEmail && <>
        <p className="muted tiny">L’envoi des confirmations aux utilisateurs nécessite un SMTP personnalisé dans Supabase.</p>
        <button className="resend-button" type="button" disabled={busy} onClick={() => void resendConfirmation()}>{busy ? "Demande en cours…" : "Renvoyer l’e-mail de confirmation"}</button>
      </>}
        <button className="button button-primary full-width" type="submit" disabled={busy || !supabase}>{busy ? "Un instant…" : mode === "login" ? "Se connecter" : mode === "register" ? "Créer mon compte" : "Envoyer le lien"}</button>
        {!supabase && <small className="muted center">La base de données doit être configurée avant la connexion.</small>}
      </form>
      {mode !== "forgot" && <p className="auth-footer">{mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}<Link className="inline-link" to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Créer un compte" : "Se connecter"}</Link></p>}
      {mode === "forgot" && <Link className="inline-link center-link" to="/login">Retour à la connexion</Link>}
    </section>
  </main>;
}

function Welcome() {
  return <main className="welcome-screen">
    <div className="welcome-brand"><BrandLogo light className="welcome-logo" /></div>
    <div className="welcome-copy"><p className="eyebrow">Deux profils. Une connexion.</p><h1>Une photo.<br />Un feeling.<br /><span>Une rencontre.</span></h1><p>Le réseau social où les publications peuvent devenir des rencontres. Ici, pas de swipe : on découvre une personne avant de la rencontrer.</p></div>
    <div className="welcome-actions"><Link className="button button-primary full-width" to="/register">Créer mon compte</Link><Link className="button button-quiet full-width" to="/login">J’ai déjà un compte</Link></div>
  </main>;
}

function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [education, setEducation] = useState("");
  const [familyStatus, setFamilyStatus] = useState("");
  const [childrenStatus, setChildrenStatus] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [smokerStatus, setSmokerStatus] = useState("");
  const [alcoholStatus, setAlcoholStatus] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [emojis, setEmojis] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;
    if (ageFromBirthDate(birthDate) < 18 || !adult) { setError("Tu dois avoir 18 ans ou plus."); return; }
    if (!terms) { setError("Accepte les conditions pour continuer."); return; }
    if (emojis.length !== 3) { setError("Choisis exactement trois emojis."); return; }
    if (selectedValues.length !== 3) { setError("Choisis exactement trois valeurs personnelles."); return; }
    if (selectedInterests.length !== 7) { setError("Choisis exactement sept centres d’intérêt."); return; }
    if (!profession.trim() || !education || !familyStatus || !childrenStatus || !smokerStatus || !alcoholStatus) { setError("Complète les informations personnelles obligatoires."); return; }
    setBusy(true); setError("");
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const path = `${user.id}/avatar-${crypto.randomUUID()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage.from("public-media").upload(path, avatarFile, { upsert: false });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
      }
      const { error: privateError } = await supabase.from("profile_private").upsert({ user_id: user.id, phone: phone.replace(/[\s()-]/g,""), birth_date: birthDate, terms_accepted_at: new Date().toISOString() });
      if (privateError) throw privateError;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id, first_name: firstName.trim(), last_name: lastName.trim(), display_name: firstName.trim(), age: ageFromBirthDate(birthDate), gender, avatar_url: avatarUrl,
        city: city.trim(), neighborhood: neighborhood.trim(), emojis, profession: profession.trim(), education_level: education,
        family_status: familyStatus, children_status: childrenStatus, children_count: childrenStatus === "Oui" ? Number(childrenCount || 0) : 0,
        smoker_status: smokerStatus, alcohol_status: alcoholStatus, values: selectedValues, interests: selectedInterests,
      });
      if (profileError) throw profileError;
      await refreshProfile(); navigate("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer le profil."); }
    finally { setBusy(false); }
  }

  const emojiList = ["😊","😍","🔥","✨","🌙","☕","🎧","🎬","✈️","📷","🎨","⚽","🏀","🏖️","🍷","🍕","🐱","🐶","🌸","💎","👑","🦋","🍀","⚡","🚀","🎯","❤️","😎","🤙","🙌","🌍","🎭","📚","🎸","🏄","🧘","🦄","🌺","🌟","💫","🏆","🦁","🐢","🦉","🐳","🌈","🪐","🔮","🎲","🧩"];
  function toggleEmoji(value: string) { setEmojis((current) => current.includes(value) ? current.filter((item) => item !== value) : current.length < 3 ? [...current, value] : current); }

  return <main className="onboarding-page"><Link to="/" className="auth-back"><ArrowLeft size={17} /> Retour</Link><section className="panel onboarding-panel">
    <div className="brand-mark"><BrandLogo light /></div><h1>Qui es-tu ?</h1>
    <form className="form-stack" onSubmit={(event) => void finish(event)}>
      <label className="upload-field">Photo de profil<input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /><span className="upload-tile">{avatarFile ? avatarFile.name : <><Plus size={22} /> Ajouter une photo</>}</span></label>
      <div className="two-columns"><label>Prénom<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label><label>Nom<input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label></div>
      <div className="two-columns"><label>Date de naissance<input type="date" max={new Date(new Date().setFullYear(new Date().getFullYear()-18)).toISOString().slice(0,10)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required /></label><label>Genre<select value={gender} onChange={(e) => setGender(e.target.value)} required><option value="">Choisir</option><option>Femme</option><option>Homme</option><option>Non binaire</option><option>Autre</option></select></label></div>
      <label>Téléphone (jamais affiché publiquement)<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
      <div className="two-columns"><label>Ville<input value={city} onChange={(e) => setCity(e.target.value)} required /></label><label>Quartier<input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} required /></label></div>
      <label>Profession<input value={profession} onChange={(e)=>setProfession(e.target.value)} required /></label>
      <div className="two-columns"><label>Niveau d’études<select value={education} onChange={e=>setEducation(e.target.value)} required><option value="">Choisir</option><option>Collège</option><option>Lycée</option><option>Université</option><option>Travailleur</option></select></label><label>Situation familiale<select value={familyStatus} onChange={e=>setFamilyStatus(e.target.value)} required><option value="">Choisir</option><option>Célibataire</option><option>En relation libre</option><option>Autre</option></select></label></div>
      <div className="two-columns"><label>Enfant(s)<select value={childrenStatus} onChange={e=>setChildrenStatus(e.target.value)} required><option value="">Choisir</option><option>Non</option><option>Oui</option></select></label>{childrenStatus==="Oui"&&<label>Nombre d’enfants<input type="number" min="1" max="30" value={childrenCount} onChange={e=>setChildrenCount(e.target.value)} required/></label>}</div>
      <div className="two-columns"><label>Statut fumeur<select value={smokerStatus} onChange={e=>setSmokerStatus(e.target.value)} required><option value="">Choisir</option><option>Non</option><option>Oui</option></select></label><label>Consommation d’alcool<select value={alcoholStatus} onChange={e=>setAlcoholStatus(e.target.value)} required><option value="">Choisir</option><option>Jamais</option><option>Occasionnellement</option><option>Souvent</option></select></label></div>
      <div><span className="field-label">Tes 3 valeurs personnelles</span><ChipPicker values={personalValues} selected={selectedValues} onToggle={value=>setSelectedValues(current=>current.includes(value)?current.filter(item=>item!==value):current.length<3?[...current,value]:current)}/><small className="muted">Sélectionne exactement trois valeurs.</small></div>
      <div><span className="field-label">Tes 7 centres d’intérêt principaux</span><ChipPicker values={interests} selected={selectedInterests} onToggle={value=>setSelectedInterests(current=>current.includes(value)?current.filter(item=>item!==value):current.length<7?[...current,value]:current)}/><small className="muted">Sélectionne exactement sept centres d’intérêt.</small></div>
      <div><span className="field-label">3 emojis à côté de ton prénom</span><div className="selected-emojis">{[0,1,2].map((index) => <span key={index} className="emoji-slot">{emojis[index] || "+"}</span>)}</div><div className="emoji-grid">{emojiList.map((emoji) => <button type="button" aria-pressed={emojis.includes(emoji)} className={emojis.includes(emoji) ? "emoji-choice selected" : "emoji-choice"} onClick={() => toggleEmoji(emoji)} key={emoji}>{emoji}</button>)}</div></div>
      <label className="check-row"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Je confirme avoir 18 ans ou plus.</label>
      <label className="check-row"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> J’accepte les conditions générales, la politique de confidentialité et les règles communautaires.</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-width" disabled={busy || !supabase}>{busy ? "Enregistrement…" : "Continuer"}</button>
    </form>
  </section></main>;
}

function Protected() {
  const { configured, loading, user, profile } = useAuth();
  const location = useLocation();
  if (!configured) return <ConfigNotice />;
  if (loading) return <div className="loading-screen"><BrandLogo light className="loading-logo" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile && location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  if (profile?.is_deactivated) return <DisabledAccount/>;
  return <Outlet />;
}

function DisabledAccount(){
  const {user,signOut,refreshProfile}=useAuth();const [message,setMessage]=useState("");
  async function reactivate(){if(!supabase||!user)return;const {error}=await supabase.from("profiles").update({is_deactivated:false}).eq("id",user.id);if(error)setMessage(error.message);else{setMessage("Compte réactivé.");await refreshProfile();}}
  return <main className="auth-screen"><section className="auth-card"><div className="brand-mark"><Shield size={22}/></div><h1>Compte désactivé</h1><p className="muted">Ton profil n’est plus visible. Tu peux le réactiver à tout moment.</p>{message&&<p className="form-error">{message}</p>}<button className="button button-primary full-width" onClick={()=>void reactivate()}>Réactiver mon compte</button><button className="button button-quiet full-width" onClick={()=>void signOut()}>Se déconnecter</button></section></main>;
}

function AppShell() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const isProfile = location.pathname.startsWith("/profile");
  const nav = [
    { to: "/", label: "Accueil", icon: HomeIcon },
    { to: "/search", label: "Découvrir", icon: Compass },
    { to: "/create", label: "Créer", icon: Plus, create: true },
    { to: "/connections", label: "Connexions", icon: Users },
    { to: "/profile", label: "Profil", icon: UserIcon },
  ];
  return <div className="app-frame">
    {location.pathname !== "/" && <header className="topbar"><Link to="/" className="wordmark"><BrandLogo className="topbar-logo" /></Link><div className="top-actions"><Link aria-label="Découvrir" to="/search"><Search size={19} /></Link><Link aria-label="Notifications" className="notification-link" to="/notifications"><Bell size={19} /><i /></Link>{isProfile && <Link aria-label="Paramètres" to="/settings"><SettingsIcon size={19} /></Link>}</div></header>}
    <main className="app-content"><Outlet /></main>
    {isAdmin && <Link className="admin-fab" to="/admin" aria-label="Administration"><Shield size={18} /></Link>}
    <nav className="bottom-nav" aria-label="Navigation principale">{nav.map(({to,label,icon:Icon,create}) => <Link key={to} to={to} className={`${location.pathname === to ? "active" : ""} ${create ? "nav-create" : ""}`}><span><Icon size={19} /></span><small>{label}</small></Link>)}</nav>
  </div>;
}

function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="screen-title"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}

function EmptyState({ icon: Icon = Sparkles, title, detail }: { icon?: typeof Sparkles; title: string; detail: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={24} /></div><h2>{title}</h2><p>{detail}</p></div>;
}

function Home() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const tabs = [
    ["feed", "Feed"], ["sentiment", "Sentiment du jour"], ["pres", "Près de toi"],
    ["pp", "Pourquoi pas"], ["pi", "Première impression"],
  ] as const;

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase || !user) { setLoading(false); return; }
      setLoading(true);
      const [{ data: people }, { data: feed }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").neq("id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("posts").select("*, profiles(id, first_name, display_name, show_first_name, age, city, neighborhood, avatar_url, verified_at, profession, education_level)").eq("status", "active").order("created_at", { ascending: false }).limit(30),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
      ]);
      if (alive) {
        setProfiles((people ?? []) as Profile[]);
        setPosts((feed ?? []) as Post[]);
        setUnreadCount(count ?? 0);
      }
      if (alive) setLoading(false);
    }
    const refresh=()=>void load();
    window.addEventListener("toi:post-change",refresh);
    void load(); return () => { alive = false;window.removeEventListener("toi:post-change",refresh); };
  }, [user]);

  const visiblePosts = posts.filter((post) => {
    if (tab === "pres") {
      const author = post.profiles;
      if (profile?.neighborhood && author?.neighborhood) return profile.neighborhood.toLowerCase() === author.neighborhood.toLowerCase();
      if (profile?.city && author?.city) return profile.city.toLowerCase() === author.city.toLowerCase();
    }
    if (tab === "sentiment") return Boolean(post.activity || post.interests?.length);
    return true;
  });
  const visiblePeople = tab === "pp" && profile?.interests?.length
    ? profiles.filter((person) => !person.interests?.some((interest) => profile.interests.includes(interest)))
    : profiles;
  const postTab = tab !== "pi" && tab !== "pp";

  return <div className="home-original">
    <header className="home-original-header">
      <Link to="/profile" className="home-avatar-link" aria-label="Mon profil"><Avatar profile={profile} size="lg" />{profile?.verified_at && <BadgeCheck className="home-verified-ring" size={17} />}</Link>
      <Link to="/" className="home-logo" aria-label="TOI & MOI"><BrandLogo light className="home-brand-logo" /></Link>
      <div className="home-header-actions"><Link to="/search" aria-label="Rechercher"><Search size={20}/></Link><Link to="/notifications" aria-label="Notifications" className="home-bell"><Bell size={20}/>{unreadCount>0&&<span>{unreadCount}</span>}</Link></div>
    </header>
    <div className="home-original-tagline"><h1>On ne rencontre pas seulement un profil... <em>On y découvre une personne.</em></h1></div>
    <div className="home-people-strip" aria-label="Profils à découvrir">{profiles.slice(0,10).map((person)=><Link key={person.id} to={`/profile/${person.id}`} className="home-person"><span className="home-person-avatar"><Avatar profile={person} size="md"/>{person.verified_at&&<i/>}</span><span>{displayName(person).split(" ")[0]}</span></Link>)}</div>
    <div className="home-original-tabs" role="tablist">{tabs.map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?"selected":""} onClick={()=>setTab(key)}>{label}</button>)}</div>
    <div className="home-original-feed">
      {tab === "pres" && <p className="privacy-note"><MapPin size={15}/> Quartier et ville uniquement : aucune position précise n’est affichée.</p>}
      {tab === "sentiment" && <p className="home-tab-hint">Des publications choisies selon les activités et centres d’intérêt partagés.</p>}
      {tab === "pp" && <p className="home-tab-hint">Des profils aux centres d’intérêt différents, pour élargir les découvertes.</p>}
      {loading ? <div className="loading-card">Chargement…</div> : postTab ? visiblePosts.length ? <div className="post-list">{visiblePosts.map((post)=><PostCard key={post.id} post={post}/>)}</div> : <EmptyState icon={tab==="pres"?MapPin:Heart} title={tab==="pres"?"Aucune publication à proximité":"Le feed commence ici"} detail={tab==="pres"?"Aucune publication de ton quartier ou de ta ville pour le moment.":"Aucune publication pour le moment. Partage une photo, une activité ou un feeling."}/> : visiblePeople.length ? <ProfileDeck profiles={visiblePeople}/> : <EmptyState icon={Users} title="Pas encore de profil à découvrir" detail="Les nouvelles personnes apparaîtront ici."/>}
    </div>
  </div>;
}

function ProfileDeck({ profiles }: { profiles: Profile[] }) {
  const { profile: viewer } = useAuth();
  const [index, setIndex] = useState(0);
  const profile = profiles[index];
  if (!profile) return <EmptyState title="Aucun profil" detail="Reviens un peu plus tard." />;
  return <article className="deck-card">
    <div className="cover-gradient" /><Avatar profile={profile} size="lg" />
    <div className="deck-content"><h2>{displayName(profile)}{profile.emojis?.length ? ` ${profile.emojis.join("")}` : ""}{profile.age ? `, ${profile.age}` : ""}</h2><p className="muted"><MapPin size={14} /> {profile.neighborhood}, {profile.city}</p>{profile.verified_at && <span className="verified"><BadgeCheck size={15} /> Profil vérifié</span>}
      {profile.bio && <blockquote>« {profile.bio} »</blockquote>}
      <p className="tag-line">{profile.interests?.slice(0, 4).join(" · ")}</p>
      {compatibilityScore(viewer, profile) !== null && <div className="compatibility"><strong>{compatibilityScore(viewer, profile)}%</strong> de points communs · intérêts et valeurs</div>}
      <div className="deck-actions"><button className="button button-quiet" onClick={() => setIndex((value) => (value - 1 + profiles.length) % profiles.length)}><ChevronLeft size={17} /> Précédent</button><span>{index + 1} / {profiles.length}</span><button className="button button-quiet" onClick={() => setIndex((value) => (value + 1) % profiles.length)}>Suivant <ChevronRight size={17} /></button></div>
      <Link className="button button-primary full-width" to={`/profile/${profile.id}`}>Voir le profil complet</Link>
    </div>
  </article>;
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [likeCount,setLikeCount]=useState(0);
  const [commentCount,setCommentCount]=useState(0);
  const [commentRevision,setCommentRevision]=useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [tuchSent,setTuchSent]=useState(false);
  const [adOpen,setAdOpen]=useState(false);
  const [removed,setRemoved]=useState(false);
  const { user, profile, isAdmin } = useAuth();
  const author = post.profiles;

  useEffect(()=>{if(!supabase)return;let alive=true;void (async()=>{
    const [{count:likes},{count:comments},{data:ownLike}]=await Promise.all([
      supabase.from("post_likes").select("user_id",{count:"exact",head:true}).eq("post_id",post.id),
      supabase.from("comments").select("id",{count:"exact",head:true}).eq("post_id",post.id),
      user?supabase.from("post_likes").select("user_id").eq("post_id",post.id).eq("user_id",user.id).maybeSingle():Promise.resolve({data:null}),
    ]);if(alive){setLikeCount(likes??0);setCommentCount(comments??0);setLiked(Boolean(ownLike));}
  })();return()=>{alive=false;};},[post.id,user]);

  async function addComment(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!supabase || !user || !comment.trim()) return;
    const { error: insertError } = await supabase.from("comments").insert({ post_id: post.id, author_id: user.id, body: comment.trim() });
    if (insertError) setError(insertError.message); else {setComment("");setCommentCount(value=>value+1);setCommentRevision(value=>value+1);}
  }
  async function toggleLike() {
    if (!supabase || !user) return;
    if (liked) {
      const {error}=await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if(!error){setLiked(false);setLikeCount(value=>Math.max(0,value-1));}
    } else {
      const { error: insertError } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id });
      if (!insertError) {setLiked(true);setLikeCount(value=>value+1);}
    }
  }
  async function removePost() {
    if (!supabase || !window.confirm("Confirmer la suppression de cette publication ?")) return;
    const {error:removeError}=await supabase.from("posts").update({ status: "removed" }).eq("id", post.id);
    if(removeError)setError(removeError.message);else{setRemoved(true);window.dispatchEvent(new Event("toi:post-change"));}
  }
  async function sendTuch(){if(!supabase||!user||user.id===post.author_id)return;setError("");const {error:requestError}=await supabase.from("tuch_me_requests").insert({from_user:user.id,to_user:post.author_id});if(requestError)setError(requestError.message);else setTuchSent(true);}
  async function sharePost(){const shareUrl=`${window.location.origin}/post/${post.id}`;try{if(navigator.share)await navigator.share({title:"TOI&MOI",text:post.caption,url:shareUrl});else{await navigator.clipboard.writeText(shareUrl);setError("Lien copié pour le partage.");}}catch(cause){if(cause instanceof Error&&cause.name!=="AbortError")setError("Le partage n’a pas pu être ouvert.");}}
  if(removed)return null;
  const official=Boolean(post.is_admin_post);
  return <article className="post-card">
    <header className="post-author"><Link to={`/profile/${post.author_id}`} className="author-main"><Avatar profile={author} size="sm" /><span><strong>{official?"You&Me by Unshcorp":displayName(author)}{author?.verified_at && <BadgeCheck className="inline-badge" size={14} />}</strong><small>{official?"Admin":<>{author?.neighborhood}{author?.city?`, ${author.city}`:""}{author?.profession?` · ${author.profession}`:""}{author?.education_level?` · ${author.education_level}`:""}</>}</small></span></Link></header>
    {post.image_url && <Link to={`/post/${post.id}`} className="post-image-link"><img className="post-image" src={post.image_url} alt="Publication" /></Link>}
    <div className="post-body">{(post.is_sponsored||official)&&<span className="post-sponsored">✦ {official?"Publicité officielle":"Publicité sponsorisée"}</span>}{post.interests?.length&&!official?<span className="post-sponsored">✦ {post.interests[0]}</span>:null}<div className="post-meta"><span><Heart size={14}/> {likeCount} Kiff</span><span><MessageCircle size={14}/> {commentCount} Ogoula</span><time>{new Date(post.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</time></div><p>{post.caption}</p>{post.interests?.map(interest=><span className="tag" key={interest}>#{interest}</span>)}
      {post.destination_url&&<a className="inline-link post-destination" href={post.destination_url} target="_blank" rel="noreferrer">Découvrir le lien</a>}
      {official&&<p className="post-view-count"><Eye size={14}/> {post.view_count??0} vues</p>}
      <div className="post-actions"><button className={liked?"liked":""} onClick={()=>void toggleLike()}><Heart size={16}/> Kiff</button><button onClick={()=>setCommentsOpen(true)}><MessageCircle size={16}/> Ogoula</button>{official?<><button onClick={()=>setAdOpen(true)}>Placez ma pub</button><button onClick={()=>void sharePost()}><Share2 size={16}/> Partager</button></>:post.author_id!==user?.id&&<button className="button-tuch" onClick={()=>void sendTuch()} disabled={tuchSent}>{tuchSent?"Envoyé":"TUCH ME"}</button>}{(isAdmin||post.author_id===user?.id)&&<button className="danger-quiet" onClick={()=>void removePost()}><Trash2 size={16}/> Supprimer</button>}</div>
      {!profile?.verified_at&&!isAdmin&&<small className="muted">La vérification est requise pour Ogoula et TUCH ME.</small>}{error&&<p className={error.includes("copié")?"form-success":"form-error"}>{error}</p>}
    </div>
    {commentsOpen&&<Modal title="Ogoula" onClose={()=>setCommentsOpen(false)}><CommentList postId={post.id} refreshToken={commentRevision}/>{profile?.verified_at||isAdmin?<form className="comment-form" onSubmit={event=>void addComment(event)}><input value={comment} onChange={event=>setComment(event.target.value)} placeholder="Écris un Ogoula…"/><button className="button button-primary" disabled={!comment.trim()}>Envoyer</button></form>:<p className="muted">La vérification du compte est nécessaire pour laisser un Ogoula.</p>}{error&&<p className="form-error">{error}</p>}</Modal>}
    {adOpen&&<AdModal onClose={()=>setAdOpen(false)}/>}
  </article>;
}

function PostDetail() {
  const { id } = useParams();
  const [post,setPost] = useState<Post | null>(null);
  useEffect(() => {
    if (!supabase || !id) return;
    void supabase.from("posts").select("*, profiles(id, first_name, display_name, show_first_name, age, city, neighborhood, avatar_url, verified_at, profession, education_level)").eq("id",id).maybeSingle().then(({data}) => setPost(data as Post | null));
  },[id]);
  return <><div className="page-topline"><Link className="icon-button" to="/"><ArrowLeft size={18}/></Link><ScreenTitle title="Publication"/></div>{post ? <PostCard post={post}/> : <EmptyState icon={Heart} title="Publication indisponible" detail="Elle a peut-être été retirée ou n’est plus visible."/>}</>;
}

function CommentList({ postId,refreshToken }: { postId: string;refreshToken:number }) {
  const [comments, setComments] = useState<Array<{id:string;body:string;profiles?:{display_name:string;first_name?:string;show_first_name?:boolean}|null}>>([]);
  useEffect(() => { if (!supabase) return; void supabase.from("comments").select("id, body, profiles(display_name,first_name,show_first_name)").eq("post_id", postId).order("created_at").then(({data}) => setComments((data ?? []) as unknown as typeof comments)); }, [postId,refreshToken]);
  if (!comments.length) return <p className="muted center">Sois le premier à lancer la conversation.</p>;
  return <div className="comment-list">{comments.map((item) => <div className="comment" key={item.id}><strong>{displayName(item.profiles)}</strong><p>{item.body}</p></div>)}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Fermer" onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}

function SearchPage() {
  const { user, profile: viewer } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [age, setAge] = useState(18);
  const [maxAge, setMaxAge] = useState(80);
  const [gender, setGender] = useState("Tous les genres");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [relationshipFilter, setRelationshipFilter] = useState<string[]>([]);
  const [interestsFilter, setInterestsFilter] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase || !user) return;
      let request = supabase.from("profiles").select("*").neq("id", user.id).gte("age", age).lte("age",maxAge).limit(50);
      if (query.trim()) request = request.or(`first_name.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
      if (gender !== "Tous les genres") request = request.eq("gender", gender);
      if (city.trim()) request = request.ilike("city", `%${city.trim()}%`);
      if (neighborhood.trim()) request = request.ilike("neighborhood", `%${neighborhood.trim()}%`);
      if (verifiedOnly) request = request.not("verified_at", "is", null);
      if (activeOnly) request = request.gte("updated_at",new Date(Date.now()-7*86400000).toISOString());
      if (relationshipFilter.length) request = request.in("relationship_type",relationshipFilter);
      if (interestsFilter.length) request = request.overlaps("interests",interestsFilter);
      const { data } = await request;
      if (alive) setProfiles((data ?? []) as Profile[]);
    }
    void load(); return () => { alive = false; };
  }, [user, query, age, maxAge, gender, city, neighborhood, verifiedOnly,activeOnly,relationshipFilter,interestsFilter]);
  function toggleInterest(value: string) { setInterestsFilter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }
  return <>
    <ScreenTitle title="Découvrir" />
    <div className="search-row"><label className="search-input"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Prénom ou centre d’intérêt" /></label><button className="round-control" aria-label="Filtres" onClick={() => setOpen(true)}><SlidersHorizontal size={19} /></button></div>
    <p className="privacy-note"><MapPin size={15} /> Seuls le quartier et la ville sont visibles — jamais de position précise.</p>
    <div className="profile-results">{profiles.length ? profiles.filter((profile) => interestsFilter.length === 0 || interestsFilter.some((item) => profile.interests?.includes(item))).map((profile) => <Link className="profile-result" key={profile.id} to={`/profile/${profile.id}`}><Avatar profile={profile} size="md" /><span><strong>{displayName(profile)}{profile.emojis?.join("")} {profile.age}{profile.verified_at && <BadgeCheck className="inline-badge" size={14} />}</strong><small><MapPin size={13} /> {profile.neighborhood}, {profile.city}</small><small>{profile.interests?.slice(0, 4).join(" · ")}</small></span><strong className="result-match">{compatibilityScore(viewer, profile) === null ? "—" : `${compatibilityScore(viewer, profile)}%`}</strong></Link>) : <EmptyState icon={Search} title="Aucun profil trouvé" detail="Essaie d’élargir tes filtres ou reviens plus tard." />}</div>
    {open && <Modal title="Filtres" onClose={() => setOpen(false)}><div className="filter-panel"><div className="two-columns"><label>Âge minimum : {age}<input type="range" min="18" max="80" value={age} onChange={(e) => setAge(Math.min(Number(e.target.value),maxAge))} /></label><label>Âge maximum : {maxAge}<input type="range" min="18" max="80" value={maxAge} onChange={(e) => setMaxAge(Math.max(age,Number(e.target.value)))} /></label></div><label>Genre<select value={gender} onChange={(e) => setGender(e.target.value)}><option>Tous les genres</option><option>Femme</option><option>Homme</option><option>Non binaire</option><option>Autre</option></select></label><label>Ville<input value={city} onChange={(e) => setCity(e.target.value)} /></label><label>Quartier<input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} /></label><span className="field-label">Type de relation</span><ChipPicker values={relationshipTypes} selected={relationshipFilter} onToggle={(value)=>setRelationshipFilter(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])}/><span className="field-label">Centres d’intérêt</span><ChipPicker values={interests} selected={interestsFilter} onToggle={toggleInterest} /><label className="check-row"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Profils vérifiés uniquement</label><label className="check-row"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Actifs cette semaine</label><button className="button button-primary full-width" onClick={() => setOpen(false)}>Voir les profils</button></div></Modal>}
  </>;
}

function ChipPicker({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="chip-list">{values.map((value) => <button type="button" key={value} aria-pressed={selected.includes(value)} className={`chip ${selected.includes(value) ? "selected" : ""}`} onClick={() => onToggle(value)}>{value}</button>)}</div>;
}

function CreatePost() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [activity, setActivity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usedToday,setUsedToday]=useState(0);
  const [preview,setPreview]=useState("");
  const dailyLimit=profile?.verified_at?10:1;
  useEffect(()=>{if(!file){setPreview("");return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>{if(!supabase||!user||isAdmin)return;const start=new Date();start.setHours(0,0,0,0);void supabase.from("posts").select("id",{count:"exact",head:true}).eq("author_id",user.id).gte("created_at",start.toISOString()).neq("status","removed").then(({count})=>setUsedToday(count??0));},[user,isAdmin]);
  function toggle(value: string) { setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }
  async function publish(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !user) return;
    if(!file){setError("Ajoute une photo à ta publication.");return;}
    setBusy(true); setError("");
    try {
      if(file.size>10*1024*1024)throw new Error("La photo doit faire 10 Mo maximum.");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("public-media").upload(path, file, { upsert: false,contentType:file.type });
      if (uploadError) throw uploadError;
      const imageUrl=supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
      const { error: insertError } = await supabase.from("posts").insert({ author_id: user.id, caption: caption.trim(), image_url: imageUrl, interests: selected, activity: activity || null, neighborhood: neighborhood || null, destination_url: link || null });
      if (insertError) throw insertError;
      window.dispatchEvent(new Event("toi:post-change"));
      navigate("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de publier."); }
    finally { setBusy(false); }
  }
  return <>
    <ScreenTitle title="Une photo. Un feeling." subtitle={isAdmin?"Publication officielle · visible 10 jours":`Publications aujourd’hui : ${usedToday}/${dailyLimit} · visibles 3 jours${profile?.verified_at?"":" · vérification requise pour 10 publications"}`} />
    <form className="panel form-stack create-form" onSubmit={(event) => void publish(event)}>
      <label className="upload-field">Image de la publication<input type="file" accept="image/*" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><span className="upload-tile">{file ? file.name : <><Plus size={21}/> Ajouter une photo</>}</span></label>{preview&&<div className="create-image-preview"><img src={preview} alt="Aperçu de la publication"/><button type="button" className="button button-quiet" onClick={()=>setFile(null)}>Retirer la photo</button></div>}
      <label>Légende<textarea rows={4} maxLength={600} placeholder="Qu’est-ce que tu as envie de partager ?" value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
      <div><span className="field-label">Centres d’intérêt associés</span><ChipPicker values={interests} selected={selected} onToggle={toggle} /></div>
      <label>Lien de destination (facultatif)<input type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} /></label>
      <div className="two-columns"><label>Quartier (facultatif)<input placeholder="Ton quartier" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} /></label><label>Activité (facultatif)<select value={activity} onChange={(e) => setActivity(e.target.value)}><option value="">Choisir</option>{activities.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      {error && <p className="form-error">{error}</p>}<button className="button button-primary full-width" disabled={busy || !caption.trim() || !file || (!isAdmin&&usedToday>=dailyLimit)}>{busy ? "Publication…" : "Publier"}</button>
    </form>
  </>;
}

function Connections() {
  const [tab, setTab] = useState("Touche-moi reçus");
  const [items, setItems] = useState<Array<{id:string;from_user:string;status:string;profiles?:{display_name:string;avatar_url:string|null}}>>([]);
  const [connections,setConnections] = useState<Array<{id:string;user_one:string;user_two:string;profile_one?:{display_name:string;avatar_url:string|null}|null;profile_two?:{display_name:string;avatar_url:string|null}|null;created_at:string}>>([]);
  const { user } = useAuth();
  const [error,setError] = useState("");
  useEffect(() => { if (!supabase || !user || tab !== "Touche-moi reçus") { setItems([]); return; } void supabase.from("tuch_me_requests").select("id, from_user, status, profiles:profiles!tuch_me_requests_from_user_fkey(display_name,avatar_url)").eq("to_user", user.id).eq("status", "pending").order("created_at", {ascending:false}).then(({data}) => setItems((data ?? []) as unknown as typeof items)); }, [tab, user]);
  useEffect(() => { if (!supabase || !user || tab === "Touche-moi reçus") { setConnections([]); return; } void supabase.from("connections").select("id,user_one,user_two,created_at,profile_one:profiles!connections_user_one_fkey(display_name,avatar_url),profile_two:profiles!connections_user_two_fkey(display_name,avatar_url)").or(`user_one.eq.${user.id},user_two.eq.${user.id}`).order("created_at",{ascending:false}).then(({data})=>setConnections((data??[]) as unknown as typeof connections)); },[tab,user]);
  async function answer(id: string, status: "accepted" | "declined") {
    if (!supabase || !user) return; setError("");
    const item=items.find((request)=>request.id===id); if(!item)return;
    const {error:updateError}=await supabase.from("tuch_me_requests").update({status,responded_at:new Date().toISOString()}).eq("id",id);
    if(updateError){setError(updateError.message);return;}
    if(status==="accepted"){
      const [user_one,user_two]=[user.id,item.from_user].sort();
      const {error:connectionError}=await supabase.from("connections").insert({user_one,user_two});
      if(connectionError&&connectionError.code!=="23505"){setError(connectionError.message);return;}
    }
    setItems((current)=>current.filter((request)=>request.id!==id));
  }
  const tabs = ["Touche-moi reçus", "Discussions", "Rencontres"];
  return <><ScreenTitle title="Mes connexions" subtitle="Deux profils. Une connexion." /><div className="segmented-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    {error&&<p className="form-error">{error}</p>}
    {tab === "Touche-moi reçus" ? items.length ? <div className="request-list">{items.map((item) => <article className="request-card" key={item.id}><Avatar profile={item.profiles} /><div className="request-copy"><strong>{item.profiles?.display_name ?? "Un profil"}</strong><small>souhaite faire connaissance</small></div><button className="button button-primary" onClick={() => void answer(item.id,"accepted")}>SIA</button><button className="button button-quiet" onClick={() => void answer(item.id,"declined")}>Décharge</button></article>)}</div> : <EmptyState icon={Users} title="Aucune demande en attente" detail="Les nouveaux TUCH ME reçus apparaîtront ici." />
    : connections.length ? <div className="request-list">{connections.map((connection)=>{const other=connection.user_one===user?.id?connection.profile_two:connection.profile_one;return <Link to={`/connections/${connection.id}`} className="request-card" key={connection.id}><Avatar profile={other}/><div className="request-copy"><strong>{other?.display_name??"Profil connecté"}</strong><small>{tab==="Discussions"?"Ouvrir la discussion":"Connecté(e) · prêt(e) à se rencontrer"}</small></div><MessageCircle size={18}/></Link>})}</div> : <EmptyState icon={Users} title={tab === "Discussions" ? "Pas encore de connexion" : "Aucune rencontre pour l’instant"} detail="Accepte un TUCH ME pour créer une connexion." />}
  </>;
}

function Conversation(){
  const {id}=useParams();
  const {user}=useAuth();
  type ChatMessage={id:string;body:string;photo_url:string|null;sender_id:string;created_at:string;read_at:string|null};
  type ChatConnection={id:string;user_one:string;user_two:string;profile_one:Profile|null;profile_two:Profile|null};
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [connection,setConnection]=useState<ChatConnection|null>(null);
  const [connectionLoading,setConnectionLoading]=useState(true);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [sendingPhoto,setSendingPhoto]=useState(false);
  const endRef=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(!supabase||!user||!id)return;
    let alive=true;
    setConnectionLoading(true);setConnection(null);setMessages([]);setError("");
    const messageFields="id,body,photo_url,sender_id,created_at,read_at";
    async function loadMessages(){
      if(!supabase||!id)return;
      const {data,error:loadError}=await supabase.from("messages").select(messageFields).eq("connection_id",id).gte("created_at",new Date(Date.now()-7*86400000).toISOString()).order("created_at",{ascending:true}).limit(500);
      if(!alive)return;
      if(loadError)setError(loadError.message);else setMessages((data??[]) as ChatMessage[]);
    }
    async function loadConnection(){
      if(!supabase||!id||!user)return;
      const {data,error:connectionError}=await supabase.from("connections").select("id,user_one,user_two,profile_one:profiles!connections_user_one_fkey(*),profile_two:profiles!connections_user_two_fkey(*)").eq("id",id).maybeSingle();
      if(!alive)return;
      setConnectionLoading(false);
      if(connectionError)setError(connectionError.message);
      else if(!data||(data.user_one!==user.id&&data.user_two!==user.id))setConnection(null);
      else setConnection(data as unknown as ChatConnection);
    }
    void Promise.all([loadConnection(),loadMessages()]);
    const channel=supabase.channel(`chat:${id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"messages",filter:`connection_id=eq.${id}`},(payload)=>{
        if(payload.eventType==="INSERT"){
          const incoming=payload.new as ChatMessage;
          setMessages(current=>current.some(message=>message.id===incoming.id)?current:[...current,incoming].sort((a,b)=>a.created_at.localeCompare(b.created_at)));
        }else if(payload.eventType==="UPDATE"){
          const updated=payload.new as ChatMessage;
          setMessages(current=>current.map(message=>message.id===updated.id?{...message,...updated}:message));
        }
      }).subscribe();
    return ()=>{alive=false;void supabase?.removeChannel(channel);};
  },[id,user]);

  useEffect(()=>{
    if(!supabase||!user||!id)return;
    const unread=messages.filter(message=>message.sender_id!==user.id&&!message.read_at);
    if(!unread.length)return;
    const readAt=new Date().toISOString();
    const ids=unread.map(message=>message.id);
    setMessages(current=>current.map(message=>ids.includes(message.id)?{...message,read_at:readAt}:message));
    void supabase.from("messages").update({read_at:readAt}).in("id",ids).eq("connection_id",id).then(({error:readError})=>{
      if(readError)setError(readError.message);
    });
  },[messages,id,user]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages.length]);

  async function send(event:React.FormEvent){
    event.preventDefault();
    if(!supabase||!user||!id||!body.trim()||!connection)return;
    setBusy(true);setError("");
    const {error:sendError}=await supabase.from("messages").insert({connection_id:id,sender_id:user.id,body:body.trim()});
    if(sendError)setError(sendError.message);else setBody("");
    setBusy(false);
  }

  async function sendPhoto(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    if(!file||!supabase||!user||!id||!connection)return;
    if(!file.type.startsWith("image/")){setError("Choisis un fichier image.");event.target.value="";return;}
    if(file.size>10*1024*1024){setError("La photo doit faire 10 Mo maximum.");event.target.value="";return;}
    const today=new Date().toISOString().slice(0,10);
    const todayPhotos=messages.filter(message=>message.sender_id===user.id&&message.photo_url&&message.created_at.slice(0,10)===today).length;
    if(todayPhotos>=10){setError("Limite de 10 photos par jour atteinte.");event.target.value="";return;}
    setSendingPhoto(true);setError("");
    try{
      const path=`${user.id}/chats/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const {error:uploadError}=await supabase.storage.from("public-media").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
      if(uploadError)throw uploadError;
      const photoUrl=supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
      const {error:insertError}=await supabase.from("messages").insert({connection_id:id,sender_id:user.id,body:"",photo_url:photoUrl});
      if(insertError)throw insertError;
    }catch(cause){setError(cause instanceof Error?cause.message:"Échec de l’envoi de la photo.");}
    finally{setSendingPhoto(false);if(fileRef.current)fileRef.current.value="";}
  }

  if(connectionLoading)return <><div className="page-topline"><Link className="icon-button" to="/connections"><ArrowLeft size={18}/></Link><ScreenTitle title="Discussion"/></div><div className="loading-card">Ouverture de la conversation…</div></>;
  if(!connection)return <><div className="page-topline"><Link className="icon-button" to="/connections"><ArrowLeft size={18}/></Link><ScreenTitle title="Discussion"/></div><EmptyState icon={Shield} title="Conversation introuvable" detail="Seules les connexions validées par TUCH ME peuvent discuter."/></>;
  const other=connection.user_one===user?.id?connection.profile_two:connection.profile_one;
  return <>
    <div className="page-topline"><Link className="icon-button" to="/connections"><ArrowLeft size={18}/></Link><Avatar profile={other} size="sm"/><Link to={other?.id?`/profile/${other.id}`:"/connections"} className="chat-recipient">{displayName(other)}</Link></div>
    {error&&<p className="form-error">{error}</p>}
    <div className="message-list">{messages.length?messages.map(message=><article className={`message-bubble ${message.sender_id===user?.id?"mine":"theirs"}`} key={message.id}>{message.photo_url?<a href={message.photo_url} target="_blank" rel="noreferrer"><img className="message-photo" src={message.photo_url} alt="Photo envoyée dans la conversation"/></a>:<p>{message.body}</p>}<small>{new Date(message.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}{message.sender_id===user?.id&&message.read_at?" · Lu":""}</small></article>):<EmptyState icon={MessageCircle} title="La conversation commence ici" detail="Seuls les profils connectés peuvent échanger."/>}<div ref={endRef}/></div>
    <form className="message-form" onSubmit={(event)=>void send(event)}><input value={body} onChange={event=>setBody(event.target.value)} placeholder="Écris un message…"/><button type="button" className="icon-button photo-send" onClick={()=>fileRef.current?.click()} disabled={sendingPhoto} aria-label="Envoyer une photo">{sendingPhoto?<span className="photo-spinner">…</span>:<ImageIcon size={18}/>}</button><input ref={fileRef} className="chat-file-input" type="file" accept="image/*" onChange={event=>void sendPhoto(event)}/><button className="button button-primary" disabled={busy||!body.trim()}>{busy?"Envoi…":"Envoyer"}</button></form>
  </>;
}

function PublicProfile() {
  const {id}=useParams();const {user,isAdmin}=useAuth();const [profile,setProfile]=useState<Profile|null>(null);const [posts,setPosts]=useState<Post[]>([]);const [message,setMessage]=useState("");const [appealOpen,setAppealOpen]=useState(false);const [appealText,setAppealText]=useState("");const [appealStatus,setAppealStatus]=useState("");
  useEffect(()=>{if(!supabase||!id)return;void supabase.from("profiles").select("*").eq("id",id).maybeSingle().then(({data})=>setProfile(data as Profile|null));void supabase.from("posts").select("*").eq("author_id",id).eq("status","active").order("created_at",{ascending:false}).then(({data})=>setPosts((data??[]) as Post[]));if(user?.id===id)void supabase.from("appeals").select("status").eq("user_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle().then(({data})=>setAppealStatus(data?.status??""));},[id,user?.id]);
  async function sendTuch(){if(!supabase||!user||!id)return;const {error}=await supabase.from("tuch_me_requests").insert({from_user:user.id,to_user:id});setMessage(error?error.message:"TUCH ME envoyé.");}
  async function report(){if(!supabase||!user||!id)return;const reason=window.prompt("Pourquoi souhaites-tu signaler ce profil ?");if(!reason?.trim())return;const {error}=await supabase.from("reports").insert({reporter_id:user.id,reported_user_id:id,reason:reason.trim()});setMessage(error?error.message:"Signalement envoyé à l’équipe.");}
  async function block(){if(!supabase||!user||!id||!window.confirm("Bloquer ce profil ?"))return;const {error}=await supabase.from("blocked_users").insert({user_id:user.id,blocked_user_id:id});setMessage(error?error.message:"Profil bloqué.");}
  async function submitAppeal(){if(!supabase||!user||!profile||appealText.trim().length<20){setMessage("Explique ta contestation en au moins 20 caractères.");return;}const {error}=await supabase.from("appeals").insert({user_id:user.id,statement:appealText.trim()});if(error)setMessage(error.message);else{setAppealStatus("pending");setAppealOpen(false);setMessage("Ta contestation a été transmise à l’équipe.");setAppealText("");}}
  if(!profile)return <EmptyState title="Profil introuvable" detail="Ce profil n’est pas disponible."/>;
  const facts:[[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined],[string,string|undefined]]=[["Bio",profile.bio??undefined],["Profession",profile.profession??undefined],["Niveau d’études",profile.education_level??undefined],["Situation familiale",profile.family_status??undefined],["Enfant(s)",profile.children_status==="Oui"?`Oui · ${profile.children_count??0}`:profile.children_status??undefined],["Statut fumeur",profile.smoker_status??undefined],["Consommation d’alcool",profile.alcohol_status??undefined],["Valeurs",profile.values?.join(" · ")],["Centres d’intérêt",profile.interests?.join(" · ")]];
  return <><div className="public-profile"><div className="profile-cover"/><div className="profile-header-actions"><Link className="icon-button" to="/search" aria-label="Retour"><ArrowLeft size={19}/></Link><div><button className="icon-button" onClick={()=>void report()} aria-label="Signaler"><Flag size={18}/></button><button className="icon-button" onClick={()=>void block()} aria-label="Bloquer"><Shield size={18}/></button></div></div><div className="public-avatar-wrap"><Avatar profile={profile} size="lg"/>{profile.verified_at&&<BadgeCheck className="verified-avatar-dot" size={18}/>}</div><h1>{displayName(profile)}{profile.emojis?.join("")} {profile.age}{profile.verified_at&&<BadgeCheck className="inline-badge" size={17}/>}</h1><p className="muted"><MapPin size={15}/> {profile.neighborhood}{profile.city?`, ${profile.city}`:""}</p>{profile.verified_at&&<span className="verified"><BadgeCheck size={15}/> Profil vérifié</span>}{profile.is_restricted&&<span className="restriction-badge">Restreint</span>}{facts.map(([label,value])=>value&&<div className="profile-section" key={label}><h3>{label}</h3><p>{value}</p></div>)}<p className="privacy-note"><MapPin size={15}/> Ville et quartier approximatifs — aucune position précise.</p>{user?.id!==profile.id&&<button className="button button-primary full-width" disabled={!profile.verified_at} title={!profile.verified_at?"La vérification est requise":""} onClick={()=>void sendTuch()}>TUCH ME</button>}{profile.is_restricted&&user?.id===profile.id&&<button className="button button-quiet full-width" disabled={appealStatus==="pending"} onClick={()=>setAppealOpen(true)}>{appealStatus==="pending"?"Contestation en cours":"Contester la restriction"}</button>}{message&&<p className="form-success">{message}</p>}{isAdmin&&<Link className="button button-quiet full-width" to="/admin">Ouvrir l’administration</Link>}</div><section className="section-block"><h2>Publications</h2>{posts.length?posts.map(post=><PostCard key={post.id} post={post}/>):<p className="muted">Aucune publication.</p>}</section>{appealOpen&&<Modal title="Contester la restriction" onClose={()=>setAppealOpen(false)}><p className="muted">Explique la situation. L’équipe vérifiera ta contestation depuis le panneau d’administration.</p><textarea rows={5} maxLength={3000} value={appealText} onChange={event=>setAppealText(event.target.value)} placeholder="Décris les faits et la raison de ta contestation…"/><button className="button button-primary full-width" onClick={()=>void submitAppeal()}>Envoyer la contestation</button></Modal>}</>;
}

function OwnProfile() {
  const {profile,user,isAdmin}=useAuth();const [posts,setPosts]=useState<Post[]>([]);const [reviewCount,setReviewCount]=useState(0);const [modal,setModal]=useState<"gains"|"ads"|null>(null);
  useEffect(()=>{if(!supabase||!user)return;void supabase.from("posts").select("*").eq("author_id",user.id).neq("status","removed").order("created_at",{ascending:false}).then(({data})=>setPosts((data??[]) as Post[]));void supabase.from("reviews").select("id",{count:"exact",head:true}).eq("reviewed_user_id",user.id).then(({count})=>setReviewCount(count??0));},[user]);
  return <><div className="own-profile"><div className="profile-cover"/><div className="own-avatar-wrap"><Avatar profile={profile} size="lg"/>{profile?.verified_at&&<span className="verified-avatar-dot"/>}</div><div className="own-profile-header"><div><h1>{isAdmin?"You&Me by Unshcorp":`${displayName(profile)}${profile?.age?`, ${profile.age}`:""}`}{profile?.verified_at&&<BadgeCheck className="inline-badge" size={18}/>}</h1>{isAdmin?<span className="verified">Admin</span>:profile?.verified_at&&<span className="verified"><BadgeCheck size={14}/> Profil vérifié</span>}</div><div className="profile-shortcuts">{isAdmin&&<Link aria-label="Administration" to="/admin"><ShieldCheck size={19}/></Link>}<Link aria-label="Sécurité" to="/safety"><Shield size={19}/></Link><Link aria-label="Paramètres" to="/settings"><SettingsIcon size={19}/></Link></div></div>
    {!isAdmin&&<><p className="muted profile-location"><MapPin size={14}/> {profile?.neighborhood}{profile?.city?`, ${profile.city}`:""}</p><div className="profile-facts">{[["Bio",profile?.bio],["Profession",profile?.profession],["Niveau d’études",profile?.education_level],["Situation familiale",profile?.family_status],["Enfant(s)",profile?.children_status==="Oui"?`Oui · ${profile.children_count??0}`:profile?.children_status],["Statut fumeur",profile?.smoker_status],["Consommation d’alcool",profile?.alcohol_status],["Valeurs",profile?.values?.join(" · ")],["Centres d’intérêt",profile?.interests?.join(" · ")]].filter(([,value])=>Boolean(value)).map(([label,value])=><div className="profile-fact" key={String(label)}><strong>{label}</strong><span>{value}</span></div>)}</div></>}
    <div className="review-strip"><Star size={17} fill="currentColor"/> {reviewCount} avis</div><div className="points-row"><span>✦ 0 points</span><button className="button button-primary" onClick={()=>setModal("gains")}><Gift size={16}/> Gains</button>{!isAdmin&&<button className="button button-quiet" onClick={()=>setModal("ads")}><Flag size={16}/> Ma pub</button>}</div><div className="profile-section"><h2>{posts.length} publications</h2><div className="post-grid">{posts.map(post=><Link key={post.id} to={`/post/${post.id}`} className="post-thumb">{post.image_url?<img src={post.image_url} alt=""/>:<div className="thumb-placeholder"><Heart size={24}/></div>}{post.status==="archived"&&<small>Archivée</small>}</Link>)}</div></div></div>
    {modal==="gains"&&<GainsModal onClose={()=>setModal(null)}/>}{modal==="ads"&&<AdModal onClose={()=>setModal(null)}/>}
  </>;
}

function GainsModal({onClose}:{onClose:()=>void}) {
  const items=[{title:"1 publication supplémentaire / jour",cost:5},{title:"+1 envoi de photo / jour",cost:3},{title:"1 TUCH ME supplémentaire / jour",cost:9}];
  const {user}=useAuth();const [balance,setBalance]=useState(0);const [referral,setReferral]=useState("");const [message,setMessage]=useState("");
  useEffect(()=>{if(!supabase||!user)return;void supabase.from("point_transactions").select("amount").eq("user_id",user.id).then(({data})=>setBalance((data??[]).reduce((sum,row)=>sum+Number(row.amount),0)));void supabase.from("referrals").select("code").eq("user_id",user.id).maybeSingle().then(({data})=>setReferral(data?.code??""));},[user]);
  async function createReferral(){if(!supabase||!user)return;const code=crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase();const {error}=await supabase.from("referrals").insert({user_id:user.id,code});if(error)setMessage(error.message);else{setReferral(code);setMessage("Code de parrainage créé.");}}
  async function redeem(cost:number,title:string){if(!supabase||!user)return;const {data,error}=await supabase.rpc("redeem_reward",{reward_cost:cost,reward_name:title});setMessage(error?.message??(data?"Avantage débloqué pour aujourd’hui.":"Solde insuffisant."));if(!error&&data)setBalance(value=>value-cost);}
  return <Modal title="Boutique d’avantages" onClose={onClose}><p className="muted">Gagne des points en invitant des amis et utilise-les pour débloquer des avantages.</p><div className="point-balance"><Gift size={20}/> <strong>{balance}</strong> points</div><p className="referral-line">{referral?<>Ton code : <strong>{referral}</strong> <button className="inline-link" onClick={()=>void navigator.clipboard?.writeText(referral)}>Copier</button></>:<button className="button button-quiet" onClick={()=>void createReferral()}>Créer mon code de parrainage</button>} · +10 points par inscription validée</p><div className="reward-list">{items.map((item)=><article className="reward-card" key={item.title}><div><strong>{item.title}</strong><small>{item.cost} points</small></div><button className="button button-quiet" disabled={balance<item.cost} onClick={()=>void redeem(item.cost,item.title)}>Débloquer</button></article>)}</div>{message&&<p className="form-success">{message}</p>}</Modal>;
}

function AdModal({onClose}:{onClose:()=>void}) {
  const {user}=useAuth();const [payment,setPayment]=useState("airtel_money");const [description,setDescription]=useState("");const [contact,setContact]=useState("");const [link,setLink]=useState("");const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function submit(){if(!supabase||!user||!file||!description.trim()){setMessage("Ajoute une image et une description pour continuer.");return;}setBusy(true);setMessage("");try{const path=`${user.id}/ads/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const {error:uploadError}=await supabase.storage.from("public-media").upload(path,file);if(uploadError)throw uploadError;const imageUrl=supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;const {data:ad,error}=await supabase.from("ad_submissions").insert({user_id:user.id,description:description.trim(),contact:contact.trim()||null,destination_url:link.trim()||null,image_url:imageUrl,payment_method:payment,payment_status:"pending"}).select("id").single();if(error)throw error;if(payment==="airtel_money"){const {data,error:paymentError}=await supabase.functions.invoke("nafa-create-payment",{body:{ad_submission_id:ad.id}});if(paymentError)throw paymentError;if(!data?.checkout_url)throw new Error(data?.error||"NAFA n’a pas retourné de lien de paiement.");window.location.assign(data.checkout_url);return;}setMessage("Demande enregistrée.");}catch(error){setMessage(error instanceof Error?error.message:"Impossible d’envoyer la demande.");}finally{setBusy(false);}}
  return <Modal title="Soumettre ma publicité" onClose={onClose}><p className="muted">La demande est examinée par l’admin après confirmation du paiement. Le montant dépend du tarif NAFA configuré.</p><div className="payment-options"><button className={payment==="points"?"selected":""} disabled>17 points (bientôt disponible)</button><button className={payment==="airtel_money"?"selected":""} onClick={()=>setPayment("airtel_money")}>Payer par Airtel Money via NAFA</button></div><label className="upload-field">Image publicitaire (recommandé : portrait)<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/><span className="upload-tile">{file?file.name:<><Plus size={20}/> Ajouter une photo</>}</span></label><label>Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Contact à joindre<input value={contact} onChange={e=>setContact(e.target.value)}/></label><label>Lien de destination (facultatif)<input type="url" value={link} onChange={e=>setLink(e.target.value)}/></label><p className="muted tiny">Le retour NAFA ne suffit pas : la demande reste en attente jusqu’à confirmation serveur signée.</p>{message&&<p className="form-error">{message}</p>}<button className="button button-primary full-width" disabled={busy||payment==="points"} onClick={()=>void submit()}>{busy?"Création du paiement…":"Continuer vers le paiement"}</button></Modal>;
}

function Settings() {
  const {profile,refreshProfile,user}=useAuth();
  const [tab,setTab]=useState("Profil");const [busy,setBusy]=useState(false);const [saved,setSaved]=useState("");const [error,setError]=useState("");const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [firstName,setFirstName]=useState(profile?.first_name??"");const [lastName,setLastName]=useState(profile?.last_name??"");const [display,setDisplay]=useState(profile?.display_name??"");const [bio,setBio]=useState(profile?.bio??"");const [profession,setProfession]=useState(profile?.profession??"");const [education,setEducation]=useState(profile?.education_level??"");const [family,setFamily]=useState(profile?.family_status??"");const [children,setChildren]=useState(profile?.children_status??"");const [childCount,setChildCount]=useState(String(profile?.children_count??""));const [smoker,setSmoker]=useState(profile?.smoker_status??"");const [alcohol,setAlcohol]=useState(profile?.alcohol_status??"");const [city,setCity]=useState(profile?.city??"");const [neighborhood,setNeighborhood]=useState(profile?.neighborhood??"");const [language,setLanguage]=useState(profile?.languages?.join(", ")??"");const [selected,setSelected]=useState<string[]>(profile?.interests??[]);const [values,setValues]=useState<string[]>(profile?.values??[]);
  useEffect(()=>{setFirstName(profile?.first_name??"");setLastName(profile?.last_name??"");setDisplay(profile?.display_name??"");setBio(profile?.bio??"");setProfession(profile?.profession??"");setEducation(profile?.education_level??"");setFamily(profile?.family_status??"");setChildren(profile?.children_status??"");setChildCount(String(profile?.children_count??""));setSmoker(profile?.smoker_status??"");setAlcohol(profile?.alcohol_status??"");setCity(profile?.city??"");setNeighborhood(profile?.neighborhood??"");setLanguage(profile?.languages?.join(", ")??"");setSelected(profile?.interests??[]);setValues(profile?.values??[]);},[profile]);
  async function saveProfile(event:React.FormEvent){
    event.preventDefault();if(!supabase||!user)return;setSaved("");setError("");
    if(!profession.trim()||values.length!==3||selected.length!==7){setError("Indique une profession, trois valeurs et sept centres d’intérêt.");return;}
    if(children==="Oui"&&(!Number(childCount)||Number(childCount)>30)){setError("Indique le nombre d’enfants.");return;}
    setBusy(true);
    try{
      let avatarUrl=profile?.avatar_url??null;
      if(avatarFile){const path=`${user.id}/avatar-${crypto.randomUUID()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const {error:uploadError}=await supabase.storage.from("public-media").upload(path,avatarFile,{upsert:false,contentType:avatarFile.type});if(uploadError)throw uploadError;avatarUrl=supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;}
      const {error:saveError}=await supabase.from("profiles").update({first_name:firstName.trim(),last_name:lastName.trim(),display_name:display.trim(),bio:bio.trim(),profession:profession.trim(),education_level:education,family_status:family,children_status:children,children_count:children==="Oui"?Number(childCount):0,smoker_status:smoker,alcohol_status:alcohol,city:city.trim(),neighborhood:neighborhood.trim(),languages:language.split(",").map(v=>v.trim()).filter(Boolean),interests:selected,values,avatar_url:avatarUrl}).eq("id",user.id);
      if(saveError)throw saveError;await refreshProfile();setAvatarFile(null);setSaved("Modifications enregistrées.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Impossible d’enregistrer le profil.");}finally{setBusy(false);}
  }
  function toggleLimited(list:string[],set:(value:string[])=>void,value:string,limit:number){set(list.includes(value)?list.filter(item=>item!==value):list.length<limit?[...list,value]:list);}
  return <><div className="page-topline"><Link className="icon-button" to="/profile"><ArrowLeft size={18}/></Link><ScreenTitle title="Paramètres"/></div><div className="segmented-tabs">{["Profil","Préférences","Compte"].map(item=><button className={tab===item?"selected":""} key={item} onClick={()=>setTab(item)}>{item}</button>)}</div>
    {tab==="Profil"&&<form className="panel form-stack settings-form" onSubmit={e=>void saveProfile(e)}><p className="muted">E-mail (non modifiable)<br/><strong>{user?.email}</strong></p><label className="upload-field">Photo de profil<input type="file" accept="image/*" onChange={e=>setAvatarFile(e.target.files?.[0]??null)}/><span className="upload-tile">{avatarFile?.name??"Choisir une nouvelle photo"}</span></label><div className="two-columns"><label>Prénom<input value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label>Nom<input value={lastName} onChange={e=>setLastName(e.target.value)}/></label></div><label>Nom affiché<input value={display} onChange={e=>setDisplay(e.target.value)}/></label><label>Bio<textarea rows={3} maxLength={300} value={bio} onChange={e=>setBio(e.target.value)}/></label><label>Profession<input value={profession} onChange={e=>setProfession(e.target.value)} required/></label>
      <div className="two-columns"><label>Niveau d’études<select value={education} onChange={e=>setEducation(e.target.value)} required><option value="">Choisir</option><option>Collège</option><option>Lycée</option><option>Université</option><option>Travailleur</option></select></label><label>Situation familiale<select value={family} onChange={e=>setFamily(e.target.value)} required><option value="">Choisir</option><option>Célibataire</option><option>En relation libre</option><option>Autre</option></select></label></div>
      <div className="two-columns"><label>Enfant(s)<select value={children} onChange={e=>setChildren(e.target.value)} required><option value="">Choisir</option><option>Non</option><option>Oui</option></select></label>{children==="Oui"&&<label>Nombre d’enfants<input type="number" min="1" max="30" value={childCount} onChange={e=>setChildCount(e.target.value)} required/></label>}</div><div className="two-columns"><label>Statut fumeur<select value={smoker} onChange={e=>setSmoker(e.target.value)} required><option value="">Choisir</option><option>Non</option><option>Oui</option></select></label><label>Consommation d’alcool<select value={alcohol} onChange={e=>setAlcohol(e.target.value)} required><option value="">Choisir</option><option>Jamais</option><option>Occasionnellement</option><option>Souvent</option></select></label></div>
      <div><span className="field-label">Tes 3 valeurs personnelles</span><ChipPicker values={personalValues} selected={values} onToggle={v=>toggleLimited(values,setValues,v,3)}/></div><label>Langues parlées (séparées par une virgule)<input value={language} onChange={e=>setLanguage(e.target.value)}/></label><div className="two-columns"><label>Ville<input value={city} onChange={e=>setCity(e.target.value)}/></label><label>Quartier<input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)}/></label></div><div><span className="field-label">Tes 7 centres d’intérêt principaux</span><ChipPicker values={interests} selected={selected} onToggle={v=>toggleLimited(selected,setSelected,v,7)}/></div>
      {saved&&<p className="form-success">{saved}</p>}{error&&<p className="form-error">{error}</p>}<button className="button button-primary full-width" disabled={busy}>{busy?"Enregistrement…":"Enregistrer"}</button></form>}
    {tab==="Préférences"&&<Preferences/>}{tab==="Compte"&&<AccountSettings/>}
  </>;
}

function Preferences(){
  const {user}=useAuth();const [selected,setSelected]=useState<string[]>([]);const [selectedActivities,setSelectedActivities]=useState<string[]>([]);const [minAge,setMinAge]=useState(18);const [maxAge,setMaxAge]=useState(60);const [gender,setGender]=useState("Tout le monde");const [distance,setDistance]=useState(25);const [city,setCity]=useState("");const [neighborhoods,setNeighborhoods]=useState("");const [venues,setVenues]=useState("");const [verifiedOnly,setVerifiedOnly]=useState(false);const [activeOnly,setActiveOnly]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{if(!supabase||!user)return;void supabase.from("profile_preferences").select("*").eq("user_id",user.id).maybeSingle().then(({data})=>{if(!data)return;setSelected(data.relationship_types??[]);setSelectedActivities(data.activities??[]);setMinAge(data.min_age??18);setMaxAge(data.max_age??60);setGender(data.preferred_gender??"Tout le monde");setDistance(data.max_distance_km??25);setCity(data.city??"");setNeighborhoods((data.neighborhoods??[]).join(", "));setVenues(data.venues??"");setVerifiedOnly(Boolean(data.verified_only));setActiveOnly(Boolean(data.active_only));});},[user]);
  function toggle(list:string[],set:(value:string[])=>void,value:string){set(list.includes(value)?list.filter(item=>item!==value):[...list,value]);}
  async function save(){if(!supabase||!user)return;setBusy(true);setMessage("");const {error}=await supabase.from("profile_preferences").upsert({user_id:user.id,relationship_types:selected,min_age:minAge,max_age:maxAge,preferred_gender:gender,max_distance_km:distance,city:city.trim()||null,neighborhoods:neighborhoods.split(",").map(v=>v.trim()).filter(Boolean),activities:selectedActivities,venues:venues.trim()||null,verified_only:verifiedOnly,active_only:activeOnly,updated_at:new Date().toISOString()});setMessage(error?error.message:"Préférences enregistrées.");setBusy(false);}
  return <section className="panel form-stack settings-form"><div><span className="field-label">Type de relation recherché</span><ChipPicker values={relationshipTypes} selected={selected} onToggle={(v)=>toggle(selected,setSelected,v)}/></div><label>Tranche d’âge : {minAge} – {maxAge} ans<input type="range" min="18" max="80" value={minAge} onChange={(e)=>setMinAge(Math.min(Number(e.target.value),maxAge))}/><input type="range" min="18" max="80" value={maxAge} onChange={(e)=>setMaxAge(Math.max(minAge,Number(e.target.value)))}/></label><label>Je souhaite rencontrer<select value={gender} onChange={(e)=>setGender(e.target.value)}><option>Tout le monde</option><option>Femme</option><option>Homme</option><option>Non binaire</option><option>Autre</option></select></label><label>Distance maximale : {distance} km<input type="range" min="1" max="100" value={distance} onChange={(e)=>setDistance(Number(e.target.value))}/></label><label>Ville recherchée<input value={city} onChange={(e)=>setCity(e.target.value)}/></label><label>Quartiers recherchés<input value={neighborhoods} onChange={(e)=>setNeighborhoods(e.target.value)} placeholder="Séparés par une virgule"/></label><div><span className="field-label">Activités préférées</span><ChipPicker values={activities} selected={selectedActivities} onToggle={(v)=>toggle(selectedActivities,setSelectedActivities,v)}/></div><label>Lieux de rencontre préférés<input value={venues} onChange={(e)=>setVenues(e.target.value)} placeholder="Café, musique…"/></label><label className="check-row"><input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)}/> Profils vérifiés uniquement</label><label className="check-row"><input type="checkbox" checked={activeOnly} onChange={e=>setActiveOnly(e.target.checked)}/> Actifs cette semaine</label>{message&&<p className={message.includes("enregistrées")?"form-success":"form-error"}>{message}</p>}<button className="button button-primary full-width" disabled={busy} onClick={()=>void save()}>{busy?"Enregistrement…":"Enregistrer les préférences"}</button></section>
}

function AccountSettings(){
  const {signOut,profile,user,refreshProfile}=useAuth();const [showFirst,setShowFirst]=useState(true);const [verifyStatus,setVerifyStatus]=useState("");const [verificationOpen,setVerificationOpen]=useState(false);const [documentType,setDocumentType]=useState("");const [frontFile,setFrontFile]=useState<File|null>(null);const [backFile,setBackFile]=useState<File|null>(null);const [selfieFile,setSelfieFile]=useState<File|null>(null);const [verificationBusy,setVerificationBusy]=useState(false);const [deleteRequested,setDeleteRequested]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{setShowFirst(profile?.show_first_name??true);},[profile?.show_first_name]);
  useEffect(()=>{if(!supabase||!user)return;void supabase.from("profile_private").select("deletion_requested_at").eq("user_id",user.id).maybeSingle().then(({data})=>setDeleteRequested(Boolean(data?.deletion_requested_at)));void supabase.from("profile_verifications").select("id,status").eq("user_id",user.id).maybeSingle().then(({data})=>setVerifyStatus(data?.status??""));},[user]);
  async function togglePrivacy(value:boolean){setShowFirst(value);if(!supabase||!user)return;const {error}=await supabase.from("profiles").update({show_first_name:value}).eq("id",user.id);if(!error)await refreshProfile();setMessage(error?error.message:"Préférence de confidentialité enregistrée.");}
  async function submitVerification(){
    if(!supabase||!user)return;
    if(!documentType||!frontFile||!backFile||!selfieFile){setMessage("Choisis un document et ajoute le recto, le verso et un selfie.");return;}
    const files=[frontFile,backFile,selfieFile];
    if(files.some(file=>!file.type.startsWith("image/")||file.size>10*1024*1024)){setMessage("Chaque image doit être un fichier image de 10 Mo maximum.");return;}
    setVerificationBusy(true);setMessage("");const base=`${user.id}/${crypto.randomUUID()}`;const paths=[`${base}/recto-${frontFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,`${base}/verso-${backFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,`${base}/selfie-${selfieFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`];
    try{
      for(let index=0;index<files.length;index++){const {error:uploadError}=await supabase.storage.from("verification-documents").upload(paths[index],files[index],{upsert:false,contentType:files[index].type});if(uploadError)throw uploadError;}
      const values={document_type:documentType,front_path:paths[0],back_path:paths[1],selfie_path:paths[2],status:"pending"};
      const result=verifyStatus==="rejected"
        ? await supabase.from("profile_verifications").update(values).eq("user_id",user.id).eq("status","rejected")
        : await supabase.from("profile_verifications").insert({...values,user_id:user.id});
      if(result.error)throw result.error;
      setVerifyStatus("pending");setVerificationOpen(false);setMessage("Demande de vérification envoyée à l’équipe.");setFrontFile(null);setBackFile(null);setSelfieFile(null);
    }catch(cause){await supabase.storage.from("verification-documents").remove(paths);setMessage(cause instanceof Error?cause.message:"Impossible d’envoyer les documents.");}
    finally{setVerificationBusy(false);}
  }
  async function deactivate(){if(!supabase||!user||!window.confirm("Désactiver ton compte ? Ton profil sera masqué jusqu’à sa réactivation."))return;const {error}=await supabase.from("profiles").update({is_deactivated:true}).eq("id",user.id);if(error)setMessage(error.message);else await refreshProfile();}
  async function requestDeletion(){if(!supabase||!user||deleteRequested||!window.confirm("Envoyer une demande de suppression définitive à l’équipe ?"))return;const {error}=await supabase.from("profile_private").upsert({user_id:user.id,deletion_requested_at:new Date().toISOString()});setMessage(error?error.message:"Demande de suppression enregistrée pour traitement par l’équipe.");if(!error)setDeleteRequested(true);}
  return <><section className="panel form-stack settings-form"><h2>Confidentialité</h2><label className="switch-row"><span>Afficher uniquement mon prénom</span><input type="checkbox" checked={showFirst} onChange={e=>void togglePrivacy(e.target.checked)}/></label><p className="muted">Ton téléphone, ton e-mail et ta position précise ne sont jamais visibles par les autres.</p><div className="verification-box"><h3><ShieldCheck size={18}/> Vérification</h3><p>{profile?.verified_at?"Profil vérifié":verifyStatus==="pending"?"Demande en cours de vérification":verifyStatus==="rejected"?"Des pièces complémentaires sont demandées par l’équipe.":"Transmets les pièces demandées : elles seront conservées dans un espace privé."}</p><button className="button button-quiet" disabled={Boolean(profile?.verified_at)||verifyStatus==="pending"} onClick={()=>setVerificationOpen(true)}>{verifyStatus==="pending"?"Demande envoyée":verifyStatus==="rejected"?"Transmettre de nouvelles pièces":"Demander la vérification"}</button></div>{message&&<p className={message.includes("enregistrée")||message.includes("envoyée")||message.includes("réactivé")?"form-success":"form-error"}>{message}</p>}<button className="button button-quiet full-width" onClick={()=>void deactivate()}>Désactiver mon compte</button><button className="button button-quiet full-width danger-quiet" disabled={deleteRequested} onClick={()=>void requestDeletion()}>{deleteRequested?"Demande de suppression envoyée":"Demander la suppression du compte"}</button>{deleteRequested&&<p className="muted tiny">L’équipe finalisera la suppression définitive après vérification.</p>}<button className="button button-quiet full-width" onClick={()=>void signOut()}>Se déconnecter</button></section>
    {verificationOpen&&<Modal title="Vérification du compte" onClose={()=>setVerificationOpen(false)}><p className="muted">Ces images sont privées et accessibles uniquement à toi et aux administrateurs chargés de la vérification.</p><label>Type de document<select value={documentType} onChange={e=>setDocumentType(e.target.value)}><option value="">Choisir</option><option>Carte nationale d’identité</option><option>Passeport</option><option>Carte CNAMGS</option><option>Carte scolaire ou étudiante</option></select></label><label className="upload-field">Photo recto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFrontFile(e.target.files?.[0]??null)}/><span className="upload-tile">{frontFile?.name??"Choisir l’image du recto"}</span></label><label className="upload-field">Photo verso<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setBackFile(e.target.files?.[0]??null)}/><span className="upload-tile">{backFile?.name??"Choisir l’image du verso"}</span></label><label className="upload-field">Selfie<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setSelfieFile(e.target.files?.[0]??null)}/><span className="upload-tile">{selfieFile?.name??"Choisir un selfie"}</span></label>{message&&<p className="form-error">{message}</p>}<button className="button button-primary full-width" disabled={verificationBusy} onClick={()=>void submitVerification()}>{verificationBusy?"Envoi sécurisé…":"Envoyer ma demande"}</button></Modal>}
  </>;
}

function Safety() {
  const {user}=useAuth();const [open,setOpen]=useState<string[]>([]);const [blocked,setBlocked]=useState<Array<{blocked_user_id:string;profiles?:{display_name:string;avatar_url:string|null}|null}>>([]);const faqs=[
    ["Comment fonctionne TUCH ME ?","Tu as 10 TUCH ME gratuits par jour. La personne répond SIA (accepter, vous êtes connectés) ou DÉCHARGE (passer)."],
    ["Combien de temps reste une publication visible ?","3 jours dans le feed public, puis elle est archivée sur ton profil. Tu peux publier jusqu’à 10 fois par jour."],
    ["Qui peut m’écrire ?","Uniquement les personnes avec qui tu es connecté(e)."],
    ["Comment obtenir le badge vérifié ?","Dans Paramètres > Compte, demande la vérification de ton profil."],
    ["Résumé des CGU","Respecte les autres, n’utilise pas de faux profil et signale les comportements inappropriés. Les publications restent visibles 3 jours."],
    ["Confidentialité","Les coordonnées et la position précise ne sont jamais affichées. Les messages ne sont visibles que par les participants."],
  ];
  useEffect(()=>{if(!supabase||!user)return;void supabase.from("blocked_users").select("blocked_user_id,profiles:profiles!blocked_users_blocked_user_id_fkey(display_name,avatar_url)").eq("user_id",user.id).order("created_at",{ascending:false}).then(({data})=>setBlocked((data??[]) as unknown as typeof blocked));},[user]);
  async function unblock(id:string){if(!supabase||!user)return;const {error}=await supabase.from("blocked_users").delete().eq("user_id",user.id).eq("blocked_user_id",id);if(!error)setBlocked(current=>current.filter(item=>item.blocked_user_id!==id));}
  function toggle(title:string){setOpen((items)=>items.includes(title)?items.filter((item)=>item!==title):[...items,title]);}
  return <><div className="page-topline"><Link className="icon-button" to="/profile"><ArrowLeft size={18}/></Link><ScreenTitle title="Centre de sécurité"/></div><div className="safety-cards">{[["Premier rendez-vous en lieu public","Choisis un café, un parc animé ou un restaurant."],["Préviens une personne de confiance","Dis à un proche où tu vas et avec qui."],["Garde ton adresse pour toi","Ne partage pas ton adresse personnelle ni tes informations bancaires."],["Signale ce qui te met mal à l’aise","Faux profil, harcèlement, arnaque : un signalement suffit."]].map(([title,detail])=><article className="safety-tip" key={title}><ShieldCheck size={18}/><div><strong>{title}</strong><p>{detail}</p></div></article>)}</div><section className="section-block"><h2>Utilisateurs bloqués</h2>{blocked.length?<div className="settings-list">{blocked.map(item=><article className="settings-card" key={item.blocked_user_id}><Avatar profile={item.profiles}/><span>{item.profiles?.display_name??"Profil"}</span><button className="button button-quiet" onClick={()=>void unblock(item.blocked_user_id)}>Débloquer</button></article>)}</div>:<EmptyState icon={Shield} title="Aucun utilisateur bloqué" detail="Les profils bloqués apparaîtront ici."/>}</section><section className="section-block"><h2>Centre d’aide</h2>{faqs.map(([title,body])=><article className="accordion" key={title}><button onClick={()=>toggle(title)} aria-expanded={open.includes(title)}>{title}<ChevronDown size={17}/></button>{open.includes(title)&&<p>{body}</p>}</article>)}</section><p className="muted center">TOI&MOI by Unshcorp · Version 1.0.0</p></>;
}

function NotificationsPage(){const {user}=useAuth();const [items,setItems]=useState<Array<{id:string;title:string;created_at:string;read_at:string|null;link:string|null}>>([]);useEffect(()=>{if(!supabase||!user)return;void supabase.from("notifications").select("id,title,created_at,read_at,link").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50).then(({data})=>setItems((data??[]) as typeof items));},[user]);async function markAll(){if(!supabase||!user)return;await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null);setItems((current)=>current.map((item)=>({...item,read_at:new Date().toISOString()})));}return <><div className="page-topline"><Link className="icon-button" to="/"><ArrowLeft size={18}/></Link><ScreenTitle title="Notifications"/><button className="inline-link" onClick={()=>void markAll()}>Tout lire</button></div>{items.length?<div className="notification-list">{items.map((item)=><Link key={item.id} to={item.link||"/notifications"} className={`notification-item ${item.read_at?"read":"unread"}`}><Bell size={17}/><span><strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleDateString("fr-FR")}</small></span></Link>)}</div>:<EmptyState icon={Bell} title="Aucune notification" detail="Les réactions et connexions apparaîtront ici."/>}</>}

function Admin() {
  const {isAdmin}=useAuth(); const [tab,setTab]=useState("stats");const [stats,setStats]=useState<Record<string,number>>({});const [rows,setRows]=useState<Array<Record<string,unknown>>>([]);
  const tabs=[{id:"stats",label:"Statistiques"},{id:"reports",label:"Signalisation"},{id:"users",label:"Utilisateurs"},{id:"posts",label:"Publications"},{id:"ads",label:"Publicités"},{id:"verif",label:"Vérifications"},{id:"appeals",label:"Contestations"}];
  useEffect(()=>{if(!supabase||!isAdmin||tab!=="stats")return;void (async()=>{const since=new Date(Date.now()-7*86400000).toISOString();const today=new Date();today.setHours(0,0,0,0);const counts:Record<string,number>={};const specs:Array<[string,string,(query:any)=>any]>=[
    ["users","profiles",q=>q],["active","profiles",q=>q.is("suspended_at",null).gt("updated_at",since)],["newUsers","profiles",q=>q.gte("created_at",since)],
    ["todayPosts","posts",q=>q.gte("created_at",today.toISOString())],["requests","tuch_me_requests",q=>q],["connections","connections",q=>q],["messages","messages",q=>q],
    ["reports","reports",q=>q.eq("status","open")],["suspended","profiles",q=>q.not("suspended_at","is",null)],["verified","profile_verifications",q=>q.eq("status","approved")],
  ];for(const [key,table,filter] of specs){const {count}=await filter(supabase.from(table).select("*",{count:"exact",head:true}));counts[key]=count??0;}setStats(counts);})();},[isAdmin,tab]);
  useEffect(()=>{if(!supabase||!isAdmin||tab==="stats")return;const table=tab==="reports"?"reports":tab==="users"?"profiles":tab==="posts"?"posts":tab==="ads"?"ad_submissions":tab==="appeals"?"appeals":"profile_verifications";let query=supabase.from(table).select("*");if(tab==="reports")query=query.eq("status","open");if(tab==="ads"||tab==="verif"||tab==="appeals")query=query.eq("status","pending");void query.order("created_at",{ascending:false}).limit(100).then(({data})=>setRows((data??[]) as Array<Record<string,unknown>>));},[isAdmin,tab]);
  if(!isAdmin)return <EmptyState icon={LockKeyhole} title="Accès réservé" detail="Ce compte n’a pas le rôle administrateur."/>;
  return <div className="admin-page"><div className="admin-heading"><Link to="/profile" aria-label="Retour au profil"><ArrowLeft size={20}/></Link><h1>Administration</h1></div><div className="admin-tabs">{tabs.map(({id,label})=><button className={tab===id?"selected":""} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {tab==="stats"?<div className="stats-grid">{[["users","Utilisateurs"],["active","Actifs (7 j)"],["newUsers","Nouveaux inscrits (7 j)"],["todayPosts","Publications du jour"],["requests","TUCH ME envoyés"],["connections","Connexions créées"],["messages","Messages"],["reports","Signalements ouverts"],["suspended","Comptes suspendus"],["verified","Profils vérifiés"]].map(([key,label])=><article className="stat-card" key={key}><strong>{stats[key]??"—"}</strong><span>{label}</span></article>)}</div>:<AdminList tab={tab} rows={rows} setRows={setRows}/>}
  </div>;
}

function AdminList({tab,rows,setRows}:{tab:string;rows:Array<Record<string,unknown>>;setRows:(rows:Array<Record<string,unknown>>)=>void}) {
  const [busy,setBusy]=useState<string|null>(null);
  const [verificationImages,setVerificationImages]=useState<Record<string,string[]>>({});
  const titleField=tab==="users"?"display_name":tab==="posts"?"caption":tab==="ads"?"description":tab==="reports"?"reason":tab==="appeals"?"statement":"user_id";
  useEffect(()=>{
    if(!supabase||tab!=="verif"){setVerificationImages({});return;}
    let alive=true;
    void Promise.all(rows.map(async row=>{
      const paths=[row.front_path,row.back_path,row.selfie_path].filter((path):path is string=>typeof path==="string"&&path.length>0);
      const urls=await Promise.all(paths.map(async path=>{const {data}=await supabase!.storage.from("verification-documents").createSignedUrl(path,300);return data?.signedUrl??"";}));
      return [String(row.id),urls.filter(Boolean)] as const;
    })).then(entries=>{if(alive)setVerificationImages(Object.fromEntries(entries));});
    return()=>{alive=false;};
  },[tab,rows]);
  if(!rows.length)return <EmptyState icon={ShieldCheck} title={tab==="reports"?"Aucun signalement ouvert":tab==="ads"?"Aucune soumission en attente":tab==="verif"?"Aucune vérification en attente":tab==="appeals"?"Aucune contestation en attente":"Rien à afficher"} detail="Les éléments à traiter apparaîtront ici."/>;
  async function act(row:Record<string,unknown>,action:string){
    if(!supabase||!row.id)return;
    if(tab==="ads"&&action==="approve"&&row.payment_status!=="paid"){window.alert("Confirme d’abord la réception du paiement hors application.");return;}
    const rejectionReason=(tab==="verif"&&action==="reject")||(tab==="appeals"&&action==="rejectAppeal")?window.prompt("Motif ou réponse à transmettre :")?.trim():undefined;
    if(((tab==="verif"&&action==="reject")||(tab==="appeals"&&action==="rejectAppeal"))&&!rejectionReason)return;
    const labels:Record<string,string>={suspend:"Suspendre ce compte ?",restrict:"Restreindre ce compte ?",unsuspend:"Lever la restriction et la suspension ?",remove:"Retirer cette vérification ?",delete:"Archiver cette publication ?",feature:"Mettre cette publication à la une ?",approve:"Valider cette demande ?",reject:"Refuser cette demande ?",resolve:"Marquer ce signalement traité ?",resolveAppeal:"Accepter cette contestation ?",rejectAppeal:"Refuser cette contestation ?",markPaid:"As-tu vérifié la réception du paiement Airtel Money ?"};
    if(!window.confirm(labels[action]??"Confirmer cette action ?"))return;
    setBusy(String(row.id));const table=tab==="users"?"profiles":tab==="posts"?"posts":tab==="ads"?"ad_submissions":tab==="reports"?"reports":tab==="appeals"?"appeals":"profile_verifications";
    const now=new Date().toISOString();const patch:Record<string,unknown>=action==="suspend"?{suspended_at:now,is_restricted:true}:action==="restrict"?{is_restricted:true}:action==="unsuspend"?{suspended_at:null,is_restricted:false}:action==="remove"?{status:"removed",reviewed_at:now}:action==="delete"?{status:"archived"}:action==="feature"?{is_guest_of_day:true}:action==="approve"?{status:"approved",reviewed_at:now}:action==="reject"?{status:"rejected",reviewed_at:now,...(rejectionReason?{rejection_reason:rejectionReason}:{})}:action==="resolve"?{status:"resolved",resolved_at:now}:action==="resolveAppeal"?{status:"accepted",response:"Contestation acceptée."}:action==="rejectAppeal"?{status:"rejected",response:rejectionReason}:action==="markPaid"?{payment_status:"paid"}:{};
    const {error}=await supabase.from(table).update(patch).eq("id",String(row.id));let finalError=error;
    if(!finalError&&tab==="verif"&&action==="approve"){const result=await supabase.from("profiles").update({verified_at:now}).eq("id",String(row.user_id));finalError=result.error;}
    if(!finalError&&tab==="verif"&&action==="remove"){const result=await supabase.from("profiles").update({verified_at:null}).eq("id",String(row.user_id));finalError=result.error;}
    if(!finalError&&action==="markPaid")setRows(rows.map(item=>item.id===row.id?{...item,payment_status:"paid"}:item));
    else if(!finalError)setRows(rows.filter((item)=>item.id!==row.id));
    else window.alert(finalError.message);
    setBusy(null);
  }
  return <div className="admin-list">{rows.map(row=><article key={String(row.id)} className="admin-row"><div><strong>{String(row[titleField]??"Élément")}</strong><small>{tab}{tab==="ads"?` · ${row.payment_method??"paiement"} · ${row.payment_status??"en attente"}`:tab==="verif"?` · ${row.document_type??"document non indiqué"}${row.rejection_reason?` · ${row.rejection_reason}`:""}`:tab==="appeals"?` · compte ${row.user_id}`:""}</small>{tab==="verif"&&<div className="verification-previews">{(verificationImages[String(row.id)]??[]).map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Pièce de vérification ${index+1}`}/></a>)}</div>}</div>
    {tab==="users"&&(row.is_restricted||row.suspended_at?<button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"unsuspend")}>Lever la restriction</button>:<><button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"restrict")}>Restreindre</button><button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"suspend")}>Suspendre</button></>)}
    {tab==="posts"&&<><button className="button button-quiet" onClick={()=>void act(row,"feature")}>Guest du jour</button><button className="icon-button danger-quiet" onClick={()=>void act(row,"delete")} aria-label="Archiver"><Trash2 size={17}/></button></>}
    {tab==="verif"&&<><button className="button button-primary" disabled={busy===String(row.id)} onClick={()=>void act(row,"approve")}>Valider</button><button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"reject")}>Refuser / demander de nouvelles pièces</button></>}
    {tab==="ads"&&<>{row.payment_status!=="paid"&&<button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"markPaid")}>Paiement reçu</button>}<button className="button button-primary" disabled={row.payment_status!=="paid"||busy===String(row.id)} onClick={()=>void act(row,"approve")}>Valider</button><button className="button button-quiet" onClick={()=>void act(row,"reject")}>Refuser</button></>}
    {tab==="reports"&&<button className="button button-quiet" onClick={()=>void act(row,"resolve")}>Traité</button>}
    {tab==="appeals"&&<><button className="button button-primary" disabled={busy===String(row.id)} onClick={()=>void act(row,"resolveAppeal")}>Accepter</button><button className="button button-quiet" disabled={busy===String(row.id)} onClick={()=>void act(row,"rejectAppeal")}>Refuser</button></>}</article>)}</div>;
}

function App() {
  const {loading,configured}=useAuth();
  if(loading)return <div className="loading-screen"><BrandLogo light className="loading-logo" /></div>;
  if(!configured)return <Routes><Route path="/welcome" element={<Welcome/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route path="/forgot-password" element={<AuthPage mode="forgot"/>}/><Route path="*" element={<ConfigNotice/>}/></Routes>;
  return <Routes>
    <Route path="/welcome" element={<Welcome/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route path="/forgot-password" element={<AuthPage mode="forgot"/>}/>
    <Route element={<Protected/>}><Route path="/onboarding" element={<Onboarding/>}/><Route element={<AppShell/>}><Route index element={<Home/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/create" element={<CreatePost/>}/><Route path="/connections" element={<Connections/>}/><Route path="/connections/:id" element={<Conversation/>}/><Route path="/profile" element={<OwnProfile/>}/><Route path="/profile/:id" element={<PublicProfile/>}/><Route path="/post/:id" element={<PostDetail/>}/><Route path="/settings" element={<Settings/>}/><Route path="/safety" element={<Safety/>}/><Route path="/notifications" element={<NotificationsPage/>}/><Route path="/admin" element={<Admin/>}/></Route></Route>
    <Route path="*" element={<Navigate to="/welcome" replace/>}/>
  </Routes>;
}

export default App;
