# État de reprise — 8 septembre 2026

Projet original : Novélys, identifiant dans `.openai/hosting.json`. Réutiliser ce Site.

L'application est construite, le code est sauvegardé dans le dépôt Sites et les 43 tests ont été rejoués avec succès. Les parcours navigateur parent/professeur et mobile ont été réalisés.

La première publication a échoué avec `incomplete input: SQLITE_ERROR`. Aucun lien de production n'a été retourné. La limite entre migrations appliquées et non appliquées n'est pas exposée par les outils disponibles ; ne pas réécrire leur historique ni republier la même archive sans diagnostic.

Voir **ETAT_LIVRAISON.md** pour le statut exact, les identifiants de suivi et l'information nécessaire pour reprendre la publication. Aucun fichier de migration n'a été modifié après cet échec.
