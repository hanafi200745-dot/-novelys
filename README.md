# Novélys — plateforme de cours particuliers

Application complète en français pour organiser des cours de mathématiques et de physique-chimie : espace familles, administration, disponibilités, réservations sous validation, suivi et fichiers privés.

**État au 8 septembre 2026 :** 43 tests locaux réussis. La publication Sites est bloquée par une erreur d'import SQL ; aucun lien de production fonctionnel n'a encore été obtenu. Voir [ETAT_LIVRAISON.md](docs/ETAT_LIVRAISON.md). Le projet peut être lancé et testé localement avec les instructions ci-dessous.

## Tester le site livré

Ouvrir **Espace famille**, puis choisir **Compte professeur**, **Famille Martin** ou **Famille Moreau**. Ces boutons existent uniquement en démonstration, sous l’accès privé du propriétaire. Les comptes et avis sont fictifs ; aucun e-mail n’est envoyé à ces familles. Les données de la démonstration sont enregistrées dans la vraie base D1, et les fichiers dans R2.

Parcours conseillé : Famille Martin → Calendrier → un créneau libre → réserver → Changer de compte de test → Compte professeur → Demandes → Accepter. Revenir sur la famille pour voir la confirmation. Ajouter ensuite une évaluation ou un document dans la fiche d’Axel. La famille Moreau ne doit voir que Mathéo.

## Lancer localement

Prérequis : Node.js 24, npm, environnement supportant Cloudflare Workers. Le dépôt contient le verrou des dépendances.

```bash
npm ci
cp .env.example .dev.vars
npm run dev
```

Renseigner les variables **uniquement** dans `.dev.vars`, et dans `.env` si l’environnement de développement le demande. Pour une démonstration locale : `DEMO_MODE=true`, `LOCAL_DEMO=true` et un `DEMO_PASSWORD` de test de 12 caractères minimum. Ne jamais réutiliser ce mot de passe pour un compte personnel. Le serveur accepte `localhost`, `127.0.0.1` et l’aperçu Work `terminal.local` pour la démonstration locale.

Après une première ouverture du site (qui initialise les liaisons locales), dans un second terminal :

```bash
node scripts/migrate-local.mjs
```

Actualiser la page. La base locale et les fichiers se trouvent dans `.wrangler/state`, persistent après redémarrage et sont exclus du dépôt. Le script refuse d’agir si plusieurs bases locales sont ambiguës. Dans Work, le serveur est démarré par `sites-preview start /workspace/sites/novelys`.

Sans démonstration, définir `BOOTSTRAP_SECRET` puis utiliser **Initialiser le compte professeur** sur la page de connexion. L’initialisation est refusée dès qu’un administrateur existe. Retirer ensuite ce secret.

## Vérifications reproductibles

```bash
node --test tests/platform.test.mjs tests/worker.test.mjs
npm test
```

La première commande vérifie le métier avec SQLite persistant et exécute le même serveur dans un vrai runtime Workers local avec D1 et R2. `npm test` ajoute la compilation et les contrôles de rendu. Les tests n’envoient aucun e-mail et n’utilisent aucune famille réelle. Voir [TESTS.md](docs/TESTS.md).

## Architecture et données

- Frontend : React 19, Vinext/Vite, composants accessibles Radix/Shadcn, mise en page responsive.
- Backend : Cloudflare Worker, validation Zod, requêtes préparées D1.
- Base persistante : SQLite/D1 ; schéma Drizzle dans `db/schema.ts`, migrations dans `drizzle/`.
- Fichiers : stockage R2 privé, téléchargements exclusivement via les routes authentifiées.
- Notifications : boîte de réception dans l’application + outbox transactionnelle, adaptateur e-mail Resend, point d’extension pour SMS.
- Heures affichées : Europe/Paris, stockage des instants en millisecondes UTC ; séries conservant l’heure locale pendant les changements de saison.

Les tables couvrent utilisateurs, sessions, élèves, disponibilités, réservations, séries, demandes, liste d’attente, évaluations, bilans, notes privées, documents, avis, notifications, e-mails, paramètres, audits et demandes d’effacement. Le rôle parent est porté par `users.role` ; `students.parent_id` rattache plusieurs enfants au même responsable. `requests.type` distingue créneau personnalisé, déplacement et annulation.

`AVAILABLE` est un état calculé du calendrier, pas une réservation. Une réservation utilise `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` ou `DECLINED`. Un refus ou une expiration libère le créneau. Une demande personnalisée ou une proposition ne le bloque pas avant accord.

Les chevauchements sont interdits par des triggers SQL, y compris pour les réservations actives de durées différentes. Les opérations multi-écritures et séries utilisent `DB.batch`, avec rollback complet au premier conflit. Les requêtes SQL contiennent des gardes pour empêcher un double traitement concurrent.

Les autorisations sont vérifiées côté serveur pour chaque ressource. Les familles ne reçoivent aucune note pédagogique privée et le calendrier public ne renvoie aucun nom. Les mots de passe sont dérivés par scrypt ; les sessions utilisent des jetons aléatoires dont seul le hash est stocké. Les cookies sont HttpOnly, SameSite=Lax et Secure en HTTPS. Les écritures vérifient l’origine ; les accès sont limités en fréquence.

## Mise en service

Voir [DEPLOIEMENT.md](docs/DEPLOIEMENT.md) pour les variables, les migrations, le planificateur, les sauvegardes et l’ouverture aux familles. L'accès prévu pour la première publication Work est **privé pour le propriétaire**. Le site ne doit pas être présenté comme déjà publié ou ouvert aux familles réelles tant que la publication n'a pas réussi.

Les éléments externes à activer sont : compte administrateur personnel, informations du responsable, service d’e-mails avec expéditeur validé, planification périodique des rappels et accès public. La logique d’envoi et de rappel est incluse, mais aucun fournisseur ne peut envoyer de vrais e-mails sans sa configuration. Aucun paiement ou compte externe payant n’a été créé.
