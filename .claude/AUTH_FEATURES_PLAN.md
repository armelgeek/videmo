# Auth Features Plan

## Phase 1: Sécurité & UX basique

### 1. Rate Limiting
**Objectif:** Bloquer les brute-force sur login, signup, OTP, password reset

**Fichiers à modifier:**
- `lib/security/rate-limiter.ts` (créer s'il existe pas)
- `app/api/auth/sign-in/email/route.ts` 
- `app/api/auth/sign-up/email/route.ts`
- `app/api/auth/email-otp/verify/route.ts`
- `lib/auth.ts` (ajouter middleware)

**Logique:**
- Redis/memory store: clé = `ip:endpoint:identifier`
- Limits: login (5/min), signup (3/min), OTP (5/min), reset (3/min)
- Réponse: 429 Too Many Requests après limite atteinte
- Afficher: "Trop de tentatives. Réessai dans X secondes"

**DB Schema:**
```sql
RateLimit {
  id String @id @default(cuid())
  key String @unique
  count Int @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

### 2. Resend Verification Email
**Objectif:** Renvoyer le code OTP si l'utilisateur l'a perdu

**Fichiers à modifier:**
- `components/molecules/forms/login-form.tsx` (ajouter bouton Resend)
- `app/api/auth/email-otp/resend/route.ts` (créer)

**Logique:**
- Bouton "Resend code" sur écran OTP login/signup
- Cooldown: 60s entre chaque renvoi
- Rate limit: max 3 renvois par code
- Email service: envoie un nouveau code

**Endpoint:**
```
POST /api/auth/email-otp/resend
{ email, type: "email-verification" | "sign-in" }
```

---

### 3. Magic Link (Passwordless)
**Objectif:** Se connecter via un lien cliquable, sans mot de passe

**Fichiers à modify:**
- `lib/auth.ts` (ajouter plugin magic-link si better-auth l'a)
- `app/api/auth/magic-link/route.ts` (créer)
- `app/api/auth/magic-link/verify/route.ts` (créer)
- `components/molecules/forms/magic-link-form.tsx` (créer)
- `app/login/page.tsx` (ajouter tab Magic link / Email+Password)

**Logique:**
- Utilisateur rentre son email → on génère un token sécurisé
- Email: "Cliquez ici pour vous connecter" (lien = `/api/auth/magic-link/verify?token=xxx`)
- Token expire après 15 min
- Une seule utilisation par token
- Rate limit: 1 magic link/min par email

**Prisma Schema:**
```sql
MagicLink {
  id String @id @default(cuid())
  email String
  token String @unique
  expiresAt DateTime
  usedAt DateTime?
  createdAt DateTime @default(now())
}
```

---

## Phase 2: Gestion de compte

### 4. Change Password
**Objectif:** Permettre à l'utilisateur connecté de changer son mot de passe

**Fichiers à modifier:**
- `app/(protected)/settings/page.tsx` ou `/account/security/page.tsx` (créer)
- `components/molecules/forms/change-password-form.tsx` (créer)
- `actions/auth/change-password.ts` (créer)

**Logique:**
- Formulaire: ancien password + nouveau (x2)
- Valider ancien password avant changement
- Déconnecter l'utilisateur après (ou lui faire confirmer)
- Audit log: qui a changé quand

---

### 5. Change Email
**Objectif:** Permettre à l'utilisateur de changer son email avec reverification

**Fichiers à modifier:**
- `app/(protected)/settings/page.tsx`
- `components/molecules/forms/change-email-form.tsx` (créer)
- `actions/auth/change-email.ts` (créer)
- `app/api/auth/verify-email-change/route.ts` (créer)

**Logique:**
- Utilisateur rentre nouveau email
- On envoie un code OTP au nouvel email
- Utilisateur confirme avec le code
- Old email reste actif jusqu'à confirmation
- Audit log

**Prisma Schema:**
```sql
PendingEmailChange {
  id String @id @default(cuid())
  userId String
  newEmail String
  token String @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

### 6. Delete Account
**Objectif:** RGPD — permettre la suppression du compte et des données

**Fichiers à modifier:**
- `app/(protected)/settings/page.tsx`
- `components/molecules/forms/delete-account-form.tsx` (créer)
- `actions/auth/delete-account.ts` (créer)

**Logique:**
- Page avec warning rouge "Cette action est irréversible"
- Demander confirmation du mot de passe
- Supprimer: utilisateur, sessions, données liées
- Soft delete option: garder les données archivées 30j avant hard delete
- Email de confirmation

---

## Phase 3: Sécurité avancée

### 7. Recovery Codes pour 2FA
**Objectif:** Backup codes si l'utilisateur perd son authenticator

**Fichiers à modifier:**
- `app/(protected)/settings/security/page.tsx` (créer)
- `components/molecules/forms/2fa-setup-form.tsx` (créer ou modifier)
- `actions/auth/generate-recovery-codes.ts` (créer)
- `app/api/auth/two-factor/recovery/route.ts` (créer)

**Logique:**
- Quand on active 2FA: générer 8 codes uniques (format: `XXXX-XXXX`)
- Afficher une fois au setup → l'utilisateur les copie
- Stocker hashés en DB
- Chaque code ne peut être utilisé qu'une fois
- Login avec 2FA: option "Utiliser un code de récupération"

**Prisma Schema:**
```sql
RecoveryCode {
  id String @id @default(cuid())
  userId String
  code String @unique (hasé)
  usedAt DateTime?
  createdAt DateTime @default(now())
}
```

---

### 8. Remember This Device
**Objectif:** 30 jours sans 2FA sur ce navigateur

**Fichiers à modifier:**
- `lib/auth.ts` (ajouter token "remember device")
- `app/api/auth/two-factor/verify/route.ts` (ajouter option remember)
- `components/molecules/forms/login-form.tsx` (ajouter checkbox)

**Logique:**
- Checkbox "Me reconnecter sur cet appareil pendant 30 jours"
- Si coché → générer device token (stocké en cookie HttpOnly + DB)
- Prochaine connexion: vérifier device token → sauter 2FA
- Device token inclut: user_id, device_id, expiration
- Utilisateur peut révoquer tous les devices dans settings

**Prisma Schema:**
```sql
TrustedDevice {
  id String @id @default(cuid())
  userId String
  deviceId String (hash du user-agent + IP)
  token String @unique
  expiresAt DateTime
  lastUsedAt DateTime @default(now())
  revokedAt DateTime?
  createdAt DateTime @default(now())
}
```

---

## Dépendances & ordre d'implémentation

1. **Rate Limiting** (indépendant) — sécurité
2. **Resend Email** (dépend de OTP existant) — quick win
3. **Magic Link** (indépendant) — nouvelle feature
4. **Change Password** (indépendant) — nécessaire
5. **Change Email** (dépend de OTP) — nécessaire
6. **Delete Account** (indépendant) — RGPD
7. **Recovery Codes** (dépend de 2FA existant) — sécurité avancée
8. **Remember Device** (dépend de 2FA existant) — UX

**Suggestion:** Commencer par 1, 2, 3 (Phase 1). Puis 4, 5, 6 (Phase 2). Puis 7, 8 (Phase 3).

---

## Pages à créer/modifier

**Nouvelles pages:**
- `app/(protected)/settings/page.tsx` — hub settings
- `app/(protected)/settings/security/page.tsx` — security (2FA, devices, recovery codes)
- `app/(protected)/settings/account/page.tsx` — email, password, delete account

**Nouveaux formulaires:**
- Magic link login (onglet sur `/login`)
- Change password
- Change email
- Delete account (avec warning)
- 2FA setup avec recovery codes
- Trusted devices list + revoke

**Nouveaux endpoints:**
- `POST /api/auth/magic-link`
- `POST /api/auth/magic-link/verify`
- `POST /api/auth/email-otp/resend`
- `POST /api/auth/verify-email-change`
- `POST /api/auth/two-factor/recovery`
- `POST /api/auth/two-factor/trusted-device`
- `GET /api/auth/trusted-devices`
- `DELETE /api/auth/trusted-devices/:id`

---

## Approche design

Toutes les pages settings suivent le **sketch design system**:
- Header + footer de la landing
- Split-screen ou une colonne
- Feuille scotchée pour les formulaires sensibles (password, delete)
- Warnings en rouge/sketch-hand pour les actions irréversibles
- Même typographie, ombres, bordures que login/signup
