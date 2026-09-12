# État vérifié au 8 septembre 2026

L'application est construite et testée localement. La publication Sites a échoué avant de fournir une URL. **Cette livraison n'est donc pas encore un service en ligne utilisable par les familles.**

## Résultats

- 43 tests réussis, rejoués après la reprise : 32 contrôles SQLite, 6 contrôles Workers/D1/R2 et 5 contrôles de rendu/composants.
- Parcours navigateur déjà réalisés sur l'aperçu : réservation parent, préparation avec évaluation, validation professeur et affichage mobile de 390 × 844 pixels. Voir `TESTS.md` pour le périmètre exact.
- Code, migrations, tests, instructions et intégrations conservés dans le dépôt du même Site.
- Aucun e-mail envoyé à une famille réelle. Messagerie, planification externe, informations personnelles du responsable et ouverture aux familles restent à configurer.

## Diagnostic de publication à transmettre au support Sites

| Élément | Valeur |
| --- | --- |
| Site | Novélys · Cours particuliers |
| Projet | `appgprj_6a9eede49bac8191907a1970ef39494a` |
| Version en échec | `appgprj_6a9eede49bac8191907a1970ef39494a~appgver_d3261c110e40819190a8e59bd894f522` |
| Publication | `appgdep_6a9fede3e46081918a8c92c86ae3b1ab` |
| Source de cette version | `9d0cd22c3223e8db4495749a5c549b4cd6a822be` |
| État confirmé par l'hébergeur | `failed` |
| Erreur | `incomplete input: SQLITE_ERROR` |
| Horodatage du statut | `2026-09-08T11:13:47.802571+00:00` |
| URL retournée | Aucune |

L'inspection native de la base retourne `bindings: []`, `selected_binding_name: null` et `tables: []`. Cela ne permet **pas** de conclure que la base créée pendant la publication est vide : aucune liaison de base publiée n'est accessible à cet outil. Le statut ne fournit ni le fichier de migration fautif, ni l'instruction fautive, ni le journal des migrations appliquées.

La procédure Sites impose de préserver les migrations déjà appliquées et d'identifier la migration échouée avant correction. Aucune migration SQL ni son historique n'a été réécrit, et la même archive défaillante n'a pas été republiée.

**Information nécessaire pour reprendre :** obtenir le journal d'application des migrations de cette publication, le nom du fichier et l'instruction SQL exacte ayant échoué, puis confirmer quelles migrations ont été enregistrées. Vérifier aussi que l'importeur transmet chaque instruction SQL complète, notamment les `CREATE TRIGGER ... BEGIN ... END`, sans découper leurs points-virgules internes. Cela requiert le diagnostic de l'hébergeur ; aucune clé e-mail ou donnée personnelle de famille n'est nécessaire pour résoudre ce blocage.

## Reproduction locale du problème de transport SQL

`node scripts/check-d1-import.mjs` travaille exclusivement sur une base D1 temporaire et n'accède pas à la production.

Dans le runtime local testé, `D1.exec()` sur les fichiers multilignes bruts échoue dès la première ligne avec `incomplete input`. Les mêmes instructions complètes envoyées via `prepare().run()` passent. Les triggers sur une seule ligne passent également avec `exec()`.

Cette différence est cohérente avec la [documentation D1 de `exec()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#exec), qui décrit des requêtes séparées par des sauts de ligne. Elle constitue une piste de diagnostic, **pas une preuve du découpage utilisé par l'importeur Sites**, dont les journaux ne sont pas exposés ici. Il ne faut pas modifier une migration possiblement appliquée sur la seule base de cette hypothèse.

## Reprise

1. Réutiliser ce projet et sa publication en échec ; ne pas créer un autre Site.
2. Obtenir la limite exacte entre migrations appliquées et non appliquées.
3. Corriger uniquement la migration identifiée comme échouée/non appliquée ou faire corriger l'importeur. Conserver les protections SQL de concurrence.
4. Tester, construire, sauvegarder le code exact et publier une version corrigée.
5. Ne livrer comme lien fonctionnel que l'URL effectivement retournée avec un état `succeeded`.

Le lancement local et les comptes de démonstration restent décrits dans le `README.md`. Les étapes d'ouverture réelle sont dans `DEPLOIEMENT.md`.
