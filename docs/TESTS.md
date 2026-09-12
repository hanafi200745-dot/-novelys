# Vérification de la livraison — 8 septembre 2026

## Tests automatisés

38 tests serveur exécutés et réussis (32 avec SQLite persistant, 6 dans Cloudflare Workers / Miniflare avec les bindings D1 et R2). Cinq contrôles de rendu et de composants ont également réussi après compilation : **43 tests au total**.

Commandes :

```bash
node --test tests/platform.test.mjs tests/worker.test.mjs
node --test tests/rendered-html.test.mjs tests/ui-components.test.mjs
```

Les contrôles métier couvrent :

- Création du premier administrateur, inscription/connexion de deux parents, hashes scrypt, déconnexion et révocation des sessions.
- Ajout d’enfants, rattachement côté serveur, séparation stricte des familles, refus des routes administrateur et des écritures provenant d’une autre origine.
- Disponibilités anonymes, réservation PENDING, confirmation, refus/libération, expiration et protection SQL des transitions.
- Deux requêtes simultanées : un succès et un conflit. Vérification dans SQLite et dans le runtime Workers avec D1. Requête SQL directe conflictuelle également refusée.
- Chevauchement partiel interdit, créneaux adjacents autorisés, absences et réservation hors disponibilité refusées.
- Série de quatre cours, rollback complet si une occurrence est conflictuelle, déplacement de toutes les séances futures.
- Créneau personnalisé sans réservation automatique, acceptation unique, proposition alternative et acceptation de l’horaire exact par le parent.
- Annulation sous validation, conservation du créneau avant accord, liste d’attente, notification de libération et proposition à une famille.
- Évaluations visibles par le professeur et leur seule famille ; comptes rendus partagés, notes du professeur privées.
- Upload multipart, octets stockés dans R2, téléchargement autorisé au parent et à l’administrateur, accès refusé aux autres familles et aux visiteurs anonymes. Refus d’un faux PDF HTML.
- Avis invisibles avant modération, export individuel sans données étrangères ni notes privées, effacement des fichiers et données liés à une famille.
- Données présentes après réouverture du fichier SQLite, heures de Paris aux changements de saison, endpoint de traitement protégé, aucun e-mail externe pour les fixtures.

## Contrôle navigateur

Essais effectués sur l’aperçu de la même application, avec sa base locale persistante et ses comptes fictifs :

- Accueil et navigation, compte parent, tableau de bord familial, calendrier et ses disponibilités.
- Formulaire de réservation en trois étapes, préparation d’un cours, apparition conditionnelle des champs d’évaluation.
- Envoi d’une réservation avec évaluation : notification « Demande envoyée — en attente de confirmation », apparition de l’évaluation dans le suivi.
- Connexion du professeur, affichage de la réservation en attente, validation : état « Confirmé » dans le programme du lendemain.
- Affichage à 390 × 844 pixels, menu mobile, passage au calendrier, formulaire de cours réguliers lisible et défilant. Largeur du contenu principal mesurée égale à sa largeur disponible, sans débordement horizontal. Le test utilise un iframe de largeur réelle de 390 pixels et ne remplace pas une campagne sur tous les modèles iOS/Android.

Les essais de concurrence, d’accès interdit, de fichiers et de persistance sont automatisés côté serveur ; ils ne sont pas déduits de la seule présence de boutons.

## Corrections apportées pendant les essais

- Qualification de la colonne de tri des avis pour éliminer une ambiguïté SQL.
- Sérialisation du simulateur SQLite de tests pour reproduire le comportement transactionnel D1.
- Encodage multipart réel dans les tests Workers.
- Synchronisation de l’identité affichée lorsqu’un compte de démonstration est changé dans un autre onglet.

## Périmètre de validation

Aucun e-mail à une famille réelle n’a été envoyé. L’adaptateur e-mail, l’outbox, les notifications internes et les traitements sont implémentés ; la livraison ne prétend pas avoir vérifié la réception chez un fournisseur tant que son compte et son domaine expéditeur ne sont pas configurés. Le planificateur autonome doit être activé pour les rappels en l’absence de visites. L’ouverture publique et les informations du responsable restent à finaliser avant l’accueil de vraies familles. Voir DEPLOIEMENT.md.
