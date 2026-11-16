# Contribuer à Vigie

Merci de votre aide. Vigie sert des personnes qui n'ont pas droit à l'erreur : chaque changement doit rester **simple, lisible et sûr**.

## Principes

1. **Un écran, un geste.** N'ajoutez pas d'option qui complique l'accueil.
2. **Hors ligne par défaut.** Aucune requête réseau, aucun traceur, aucune dépendance qui appelle un service extérieur.
3. **Des règles lisibles.** Une détection s'ajoute dans `regles.py` avec sa raison en français simple ; l'IA n'est jamais juge.
4. **Accessibilité.** Texte de 20 px au minimum, contraste AA, boutons de 56 px de haut, thème clair et sombre.
5. **Aucune assistance ni numéro imposé.** Vigie ne désigne personne à appeler et ne reçoit aucun message de l'utilisateur.

## Proposer une règle

1. Ajoutez le cas dans `test_vigie.py` (message type, verdict attendu).
2. Modifiez `regles.py`, puis lancez :

```bash
python3 test_vigie.py
python3 outils/exporter_regles.py
python3 outils/verifier_parite.py
```

Les trois doivent réussir : c'est ce qui garantit le même verdict sur PC et sur Android.

## Interface

La feuille de style `static/vigie.css` est commune au PC et à Android. Après modification, lancez `cd mobile && npm run preparer`. Les couleurs de la marque (bleu nuit `#0E2A38`, turquoise `#007A7A`, menthe `#5EEAD4`) sont réservées à l'identité ; les verdicts gardent leurs couleurs rouge, orange et vert.

## Messages de commit

Phrase courte à l'impératif, en français : « Ajoute la règle des faux avis de colis ».

## Données personnelles

N'ouvrez jamais de ticket contenant un vrai numéro, un nom ou un IBAN : masquez-les avant de coller un message.
