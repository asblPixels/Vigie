"""Tests de Vigie. Lancer :  python3 test_vigie.py
Ajoutez ici chaque nouvelle arnaque rencontrée sur le terrain (texte anonymisé)."""
from regles import analyser

CAS = [
    # (description, message, verdicts acceptés)
    ("Colis bpost, frais", "bpost: Votre colis est en attente. Frais de livraison de 1,99 EUR à régler sous 24h : https://bpost-suivi-colis.xyz/paiement", {"rouge"}),
    ("Code itsme", "itsme : votre compte sera désactivé. Confirmez votre code itsme ici https://bit.ly/3xYz", {"rouge"}),
    ("Faux enfant", "Coucou maman c'est moi, mon téléphone est cassé, voici mon nouveau numéro. Peux-tu me faire un virement urgent ? Ne le dites à personne", {"rouge"}),
    ("Faux SPF Finances", "SPF Finances : vous avez droit à un remboursement de 312,40 €. Cliquez ici pour le recevoir : http://myminfin-remboursement.top/login", {"rouge"}),
    ("Fausse banque + AnyDesk", "Bonjour, ici le service sécurité de Belfius. Installez l'application AnyDesk pour que nous sécurisions votre compte.", {"rouge"}),
    ("Carte cadeau", "Votre petit-fils a un problème, achetez 3 cartes Paysafecard de 100 € et envoyez-moi les codes.", {"rouge"}),
    ("Lien IP", "Proximus: votre ligne sera suspendue. Mettez à jour vos informations : http://185.23.44.10/proximus", {"rouge"}),
    ("Rendez-vous médecin", "Rappel : votre rendez-vous chez le Dr Dupont est fixé au mardi 18 novembre à 10h30. Pour annuler, appelez le 065 12 34 56.", {"vert"}),
    ("Facture Proximus officielle", "Proximus : votre facture de novembre est disponible dans MyProximus sur https://www.proximus.be/myproximus", {"vert"}),
    ("Message familial", "Salut papa, on passe dimanche midi avec les enfants. Bisous", {"vert"}),
    ("Suivi bpost officiel", "bpost : votre colis sera livré demain entre 9h et 13h. Suivi : https://track.bpost.cloud/btr/web/#/search?itemCode=CD123", {"vert", "orange"}),
]

if __name__ == "__main__":
    echecs = 0
    for nom, msg, attendus in CAS:
        r = analyser(msg)
        ok = r["verdict"] in attendus
        echecs += not ok
        print(f"{'OK   ' if ok else 'ÉCHEC'} {nom:30} -> {r['verdict']:6} (score {r['score']})")
        if not ok:
            for raison in r["raisons"]:
                print("        -", raison)
    print(f"\n{len(CAS) - echecs}/{len(CAS)} cas réussis")
    raise SystemExit(1 if echecs else 0)
