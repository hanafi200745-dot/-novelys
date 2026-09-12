# Déploiement et ouverture du service

## Livraison Work / Sites

Le projet garde son identité dans `.openai/hosting.json`. Sites provisionne une base D1 (`DB`) et un bucket R2 (`BUCKET`) persistants. Les migrations Drizzle sont intégrées à l’archive et exécutées avant la publication. Ne pas créer de tables depuis une route de l’application. Après publication, conserver les migrations appliquées et ajouter uniquement de nouvelles migrations.

Construire le projet avec `npm run build`, sauvegarder le code exact et publier l’archive construite depuis ce code. Les variables d’hébergement doivent être enregistrées dans les paramètres du site, jamais dans le manifeste ou le client. Un changement de variable requiert une nouvelle publication de la version sauvegardée.

## Variables

| Variable | Usage | Avant ouverture réelle |
| --- | --- | --- |
| `DEMO_MODE` | Active les fixtures et raccourcis de test sous accès propriétaire | `false` |
| `LOCAL_DEMO` | Autorise les raccourcis sur localhost / terminal.local | `false` |
| `DEMO_PASSWORD` | Mot de passe serveur des comptes fictifs | Retirer |
| `BOOTSTRAP_SECRET` | Initialiser le premier administrateur si aucun n’existe | Retirer après initialisation |
| `APP_URL` | URL canonique HTTPS du site | URL finale sans `/` à la fin |
| `RESEND_API_KEY` | Secret de l’adaptateur d’e-mails | Clé d’un compte Resend autorisé |
| `EMAIL_FROM` | Expéditeur e-mail | Adresse d’un domaine validé chez Resend |
| `CRON_SECRET` | Authentifier `POST /api/jobs` | Secret aléatoire long, partagé avec le planificateur |

La démonstration n’utilise pas la messagerie externe. Les e-mails réels restent dans une file persistante en l’absence de configuration. L’application indique cet état dans les paramètres. La récupération de mot de passe par e-mail nécessite `APP_URL`, `RESEND_API_KEY` et `EMAIL_FROM`.

## Passer de la démonstration à votre activité

1. Connectez-vous au compte professeur fictif et ouvrez **Paramètres → Créer mon compte administrateur**. Choisissez votre adresse et un mot de passe personnel fort.
2. Connectez-vous avec ce nouveau compte, puis utilisez **Retirer les données fictives**. Cette opération efface uniquement les données marquées démonstration. Un marqueur durable empêche toute réinitialisation automatique des fixtures.
3. Définissez `DEMO_MODE=false`, `LOCAL_DEMO=false`, retirez les secrets de démonstration et republiez. Ne partagez pas une démonstration contenant un raccourci administrateur.
4. Renseignez le nom, les coordonnées, l’adresse du responsable, les règles de réservation et de conservation. Créez vos vrais horaires. Aucun planning personnel trouvé dans d’autres échanges n’est importé silencieusement.
5. Activez le service e-mail et un planificateur. Vérifiez une confirmation et un rappel sur **votre propre adresse**, puis le parcours complet avec une famille consentante.
6. Changez l’accès Sites pour permettre l’accès public, ou déployez chez votre hébergeur. Les familles utilisent alors leurs comptes e-mail/mot de passe ; les routes privées restent protégées. L’accès public n’est pas activé par cette livraison de démonstration.

## Rappels et expiration sans visite

Le serveur exporte `scheduled`, et fournit `POST /api/jobs` protégé par `Authorization: Bearer <CRON_SECRET>`. Le traitement expire les demandes, crée les rappels et notifications de libération, puis envoie l’outbox avec reprise et clé d’idempotence. Les essais sont espacés et limités à cinq ; les échecs sont visibles dans l’administration. L’architecture permet un adaptateur SMS ultérieur.

Les visites du tableau de bord déclenchent aussi ce traitement au plus une fois par minute. Cela est utile en démonstration mais **ne remplace pas une exécution programmée lorsque personne ne visite le site**. Les créneaux expirés sont toujours libérés lors de la prochaine lecture ou réservation, indépendamment du planificateur.

Sites n’expose pas de configuration de Cron Trigger dans le manifeste utilisé ici. Le relais prêt à déployer se trouve dans `scripts/cron-relay.ts`, avec `scripts/cron-relay.wrangler.example.jsonc` (toutes les cinq minutes). Un planificateur externe équivalent peut appeler l’endpoint. Il doit pouvoir atteindre le site : l’accès privé Work bloque les appels externes anonymes ; activer le relais après l’ouverture contrôlée du site. Pour un déploiement Cloudflare autonome, un Cron Trigger sur le Worker principal utilise directement `scheduled`, sans relais.

Le compte de planification et les clés de messagerie appartiennent au responsable du service. Ils restent les seuls éléments externes à fournir pour ces intégrations.

## Sauvegardes et exploitation

Le dépôt contient le code, jamais les données des familles. La base D1 et les objets R2 survivent aux nouvelles versions. Prévoir une stratégie de sauvegarde régulière : export D1 et copie des objets R2 dans un stockage séparé contrôlé par le responsable, puis vérifier une restauration. Les outils de récupération D1 de l’hébergeur dépendent de son offre. Ne jamais exporter les familles vers un dépôt Git.

L’export individuel depuis **Mon compte** exclut les autres familles et les notes privées du professeur. Une suppression demandée est présentée à l’administration et efface les fichiers privés puis les données liées. Les règles de rétention affichées sont une référence de politique ; il appartient au responsable d’examiner les comptes inactifs et les obligations éventuelles avant l’effacement. Aucun effacement automatique irréversible sur une durée juridique inventée n’est activé.

Avant des données réelles de mineurs : renseigner et valider l’information de confidentialité, les bases légales, les durées, les sous-traitants, la localisation et les garanties de transfert applicables à votre situation. Le projet applique des contrôles techniques ; il n’est pas un audit juridique ou une certification de conformité.

Références primaires consultées : [transactions D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [API e-mail Resend](https://resend.com/docs/api-reference/emails/send-email), [durées de conservation — CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees).
