# TOI&MOI

Application web TOI&MOI, construite avec React, Vite et Supabase.

## Aperçu local

```sh
pnpm install
pnpm dev
```

## Publication GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement `main` sur GitHub Pages. Le dépôt doit s’appeler `toi-et-moi` et Pages doit être configuré sur **GitHub Actions**.

Configurer les URL de redirection de connexion dans Supabase avec le domaine GitHub Pages obtenu après publication. Les secrets NAFA et Supabase côté serveur ne doivent jamais être ajoutés au dépôt.
